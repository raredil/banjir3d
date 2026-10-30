"""Region-pack layer builders. Each returns a provenance record for one dataset.

Record: {dataset, version, sources, accessed, steps[], outputs[], display[]}.
COGs (analysis, EPSG of the region) and PMTiles (web display) are written to `out`.
"""
from __future__ import annotations

import io
import json
import math
import re
import tempfile
import zipfile
from pathlib import Path

import mgrs
import numpy as np
import rasterio
from rasterio.warp import Resampling, transform_bounds
from rasterio.windows import from_bounds

from . import load_domain
from .grid import region_grid, warp_to_grid
from .tiles import palette_render, ramp_render, render_pmtiles, rgb_render, terrarium
from .util import download, http_get, now_utc, output_record, url_exists, write_cog

S3_COPDEM = "https://copernicus-dem-30m.s3.amazonaws.com"
S3_IO = "https://io-10m-annual-lulc.s3.amazonaws.com"
S3_WC = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map"
GCS_GSW = "https://storage.googleapis.com/global-surface-water/downloads2021/occurrence"
S3_S2 = "https://sentinel-cogs.s3.us-west-2.amazonaws.com"
S3_OVERTURE = "overturemaps-us-west-2"
FABDEM_BASE = "https://data.bris.ac.uk/datasets/s5hqmjcdj8yo2ibzi9b4ew3sn"
WORLDPOP_BASE = "https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A"
GEOBOUNDARIES = "https://www.geoboundaries.org/api/current/gbOpen/IDN"
GEOFABRIK_JAVA = "https://download.geofabrik.de/asia/indonesia/java-latest.osm.pbf"

DEM_NODATA = -9999.0


def _cells(bbox, step=1.0):
    w, s, e, n = bbox
    for lat in range(math.floor(s / step), math.ceil(n / step)):
        for lon in range(math.floor(w / step), math.ceil(e / step)):
            yield lon * step, lat * step


def _rec(dataset, version, **kw):
    return {"dataset": dataset, "version": version, "accessed": now_utc(), "sources": [], "steps": [],
            "outputs": [], "display": [], **kw}


def _dem_display(rec, cog, out, region, name, maxzoom=12):
    pm = render_pmtiles(cog, out / f"{name}.pmtiles", bbox=region["bbox"], minzoom=5, maxzoom=maxzoom,
                        render=lambda d, v: terrarium(d[0], v), resampling=Resampling.bilinear,
                        metadata={"encoding": "terrarium", "source": cog.name})
    rec["display"].append(output_record(pm, kind="raster-dem", encoding="terrarium", minzoom=5, maxzoom=maxzoom))


# ---------------------------------------------------------------- terrain
def copernicus_dem(region: dict, out: Path) -> dict:
    rec = _rec("copernicus-glo30", "AWS public copy (2021 release)")
    srcs = []
    for lon, lat in _cells(region["bbox"]):
        ns = f"{'S' if lat < 0 else 'N'}{abs(int(lat)):02d}_00"
        ew = f"{'W' if lon < 0 else 'E'}{abs(int(lon)):03d}_00"
        name = f"Copernicus_DSM_COG_10_{ns}_{ew}_DEM"
        url = f"{S3_COPDEM}/{name}/{name}.tif"
        if url_exists(url):
            srcs.append(url)
    rec["sources"] = srcs
    grid = region_grid(region, 30)
    arr = warp_to_grid([f"/vsicurl/{u}" for u in srcs], grid, nodata=DEM_NODATA, resampling=Resampling.bilinear)
    rec["steps"].append({"op": "mosaic+reproject", "tool": "rasterio/GDAL warp", "params": {
        "dst_crs": str(grid.crs), "res_m": 30, "resampling": "bilinear", "nodata": DEM_NODATA}})
    cog = write_cog(out / "dem_glo30.tif", arr, transform=grid.transform, crs=grid.crs, nodata=DEM_NODATA,
                    predictor=3, overview_resampling="average", tags={"units": "m", "vertical_datum": "EGM2008"})
    rec["outputs"].append(output_record(cog, units="m", vertical_datum="EGM2008"))
    _dem_display(rec, cog, out, region, "dem_glo30")
    return rec


class _HTTPRangeFile(io.RawIOBase):
    """Seekable read-only file over HTTP range requests (to read one member of a remote zip)."""

    def __init__(self, url):
        self.url, self.pos = url, 0
        r = http_get(url, headers={"Range": "bytes=0-0"})
        if r.status_code != 206:
            raise OSError("server does not support range requests")
        self.size = int(r.headers["Content-Range"].split("/")[1])

    def seekable(self):
        return True

    def readable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, off, whence=0):
        self.pos = {0: off, 1: self.pos + off, 2: self.size + off}[whence]
        return self.pos

    def readinto(self, b):
        if self.pos >= self.size:
            return 0
        end = min(self.size, self.pos + len(b)) - 1
        data = http_get(self.url, headers={"Range": f"bytes={self.pos}-{end}"}, timeout=300).content
        b[: len(data)] = data
        self.pos += len(data)
        return len(data)


def _fabdem_zip_name(lon, lat, names):
    """Pick the 10x10-degree zip whose name range contains the 1-degree tile."""
    for n in names:
        m = re.match(r"([NS])(\d+)([EW])(\d+)-([NS])(\d+)([EW])(\d+)_FABDEM", n)
        if not m:
            continue
        s = int(m[2]) * (-1 if m[1] == "S" else 1)
        w = int(m[4]) * (-1 if m[3] == "W" else 1)
        nn = int(m[6]) * (-1 if m[5] == "S" else 1)
        e = int(m[8]) * (-1 if m[7] == "W" else 1)
        if s <= lat < nn and w <= lon < e:
            return n
    return None


def fabdem(region: dict, out: Path) -> dict:
    rec = _rec("fabdem", "V1-2")
    index = http_get(FABDEM_BASE + "/", timeout=120).text
    zips = sorted(set(re.findall(r'href="(?:[^"]*/)?([^"/]+_FABDEM_V1-2\.zip)"', index)))
    if not zips:
        raise RuntimeError("FABDEM V1-2 zip list not found on the dataset page")
    tmp = Path(tempfile.mkdtemp())
    tifs = []
    for lon, lat in _cells(region["bbox"]):
        zname = _fabdem_zip_name(int(lon), int(lat), zips)
        tile = f"{'S' if lat < 0 else 'N'}{abs(int(lat)):02d}{'W' if lon < 0 else 'E'}{abs(int(lon)):03d}_FABDEM_V1-2.tif"
        url = f"{FABDEM_BASE}/{zname}"
        try:
            zf = zipfile.ZipFile(_HTTPRangeFile(url))
            method = "http-range"
        except OSError:
            local = tmp / zname
            if not local.exists():
                download(url, local)
            zf = zipfile.ZipFile(local)
            method = "full-download"
        member = next((m for m in zf.namelist() if m.endswith(tile)), None)
        if member is None:
            continue  # sea-only tile
        dst = tmp / tile
        dst.write_bytes(zf.read(member))
        tifs.append(str(dst))
        rec["sources"].append(f"{url}#{member}")
        rec["steps"].append({"op": "extract", "params": {"zip": zname, "member": member, "method": method}})
    grid = region_grid(region, 30)
    arr = warp_to_grid(tifs, grid, nodata=DEM_NODATA, resampling=Resampling.bilinear)
    rec["steps"].append({"op": "mosaic+reproject", "tool": "rasterio/GDAL warp", "params": {
        "dst_crs": str(grid.crs), "res_m": 30, "resampling": "bilinear", "nodata": DEM_NODATA}})
    cog = write_cog(out / "dem_fabdem.tif", arr, transform=grid.transform, crs=grid.crs, nodata=DEM_NODATA,
                    predictor=3, overview_resampling="average", tags={"units": "m", "vertical_datum": "EGM2008"})
    rec["outputs"].append(output_record(cog, units="m", vertical_datum="EGM2008"))
    _dem_display(rec, cog, out, region, "dem_fabdem")
    return rec


# ---------------------------------------------------------------- land cover
IO_CLASSES = {1: "Water", 2: "Trees", 4: "Flooded vegetation", 5: "Crops", 7: "Built area", 8: "Bare ground",
              9: "Snow/ice", 10: "Clouds", 11: "Rangeland"}
WC_CLASSES = {10: "Tree cover", 20: "Shrubland", 30: "Grassland", 40: "Cropland", 50: "Built-up",
              60: "Bare / sparse vegetation", 70: "Snow and ice", 80: "Permanent water bodies",
              90: "Herbaceous wetland", 95: "Mangroves", 100: "Moss and lichen"}


def _utm_zone_bands(bbox):
    letters = "CDEFGHJKLMNPQRSTUVWX"
    out = set()
    for lon in np.linspace(bbox[0], bbox[2], 5):
        for lat in np.linspace(bbox[1], bbox[3], 5):
            out.add(f"{int((lon + 180) // 6) + 1:02d}{letters[int((lat + 80) // 8)]}")
    return sorted(out)


def _colormap(path):
    with rasterio.open(path) as src:
        try:
            return {k: v[:3] for k, v in src.colormap(1).items()}
        except ValueError:
            return None


def io_lulc(region: dict, out: Path) -> dict:
    rec = _rec("io-lulc-annual", "v02")
    zones = _utm_zone_bands(region["bbox"])
    years = []
    for y in range(2017, 2031):
        urls = [f"{S3_IO}/{int(z[:2])}{z[2]}_{y}.tif" for z in zones]
        if all(url_exists(u) for u in urls):
            years.append((y, urls))
    if not years:
        raise RuntimeError("no IO LULC years found")
    grid = region_grid(region, 10)
    palette = _colormap(f"/vsicurl/{years[-1][1][0]}")
    for y, urls in years:
        arr = warp_to_grid([f"/vsicurl/{u}" for u in urls], grid, dtype="uint8", nodata=0, resampling=Resampling.nearest)
        cog = write_cog(out / f"lulc_io_{y}.tif", arr, transform=grid.transform, crs=grid.crs, nodata=0,
                        colormap=palette, overview_resampling="mode", tags={"classes": str(IO_CLASSES)})
        rec["sources"] += urls
        rec["outputs"].append(output_record(cog, year=y, classes=IO_CLASSES))
    rec["steps"].append({"op": "mosaic+reproject", "tool": "rasterio/GDAL warp", "params": {
        "dst_crs": str(grid.crs), "res_m": 10, "resampling": "nearest", "years": [y for y, _ in years]}})
    rec["version"] = f"v02, years {years[0][0]}–{years[-1][0]} (newest available on AWS at access time)"
    latest = out / f"lulc_io_{years[-1][0]}.tif"
    pm = render_pmtiles(latest, out / "lulc_io_latest.pmtiles", bbox=region["bbox"], minzoom=7, maxzoom=14,
                        render=palette_render({k: palette[k] for k in IO_CLASSES}), resampling=Resampling.nearest,
                        metadata={"year": years[-1][0]})
    rec["display"].append(output_record(pm, kind="raster", year=years[-1][0], legend={
        str(k): {"label": v, "color": "#%02x%02x%02x" % palette[k]} for k, v in IO_CLASSES.items() if k not in (9, 10)}))
    return rec


def worldcover(region: dict, out: Path) -> dict:
    rec = _rec("esa-worldcover-2021", "v200")
    urls = []
    for lon, lat in _cells(region["bbox"], 3.0):
        name = f"{'S' if lat < 0 else 'N'}{abs(int(lat)):02d}{'W' if lon < 0 else 'E'}{abs(int(lon)):03d}"
        urls.append(f"{S3_WC}/ESA_WorldCover_10m_2021_v200_{name}_Map.tif")
    rec["sources"] = urls
    grid = region_grid(region, 10)
    arr = warp_to_grid([f"/vsicurl/{u}" for u in urls], grid, dtype="uint8", nodata=0, resampling=Resampling.nearest)
    palette = _colormap(f"/vsicurl/{urls[0]}") or {}
    rec["steps"].append({"op": "mosaic+reproject", "tool": "rasterio/GDAL warp", "params": {
        "dst_crs": str(grid.crs), "res_m": 10, "resampling": "nearest"}})
    cog = write_cog(out / "lulc_worldcover_2021.tif", arr, transform=grid.transform, crs=grid.crs, nodata=0,
                    colormap=palette or None, overview_resampling="mode")
    rec["outputs"].append(output_record(cog, year=2021, classes=WC_CLASSES))
    pm = render_pmtiles(cog, out / "lulc_worldcover_2021.pmtiles", bbox=region["bbox"], minzoom=7, maxzoom=14,
                        render=palette_render({k: palette[k] for k in WC_CLASSES}), resampling=Resampling.nearest)
    rec["display"].append(output_record(pm, kind="raster", year=2021, legend={
        str(k): {"label": v, "color": "#%02x%02x%02x" % palette[k]} for k, v in WC_CLASSES.items() if k not in (70, 100)}))
    return rec


# ---------------------------------------------------------------- water
def gsw_occurrence(region: dict, out: Path) -> dict:
    rec = _rec("jrc-gsw", "v1.4 (1984–2021)")
    urls = []
    for lon, lat in _cells(region["bbox"], 10.0):
        top = int(lat) + 10
        urls.append(f"{GCS_GSW}/occurrence_{abs(int(lon))}{'W' if lon < 0 else 'E'}_{abs(top)}{'S' if top < 0 else 'N'}v1_4_2021.tif")
    rec["sources"] = urls
    grid = region_grid(region, 30)
    arr = warp_to_grid([f"/vsicurl/{u}" for u in urls], grid, dtype="uint8", nodata=255, resampling=Resampling.nearest)
    rec["steps"].append({"op": "mosaic+reproject", "tool": "rasterio/GDAL warp", "params": {
        "dst_crs": str(grid.crs), "res_m": 30, "resampling": "nearest"}})
    cog = write_cog(out / "water_gsw_occurrence.tif", arr, transform=grid.transform, crs=grid.crs, nodata=255,
                    overview_resampling="nearest", tags={"units": "percent of valid observations 1984-2021"})
    rec["outputs"].append(output_record(cog, units="%"))
    ramp = [(0, (0, 0, 0, 0)), (1, (189, 215, 238, 140)), (50, (66, 146, 198, 220)), (100, (8, 48, 107, 255))]
    pm = render_pmtiles(cog, out / "water_gsw_occurrence.pmtiles", bbox=region["bbox"], minzoom=7, maxzoom=12,
                        render=ramp_render(ramp), resampling=Resampling.nearest)
    rec["display"].append(output_record(pm, kind="raster", ramp=ramp, units="%"))
    return rec


OSM_FILTERS = ["nwr/natural=water,wetland", "nwr/water", "nwr/landuse=reservoir,basin",
               "w/waterway=river,riverbank,canal,stream,drain,ditch"]


def _fetch_osm_water(bbox) -> tuple[Path, str | None, dict]:
    """Geofabrik Java extract → osmium bbox extract → water tags only. Returns (file, snapshot time, step record)."""
    import hashlib
    import subprocess

    td = Path(tempfile.mkdtemp())
    java = download(GEOFABRIK_JAVA, td / "java.osm.pbf")
    md5 = http_get(GEOFABRIK_JAVA + ".md5").text.split()[0]
    h = hashlib.md5()
    with open(java, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    if h.hexdigest() != md5:
        raise RuntimeError("Geofabrik md5 mismatch")
    snap = subprocess.run(["osmium", "fileinfo", "-g", "header.option.osmosis_replication_timestamp", str(java)],
                          capture_output=True, text=True).stdout.strip() or None
    part = td / "region.osm.pbf"
    bb = ",".join(str(x) for x in bbox)
    subprocess.run(["osmium", "extract", "-b", bb, "--strategy", "smart", "-o", str(part), str(java)], check=True)
    water = td / "water.osm.pbf"
    subprocess.run(["osmium", "tags-filter", "-o", str(water), str(part), *OSM_FILTERS], check=True)
    java.unlink()
    step = {"op": "osmium extract + tags-filter", "tool": "osmium-tool",
            "params": {"source_md5": md5, "bbox": bbox, "strategy": "smart", "filters": OSM_FILTERS}}
    return water, snap, step


def osm_water(region: dict, out: Path) -> dict:
    import geopandas as gpd
    import pandas as pd
    import pyogrio

    rec = _rec("osm-water", "Geofabrik extract")
    tmp, snapshot, step = _fetch_osm_water(region["bbox"])
    rec["version"] = f"OSM snapshot {snapshot}"
    rec["sources"] = [GEOFABRIK_JAVA]
    rec["steps"].append(step)
    domain = load_domain(region)
    areas = pyogrio.read_dataframe(tmp, layer="multipolygons")
    lines = pyogrio.read_dataframe(tmp, layer="lines")
    areas = areas[areas.intersects(domain)]
    lines = lines[lines.intersects(domain)]
    rec["steps"].append({"op": "keep features intersecting the region domain"})
    tags = areas.get("other_tags", pd.Series([""] * len(areas))).fillna("")
    water_tag = tags.str.extract(r'"water"=>"([^"]+)"')[0]
    areas["kind"] = np.select(
        [areas["natural"].eq("wetland"), areas["landuse"].isin(["reservoir", "basin"]), water_tag.notna()],
        ["wetland", areas["landuse"].fillna(""), water_tag.fillna("")], default="water")
    areas = areas[areas["natural"].isin(["water", "wetland"]) | areas["landuse"].isin(["reservoir", "basin"]) | water_tag.notna()]
    lines = lines[lines["waterway"].isin(["river", "canal", "stream", "drain", "ditch"])].copy()
    lines["kind"] = lines["waterway"]
    keep = ["osm_id", "osm_way_id", "name", "kind", "geometry"]
    areas = areas[[c for c in keep if c in areas.columns]].copy()
    lines = lines[[c for c in keep if c in lines.columns]].copy()
    region_crs = region["crs"]
    areas_m = areas.to_crs(region_crs)
    areas["area_m2"] = areas_m.area.round(1)
    lines["length_m"] = lines.to_crs(region_crs).length.round(1)
    gpkg = out / "water_osm.gpkg"
    pyogrio.write_dataframe(areas, gpkg, layer="water_areas", driver="GPKG")
    pyogrio.write_dataframe(lines, gpkg, layer="waterways", driver="GPKG", append=True)
    rec["outputs"].append(output_record(gpkg, layers={"water_areas": len(areas), "waterways": len(lines)},
                                        smallest_area_m2=float(areas["area_m2"].min()) if len(areas) else None))
    both = gpd.GeoDataFrame(pd.concat([areas.assign(geom="area"), lines.assign(geom="line")], ignore_index=True),
                            crs="EPSG:4326")[["name", "kind", "geom", "geometry"]]
    pm = out / "water_osm.pmtiles"
    pyogrio.write_dataframe(both, pm, driver="PMTiles", layer="water", geometry_type="Unknown",
                            dataset_options={"MINZOOM": 8, "MAXZOOM": 14, "NAME": "OSM water"})
    rec["display"].append(output_record(pm, kind="vector", layer="water", minzoom=8, maxzoom=14))
    return rec


# ---------------------------------------------------------------- buildings
def overture_buildings(region: dict, out: Path, release: str | None = None) -> dict:
    import geopandas as gpd
    import pandas as pd
    import pyarrow as pa
    import pyarrow.compute as pc
    import pyarrow.dataset as ds
    import pyarrow.parquet as pq_mod
    import pyarrow.fs as pafs
    import pyogrio
    import shapely

    if release is None:
        listing = http_get(f"https://{S3_OVERTURE}.s3.us-west-2.amazonaws.com/",
                           params={"list-type": "2", "prefix": "release/", "delimiter": "/"}).text
        release = sorted(re.findall(r"<Prefix>release/([^<]+)/</Prefix>", listing))[-1]
    rec = _rec("overture-buildings", release)
    path = f"{S3_OVERTURE}/release/{release}/theme=buildings/type=building/"
    rec["sources"] = [f"s3://{path}"]
    fs = pafs.S3FileSystem(anonymous=True, region="us-west-2")
    dset = ds.dataset(path, filesystem=fs, format="parquet")
    w, s, e, n = region["bbox"]
    flt = ((pc.field("bbox", "xmin") < e) & (pc.field("bbox", "xmax") > w) &
           (pc.field("bbox", "ymin") < n) & (pc.field("bbox", "ymax") > s))
    cols = ["id", "geometry", "height", "num_floors", "class", "sources"]
    domain = load_domain(region)
    shapely.prepare(domain)
    pq = out / "buildings_overture.parquet"
    writer, rows, kept, parts = None, 0, 0, []
    # streamed in record batches: the full-table read ran the runner out of memory
    for batch in dset.to_batches(columns=cols, filter=flt, batch_size=100_000):
        rows += batch.num_rows
        geoms = shapely.from_wkb(batch.column("geometry").to_numpy(zero_copy_only=False))
        inside = shapely.intersects(domain, geoms)
        if not inside.any():
            continue
        src = [x[0]["dataset"] if x else None for x in batch.column("sources").to_pylist()]
        part = gpd.GeoDataFrame({"id": batch.column("id").to_numpy(zero_copy_only=False),
                                 "height": batch.column("height").to_numpy(zero_copy_only=False),
                                 "num_floors": batch.column("num_floors").to_numpy(zero_copy_only=False),
                                 "class": batch.column("class").to_numpy(zero_copy_only=False),
                                 "source": src}, geometry=geoms, crs="EPSG:4326")[inside]
        tbl = pa.Table.from_pandas(part.to_wkb(), preserve_index=False)
        if writer is None:  # GeoParquet 1.0 metadata (WKB, OGC:CRS84); geometry_types left open
            geo = {"version": "1.0.0", "primary_column": "geometry",
                   "columns": {"geometry": {"encoding": "WKB", "geometry_types": [], "crs": part.crs.to_json_dict()}}}
            schema = tbl.schema.with_metadata({b"geo": json.dumps(geo).encode()})
            writer = pq_mod.ParquetWriter(pq, schema, compression="zstd")
        writer.write_table(tbl.cast(schema))
        kept += len(part)
        parts.append(part[["height", "source", "geometry"]])
    if writer is None:
        raise RuntimeError("no buildings found in the region")
    writer.close()
    rec["steps"].append({"op": "bbox-filter + domain clip (intersects)", "tool": "pyarrow.dataset (streamed)",
                         "params": {"bbox": region["bbox"], "rows_in_bbox": rows, "rows_in_domain": kept}})
    gdf = gpd.GeoDataFrame(pd.concat(parts, ignore_index=True), crs="EPSG:4326")
    del parts
    counts = gdf["source"].value_counts().to_dict()
    rec["outputs"].append(output_record(pq, features=kept, by_source=counts))
    pm = out / "buildings_overture.pmtiles"
    pyogrio.write_dataframe(gdf[["height", "geometry"]], pm, driver="PMTiles", layer="buildings",
                            dataset_options={"MINZOOM": 14, "MAXZOOM": 14, "NAME": "Overture buildings",
                                             "MAX_SIZE": 2000000, "MAX_FEATURES": 500000})
    rec["display"].append(output_record(pm, kind="vector", layer="buildings", minzoom=14, maxzoom=14))
    return rec


# ---------------------------------------------------------------- population
def worldpop(region: dict, out: Path, year: int = 2025) -> dict:
    rec = _rec("worldpop-global2", f"R2025A v1, year {year}")
    base = f"{WORLDPOP_BASE}/{year}/IDN/v1/100m/constrained/"
    name = re.findall(r'href="([^"]+\.tif)"', http_get(base).text)[0].split("/")[-1]
    url = base + name
    rec["sources"] = [url]
    local = download(url, Path(tempfile.mkdtemp()) / name)  # the host does not support range requests
    with rasterio.open(local) as src:
        win = from_bounds(*region["bbox"], transform=src.transform).round_offsets().round_lengths()
        arr = src.read(1, window=win, boundless=True, fill_value=src.nodata)
        tr = src.window_transform(win)
        nod, crs = src.nodata, src.crs
    rec["steps"].append({"op": "clip (no resampling, counts preserved)", "params": {"bbox": region["bbox"]}})
    cog = write_cog(out / f"population_worldpop_{year}.tif", arr.astype("float32"), transform=tr, crs=crs,
                    nodata=nod, predictor=3, overview_resampling="average", tags={"units": "people per cell"})
    valid = arr[(arr != nod) & np.isfinite(arr)]
    rec["outputs"].append(output_record(cog, units="people per ~100 m cell", total_in_bbox=float(valid.sum())))
    ramp = [(-1, (0, 0, 0, 0)), (0, (255, 245, 235, 0)), (1, (253, 208, 162, 150)), (2, (241, 105, 19, 210)), (2.7, (127, 39, 4, 240))]
    pm = render_pmtiles(cog, out / "population_worldpop.pmtiles", bbox=region["bbox"], minzoom=7, maxzoom=12,
                        render=ramp_render(ramp, transform=lambda x: np.log10(np.maximum(x, 0.1))),
                        resampling=Resampling.nearest)
    rec["display"].append(output_record(pm, kind="raster", ramp=ramp, units="log10 people per cell", year=year))
    return rec


# ---------------------------------------------------------------- admin
def _lfs_url(url: str) -> str:
    """github.com/<o>/<r>/raw/<ref>/<path> (a Git LFS pointer) → media.githubusercontent.com (the file itself)."""
    m = re.match(r"https://github\.com/([^/]+)/([^/]+)/raw/(.+)$", url)
    return f"https://media.githubusercontent.com/media/{m[1]}/{m[2]}/{m[3]}" if m else url


def geoboundaries(region: dict, out: Path) -> dict:
    import geopandas as gpd
    import pandas as pd
    import pyogrio

    rec = _rec("geoboundaries-idn", "gbOpen current")
    frames, meta = [], {}
    for lvl in ("ADM2", "ADM3", "ADM4"):
        try:
            info = http_get(f"{GEOBOUNDARIES}/{lvl}/", retries=2).json()
        except Exception:  # level not published for IDN
            continue
        url = _lfs_url(info["gjDownloadURL"])
        g = gpd.read_file(download(url, Path(tempfile.mkdtemp()) / f"{lvl}.geojson"))
        g = g[g.intersects(load_domain(region))].copy()
        g["level"] = lvl
        frames.append(g[["shapeName", "shapeID", "level", "geometry"]])
        meta[lvl] = {k: info.get(k) for k in ("boundaryID", "boundaryYearRepresented", "boundaryLicense",
                                              "boundarySource", "buildDate", "sourceDataUpdateDate")}
        meta[lvl]["features_in_domain"] = len(g)
        rec["sources"].append(url)
    rec["version"] = "gbOpen: " + ", ".join(f"{k} {v.get('boundaryID')}" for k, v in meta.items())
    rec["steps"].append({"op": "select features intersecting the region domain", "params": {"levels": list(meta)}})
    allg = gpd.GeoDataFrame(pd.concat(frames, ignore_index=True), crs="EPSG:4326")
    gpkg = out / "admin_geoboundaries.gpkg"
    for i, (lvl, g) in enumerate(allg.groupby("level")):
        pyogrio.write_dataframe(g, gpkg, layer=lvl.lower(), driver="GPKG", append=i > 0)
    rec["outputs"].append(output_record(gpkg, levels=meta))
    pm = out / "admin_geoboundaries.pmtiles"
    pyogrio.write_dataframe(allg, pm, driver="PMTiles", layer="admin",
                            dataset_options={"MINZOOM": 6, "MAXZOOM": 13, "NAME": "geoBoundaries"})
    rec["display"].append(output_record(pm, kind="vector", layer="admin", minzoom=6, maxzoom=13))
    return rec


# ---------------------------------------------------------------- satellite image
SCL_OK = np.array([2, 4, 5, 6, 7, 11])


def _mgrs_squares(bbox):
    m = mgrs.MGRS()
    sq = set()
    for lat in np.arange(bbox[1], bbox[3] + 0.02, 0.02):
        for lon in np.arange(bbox[0], bbox[2] + 0.02, 0.02):
            sq.add(m.toMGRS(float(min(lat, bbox[3])), float(min(lon, bbox[2])), MGRSPrecision=0))
    return sorted(sq)


def _list_prefixes(prefix):
    xml = http_get(S3_S2 + "/", params={"list-type": "2", "prefix": prefix, "delimiter": "/"}).text
    return re.findall(r"<Prefix>([^<]+)</Prefix>", xml)[1:]


def _s2_candidates(square, months):
    zone, band, sq = square[:2], square[2], square[3:]
    items = []
    for y, mo in months:
        for p in _list_prefixes(f"sentinel-s2-l2a-cogs/{int(zone)}/{band}/{sq}/{y}/{mo}/"):
            sid = p.rstrip("/").split("/")[-1]
            try:
                it = http_get(f"{S3_S2}/{p}{sid}.json", retries=2).json()
            except Exception:
                continue
            items.append(it)
    return items


S2_KEYS = {"red": ("red", "B04"), "green": ("green", "B03"), "blue": ("blue", "B02"), "scl": ("scl", "SCL")}


def _s2_assets(item) -> dict | None:
    """COG hrefs for red/green/blue/scl; item JSONs use either common names or band ids. None if any is missing."""
    a = item.get("assets", {})
    out = {}
    for k, names in S2_KEYS.items():
        href = next((a[n]["href"] for n in names if n in a and a[n].get("href", "").endswith(".tif")), None)
        if href is None:
            return None
        out[k] = href
    return out


def sentinel2_composite(region: dict, out: Path, months_back: int = 12, per_tile: int = 6, max_cloud: float = 60.0) -> dict:
    import datetime as dt

    rec = _rec("sentinel-2-l2a", "L2A median composite")
    today = dt.date.today()
    months = [((today.year * 12 + today.month - 1 - k) // 12, (today.year * 12 + today.month - 1 - k) % 12 + 1)
              for k in range(months_back)]
    chosen = []
    for square in _mgrs_squares(region["bbox"]):
        cands = [it for it in _s2_candidates(square, months)
                 if it["properties"]["eo:cloud_cover"] <= max_cloud and _s2_assets(it)]
        cands.sort(key=lambda it: it["properties"]["eo:cloud_cover"])
        chosen += cands[:per_tile]
    if not chosen:
        raise RuntimeError("no Sentinel-2 scenes found")
    grid = region_grid(region, 10)
    rec["sources"] = [{"id": it["id"], "datetime": it["properties"]["datetime"],
                       "cloud_cover": it["properties"]["eo:cloud_cover"],
                       "boa_offset_applied": it["properties"].get("earthsearch:boa_offset_applied")} for it in chosen]
    # scene footprints in grid CRS
    foot = []
    for it in chosen:
        l, b, r, t = transform_bounds("EPSG:4326", grid.crs, *it["bbox"])
        foot.append((l, b, r, t))
    rgb = np.zeros((3, *grid.shape), dtype="uint8")
    blk = 1024
    gl, gb, gr, gt = grid.bounds
    for row in range(0, grid.height, blk):
        for col in range(0, grid.width, blk):
            h, w = min(blk, grid.height - row), min(blk, grid.width - col)
            bl = gl + col * 10
            bt = gt - row * 10
            bounds = (bl, bt - h * 10, bl + w * 10, bt)
            stack, raw = [], []
            for it, f in zip(chosen, foot):
                if f[0] >= bounds[2] or f[2] <= bounds[0] or f[1] >= bounds[3] or f[3] <= bounds[1]:
                    continue
                a = _s2_assets(it)
                bands = []
                for key in ("red", "green", "blue"):
                    with rasterio.open(f"/vsicurl/{a[key]}") as src:
                        win = from_bounds(*bounds, transform=src.transform).round_offsets().round_lengths()
                        bands.append(src.read(1, window=win, out_shape=(h, w), boundless=True, fill_value=0).astype("float32"))
                with rasterio.open(f"/vsicurl/{a['scl']}") as src:
                    win = from_bounds(*bounds, transform=src.transform)
                    scl = src.read(1, window=win, out_shape=(h, w), boundless=True, fill_value=0,
                                   resampling=Resampling.nearest)
                off = 0.0 if it["properties"].get("earthsearch:boa_offset_applied", True) else (
                    1000.0 if float(it["properties"].get("s2:processing_baseline", "0")) >= 4.0 else 0.0)
                st = np.stack(bands) - off
                has = bands[0] > 0
                r_ = st.copy()
                r_[:, ~has] = np.nan
                raw.append(r_)
                st[:, ~(np.isin(scl, SCL_OK) & has)] = np.nan
                stack.append(st)
            if not stack:
                continue
            with np.errstate(all="ignore"):
                import warnings
                warnings.simplefilter("ignore", RuntimeWarning)
                med = np.nanmedian(np.stack(stack), axis=0)
                gap = np.isnan(med)
                if gap.any():  # always-cloudy pixels: fall back to the unmasked minimum (darkest = least cloud)
                    med[gap] = np.nanmin(np.stack(raw), axis=0)[gap]
            med = med / 10000.0
            vis = np.clip(med / 0.25, 0, 1) ** (1 / 1.5) * 255
            vis = np.nan_to_num(vis, nan=0)
            rgb[:, row:row + h, col:col + w] = vis.astype("uint8")
    rec["steps"].append({"op": "cloud-masked median composite", "params": {
        "scenes": len(chosen), "per_mgrs_tile": per_tile, "max_scene_cloud_pct": max_cloud,
        "months_back": months_back, "scl_valid_classes": SCL_OK.tolist(),
        "stretch": "reflectance/0.25 clipped, gamma 1/1.5, 8-bit", "res_m": 10, "dst_crs": str(grid.crs)}})
    cog = write_cog(out / "imagery_s2_rgb.tif", rgb, transform=grid.transform, crs=grid.crs, nodata=0,
                    compress="JPEG", quality=88, overview_resampling="average")
    rec["outputs"].append(output_record(cog, bands="RGB (B04,B03,B02) 8-bit visual"))
    imagery_display(rec, cog, out, region)
    return rec


def imagery_display(rec: dict, cog: Path, out: Path, region: dict) -> None:
    """Sentinel-2 display tiles. z14 pixels (9.5 m) are finer than the 10 m source: Lanczos there keeps the detail an
    averaging kernel blurs away (verification/data-checks: local contrast kept 0.83 with average/WebP 82, 1.00 with
    Lanczos/WebP 92). Lower zooms are downsampled and keep the averaging kernel."""
    pm = render_pmtiles(cog, out / "imagery_s2.pmtiles", bbox=region["bbox"], minzoom=7, maxzoom=14,
                        render=rgb_render, fmt="webp", resampling=Resampling.average,
                        max_resampling=Resampling.lanczos, quality=92)
    rec["display"] = [r for r in rec.get("display", []) if r.get("file") != pm.name]
    rec["display"].append(output_record(pm, kind="raster", format="webp", resampling="average; lanczos at z14", webp_quality=92))


LAYERS = {
    "dem": [copernicus_dem, fabdem],
    "landcover": [io_lulc, worldcover],
    "water": [osm_water, gsw_occurrence],
    "buildings": [overture_buildings],
    "people": [worldpop, geoboundaries],
    "imagery": [sentinel2_composite],
}

# catalog id per builder (used to label failures)
for _fn, _id in [(copernicus_dem, "copernicus-glo30"), (fabdem, "fabdem"), (io_lulc, "io-lulc-annual"),
                 (worldcover, "esa-worldcover-2021"), (osm_water, "osm-water"), (gsw_occurrence, "jrc-gsw"),
                 (overture_buildings, "overture-buildings"), (worldpop, "worldpop-global2"),
                 (geoboundaries, "geoboundaries-idn"), (sentinel2_composite, "sentinel-2-l2a")]:
    _fn.dataset = _id
