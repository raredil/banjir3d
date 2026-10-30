"""Engine pack: everything the flood engine reads, derived only from mapped data (no hand-set numbers).

Inputs (region pack release + open cloud data):
  dem_fabdem.tif (30 m, EPSG:32748), lulc_io_<newest>.tif (10 m), water_osm.gpkg (OSM rivers, canals, river polygons),
  Copernicus GLO-90 (upstream catchments outside the region), IO LULC newest year (upstream land cover), SoilGrids 2.0 sand and clay.
Outputs (out dir):
  engine_<region>.bin.gz  one gzip file: 4-byte header length, JSON header, then the arrays listed in the header
  engine_<region>.json    the same header (provenance, parameters, checks) for people and the Data catalog
Method (data/methods/methods.md, sections 3 to 5):
  1. Model grid = FABDEM grid (30 m UTM 48S).
  2. Channels: OSM river and canal polygons plus river, canal and stream centre lines are rasterised. Channel cells take the lowest
     DEM value within one cell (the mapped water surface); along each centre line, humps narrower than 150 m (bridges, culverts,
     embankments the DEM keeps as dams) are removed with a 1-D morphological opening. No depth is added: the channel volume below
     the water surface seen by the DEM is taken as already filled by base flow.
  3. Sea: water pixels at or below 0.5 m connected to the north edge; held at the chosen sea level during a run.
  4. Manning n and SCS curve number per cell from the 10 m land-cover pixels and the soil group (data/engine/landcover-parameters.json).
  5. Upstream: D8 flow on GLO-90 (pysheds) over a box that holds every catchment draining into the region; for each channel cell the
     stream cells (>= 1 km2) are stored with their downstream cell, upstream area, area-mean CN and slope and longest flow path,
     so the engine finds every stream that enters a run area and turns rain over its catchment into inflow (NRCS CN + unit hydrograph).
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import time
from pathlib import Path

import numpy as np
import rasterio
from rasterio import features
from rasterio.enums import Resampling
from rasterio.warp import reproject, transform_bounds

ROOT = Path(__file__).resolve().parents[1]
PARAMS = json.loads((ROOT / "data/engine/landcover-parameters.json").read_text())
UPSTREAM_BOX = (106.35, -7.0, 107.35, -5.95)  # lon/lat: holds the Cisadane, Ciliwung, Angke, Pesanggrahan, Sunter and Bekasi catchments
GLO90 = "https://copernicus-dem-90m.s3.amazonaws.com/Copernicus_DSM_COG_30_{t}_DEM/Copernicus_DSM_COG_30_{t}_DEM.tif"
IO_URL = "https://io-10m-annual-lulc.s3.amazonaws.com/48M_{y}.tif"
SOILGRIDS = "/vsicurl/https://files.isric.org/soilgrids/latest/data/{p}/{p}_{d}_mean.vrt"
SOIL_DEPTHS = [("0-5cm", 5), ("5-15cm", 10), ("15-30cm", 15), ("30-60cm", 30), ("60-100cm", 40)]
HSG = ["A", "B", "C", "D"]
OVERTURE_RELEASE = "2026-10-21.0"  # same release as the buildings layer
ROUTE_BURN_M = 20.0  # routing-only burn depth; larger than GLO-90 noise in flat land, never used for hydraulics
STREAM_KM2 = 1.0  # D8 cells draining at least this area form the stream network used for inflows
OPEN_CELLS = 5  # 150 m: wider humps on a channel are treated as real terrain
Z_OFFSET = 20.0  # stored elevation = (z + 20 m) in cm as uint16 (range -20 m to 635 m)


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def hsg_from_texture(sand: np.ndarray, clay: np.ndarray) -> np.ndarray:
    """Hydrologic soil group index 0..3 (A..D) from percent sand and clay (rules in landcover-parameters.json)."""
    g = np.full(sand.shape, 2, np.uint8)  # C
    g[(clay < 20) & (sand >= 50)] = 1  # B
    g[(clay < 10) & (sand > 90)] = 0  # A
    g[clay >= 40] = 3  # D
    return g


def soil_groups(dst_transform, dst_shape, crs, source: str) -> tuple[np.ndarray, dict]:
    """HSG on a target grid. source 'soilgrids' reads SoilGrids 2.0 over HTTP; 'placeholder:D' is for offline development only."""
    if source.startswith("placeholder"):
        return np.full(dst_shape, HSG.index(source.split(":")[1]), np.uint8), {"source": source, "WARNING": "placeholder soil group, not for use"}
    acc = {"sand": np.zeros(dst_shape), "clay": np.zeros(dst_shape)}
    urls = []
    for p in ("sand", "clay"):
        for d, w in SOIL_DEPTHS:
            url = SOILGRIDS.format(p=p, d=d)
            urls.append(url.replace("/vsicurl/", ""))
            with rasterio.open(url) as src:
                out = np.zeros(dst_shape, np.float32)
                reproject(rasterio.band(src, 1), out, dst_transform=dst_transform, dst_crs=crs, resampling=Resampling.bilinear, dst_nodata=np.nan)
            acc[p] += np.nan_to_num(out, nan=np.nan) * w / 10.0  # g/kg -> %
    sand, clay = acc["sand"] / 100.0, acc["clay"] / 100.0  # depth-weighted mean over 0-100 cm
    bad = ~np.isfinite(sand) | ~np.isfinite(clay) | (sand + clay <= 0)
    g = hsg_from_texture(np.nan_to_num(sand), np.nan_to_num(clay))
    g[bad] = 255
    if (g != 255).any():
        fill = np.bincount(g[g != 255], minlength=4).argmax()
        g[g == 255] = fill  # water/urban gaps in SoilGrids: most common group of the area
    return g, {"source": "SoilGrids 2.0 (Poggio et al. 2021)", "urls": urls, "depth_weighting": "0-100 cm, by layer thickness",
               "share": {HSG[i]: round(float((g == i).mean()), 4) for i in range(4)}}


def class_tables():
    codes = sorted(int(k) for k in PARAMS["classes"])
    n = np.zeros(256, np.float64)
    cn = np.zeros((4, 256), np.float64)
    valid = np.zeros(256, bool)
    for c in codes:
        e = PARAMS["classes"][str(c)]
        n[c] = e["n"]
        valid[c] = True
        for i, g in enumerate(HSG):
            cn[i, c] = e["cn"][g]
    return n, cn, valid


def lc_to_n_cn(lc: np.ndarray, hsg_fine: np.ndarray, f: int) -> tuple[np.ndarray, np.ndarray, dict]:
    """Aggregate f x f land-cover pixels to model cells: area-weighted n and CN (unclassified pixels excluded)."""
    ntab, cntab, valid = class_tables()
    H, W = lc.shape[0] // f, lc.shape[1] // f
    lc = lc[: H * f, : W * f]
    hs = hsg_fine[: H * f, : W * f]
    ok = valid[lc]
    nv = np.where(ok, ntab[lc], 0.0)
    cv = np.where(ok, cntab[hs, lc], 0.0)
    blk = lambda a: a.reshape(H, f, W, f).sum(axis=(1, 3))
    cnt = blk(ok.astype(np.float64))
    built = PARAMS["classes"]["7"]
    n = np.where(cnt > 0, blk(nv) / np.maximum(cnt, 1), built["n"])
    cn = np.where(cnt > 0, blk(cv) / np.maximum(cnt, 1), 98.0)
    share = {PARAMS["classes"][str(c)]["label"]: round(float((lc == c).mean()), 4) for c in range(256) if valid[c]}
    return n, cn, share


def burn_channels(z: np.ndarray, transform, crs, water_gpkg: Path) -> tuple[np.ndarray, np.ndarray, dict]:
    import geopandas as gpd
    from scipy import ndimage as nd

    areas = gpd.read_file(water_gpkg, layer="water_areas").to_crs(crs)
    lines = gpd.read_file(water_gpkg, layer="waterways").to_crs(crs)
    chan_areas = areas[areas["kind"].isin(["river", "canal"])]
    chan_lines = lines[lines["kind"].isin(["river", "canal", "stream"])]
    shape = z.shape
    poly = features.rasterize(((g, 1) for g in chan_areas.geometry), out_shape=shape, transform=transform, all_touched=False, dtype="uint8")
    line = features.rasterize(((g, 1) for g in chan_lines.geometry), out_shape=shape, transform=transform, all_touched=True, dtype="uint8")
    chan = (poly > 0) | (line > 0)
    zmin = nd.minimum_filter(z, size=3)
    zc = z.copy()
    zc[chan] = np.minimum(z[chan], zmin[chan])
    # Obstructions on mapped channels: a 1-D morphological opening along each centre line (window OPEN_CELLS) removes humps
    # narrower than the window (bridges, culverts, road embankments kept by the DEM). Independent of the line direction.
    inv = ~transform
    rows, cols = shape
    lowered = np.zeros(shape, bool)
    for g in chan_lines.geometry:
        for part in getattr(g, "geoms", [g]):
            L = part.length
            if L <= 0:
                continue
            idx = []
            for d in np.linspace(0, L, max(2, int(L / 10.0) + 1)):
                p = part.interpolate(d)
                c, r = inv * (p.x, p.y)
                r, c = int(r), int(c)
                if 0 <= r < rows and 0 <= c < cols and (not idx or idx[-1] != (r, c)):
                    idx.append((r, c))
            if len(idx) < OPEN_CELLS:
                continue
            ri = np.array([i[0] for i in idx]); ci = np.array([i[1] for i in idx])
            prof = zc[ri, ci]
            opened = nd.maximum_filter1d(nd.minimum_filter1d(prof, OPEN_CELLS, mode="nearest"), OPEN_CELLS, mode="nearest")
            lower = opened < prof
            zc[ri[lower], ci[lower]] = opened[lower]
            lowered[ri[lower], ci[lower]] = True
    fixed = int(lowered.sum())
    info = {"channel_cells": int(chan.sum()), "polygons": int(len(chan_areas)), "lines": int(len(chan_lines)),
            "cells_opened": fixed, "opening_window_cells": OPEN_CELLS,
            "mean_lowering_m": round(float((z - zc)[chan].mean()), 3), "max_lowering_m": round(float((z - zc).max()), 2)}
    return zc, chan, info


def sea_mask(z: np.ndarray, lc_cell_water: np.ndarray) -> np.ndarray:
    from scipy import ndimage as nd

    cand = lc_cell_water & (z <= 0.5)
    lab, _ = nd.label(cand)
    top = np.setdiff1d(np.unique(lab[:3]), [0])  # first rows: land cover may start a little below the DEM edge
    return np.isin(lab, top)


def read_io_window(year: int, dst_transform, dst_shape, crs) -> np.ndarray:
    with rasterio.open(IO_URL.format(y=year)) as src:
        out = np.zeros(dst_shape, np.uint8)
        reproject(rasterio.band(src, 1), out, dst_transform=dst_transform, dst_crs=crs, resampling=Resampling.nearest)
    return out


def upstream(crs, soil: str, io_year: int, res: float = 90.0) -> tuple[dict, dict]:
    """D8 upstream properties on GLO-90 over UPSTREAM_BOX, in UTM. Returns arrays + transform and provenance."""
    from pysheds.grid import Grid
    from pysheds.sview import Raster, ViewFinder

    l, b, r, t = transform_bounds("EPSG:4326", crs, *UPSTREAM_BOX)
    W, H = int((r - l) / res), int((t - b) / res)
    tr = rasterio.transform.from_origin(l, t, res, res)
    dem = np.full((H, W), np.nan, np.float32)
    tiles = ["S07_00_E106_00", "S07_00_E107_00", "S06_00_E106_00", "S06_00_E107_00"]
    for tname in tiles:
        with rasterio.open(GLO90.format(t=tname)) as src:
            out = np.full((H, W), np.nan, np.float32)
            reproject(rasterio.band(src, 1), out, dst_transform=tr, dst_crs=crs, resampling=Resampling.bilinear, src_nodata=src.nodata, dst_nodata=np.nan)
            dem = np.where(np.isnan(dem), out, dem)
    dem = np.where(np.isfinite(dem), dem, 0.0)  # sea
    # Stream burning for routing only (Saunders 1999; Lindsay 2016): mapped rivers, streams and canals (Overture base/water,
    # from OSM; canals excluded because they cross divides) are lowered by ROUTE_BURN_M so D8 follows the mapped network in flat land where a DSM alone misroutes water.
    lines, wsrc = overture_waterways(UPSTREAM_BOX)
    burn = features.rasterize(((g, 1) for g in lines.to_crs(crs).geometry), out_shape=dem.shape, transform=tr, all_touched=True, dtype="uint8") > 0
    dem_route = np.where(burn, dem - ROUTE_BURN_M, dem)
    import pyproj

    if not hasattr(np, "in1d"):  # pysheds 0.4 still calls the numpy < 2.4 name
        np.in1d = np.isin
    vf = ViewFinder(affine=tr, shape=dem.shape, crs=pyproj.Proj(str(crs)), nodata=np.float64(-9999.0))
    grid = Grid(viewfinder=vf)
    rdem = Raster(dem_route.astype(np.float64), viewfinder=vf)
    filled = grid.resolve_flats(grid.fill_depressions(grid.fill_pits(rdem)))
    dirmap = (64, 128, 1, 2, 4, 8, 16, 32)
    fdir = grid.flowdir(filled, dirmap=dirmap)
    lc = read_io_window(io_year, tr, (H, W), crs)
    hsg, soil_info = soil_groups(tr, (H, W), crs, soil)
    _, cntab, valid = class_tables()
    cn = np.where(valid[lc], cntab[hsg, lc], 98.0)
    gy, gx = np.gradient(dem, res)
    slope = np.hypot(gx, gy) * 100.0  # percent
    acc, acc_cn, acc_sl, length, down = d8_accumulate(np.asarray(fdir), dirmap, res, cn, slope)
    cell_km2 = res * res / 1e6
    props = {"down": down, "transform": tr, "acc": acc, "area_km2": acc * cell_km2, "cn": acc_cn / acc, "slope_pct": acc_sl / acc, "length_m": length, "dem": dem}
    info = {"dem": "Copernicus GLO-90 (AWS public copy)", "tiles": [GLO90.format(t=x) for x in tiles], "box_lonlat": UPSTREAM_BOX, "res_m": res,
            "routing_burn": {"source": wsrc, "lines": int(len(lines)), "cells": int(burn.sum()), "depth_m": ROUTE_BURN_M},
            "method": "pysheds: fill pits, fill depressions, resolve flats, D8 directions; own topological pass: upstream area, area-mean CN and slope, longest flow path",
            "landcover": IO_URL.format(y=io_year), "soil": soil_info}
    return props, info


def overture_waterways(box):
    """Rivers and streams (not canals, drains or ditches) from the Overture Maps base/water theme (OpenStreetMap data)."""
    import geopandas as gpd
    import pyarrow.compute as pc
    import pyarrow.dataset as ds
    import pyarrow.fs as pafs
    import shapely

    path = f"overturemaps-us-west-2/release/{OVERTURE_RELEASE}/theme=base/type=water/"
    d = ds.dataset(path, filesystem=pafs.S3FileSystem(anonymous=True, region="us-west-2"), format="parquet")
    W, S, E, N = box
    f = (pc.field("bbox", "xmin") < E) & (pc.field("bbox", "xmax") > W) & (pc.field("bbox", "ymin") < N) & (pc.field("bbox", "ymax") > S)
    tb = d.to_table(columns=["id", "class", "geometry"], filter=f & pc.field("class").isin(["river", "stream"]))
    geom = shapely.from_wkb(tb.column("geometry").to_numpy(zero_copy_only=False))
    gdf = gpd.GeoDataFrame({"class": tb.column("class").to_pylist()}, geometry=geom, crs="EPSG:4326")
    gdf = gdf[gdf.geom_type.isin(["LineString", "MultiLineString"])]
    return gdf, {"dataset": "Overture Maps base/water", "release": OVERTURE_RELEASE, "s3": "s3://" + path, "classes": ["river", "stream"], "excluded": "canals (irrigation and flood canals cross catchment divides; they would merge basins in D8 routing)"}


def d8_accumulate(fdir: np.ndarray, dirmap, res: float, cn: np.ndarray, slope: np.ndarray):
    """Topological D8 pass (Kahn order): upstream cell count, CN sum, slope sum and longest flow length (m) per cell."""
    H, W = fdir.shape
    offs = {dirmap[0]: (-1, 0), dirmap[1]: (-1, 1), dirmap[2]: (0, 1), dirmap[3]: (1, 1), dirmap[4]: (1, 0), dirmap[5]: (1, -1), dirmap[6]: (0, -1), dirmap[7]: (-1, -1)}
    rr, cc = np.indices((H, W))
    down = np.full(H * W, -1, np.int64)
    step = np.zeros(H * W)
    for code, (dr, dc) in offs.items():
        m = fdir == code
        r2, c2 = rr[m] + dr, cc[m] + dc
        ok = (r2 >= 0) & (r2 < H) & (c2 >= 0) & (c2 < W)
        src = (rr[m] * W + cc[m])[ok]
        down[src] = (r2 * W + c2)[ok]
        step[src] = res * (math.sqrt(2) if dr and dc else 1.0)
    acc = np.ones(H * W)
    acn = cn.ravel().astype(np.float64).copy()
    asl = slope.ravel().astype(np.float64).copy()
    length = np.zeros(H * W)
    indeg = np.bincount(down[down >= 0], minlength=H * W)
    front = np.nonzero(indeg == 0)[0]
    while front.size:
        d = down[front]
        m = d >= 0
        f, d = front[m], d[m]
        np.add.at(acc, d, acc[f])
        np.add.at(acn, d, acn[f])
        np.add.at(asl, d, asl[f])
        np.maximum.at(length, d, length[f] + step[f])
        np.subtract.at(indeg, d, 1)
        front = np.unique(d[indeg[d] == 0])
    return acc.reshape(H, W), acn.reshape(H, W), asl.reshape(H, W), length.reshape(H, W), down


def build(pack: Path, out: Path, region: str, soil: str) -> dict:
    t0 = time.time()
    out.mkdir(parents=True, exist_ok=True)
    years = sorted(int(p.stem.split("_")[-1]) for p in pack.glob("lulc_io_*.tif") if p.stem.split("_")[-1].isdigit())
    io_year = years[-1]
    with rasterio.open(pack / "dem_fabdem.tif") as src:
        z = src.read(1).astype(np.float64)
        tr, crs, shape = src.transform, src.crs, src.shape
    # land cover on the 10 m grid aligned to the model grid (3 x 3 pixels per 30 m cell)
    f = 3
    fine_tr = rasterio.transform.from_origin(tr.c, tr.f, tr.a / f, tr.a / f)
    fine_shape = (shape[0] * f, shape[1] * f)
    lc = np.zeros(fine_shape, np.uint8)
    with rasterio.open(pack / f"lulc_io_{io_year}.tif") as src:
        reproject(rasterio.band(src, 1), lc, dst_transform=fine_tr, dst_crs=crs, resampling=Resampling.nearest)
    hsg_cell, soil_info = soil_groups(tr, shape, crs, soil)
    hsg_fine = np.repeat(np.repeat(hsg_cell, f, axis=0), f, axis=1)
    n, cn, share = lc_to_n_cn(lc, hsg_fine, f)
    water_cell = (lc == 1).reshape(shape[0], f, shape[1], f).mean(axis=(1, 3)) >= 0.5
    zc, chan, chan_info = burn_channels(z, tr, crs, pack / "water_osm.gpkg")
    sea = sea_mask(zc, water_cell)
    chan &= ~sea
    up, up_info = upstream(crs, soil, io_year)
    # Stream network: GLO-90 D8 cells with at least STREAM_KM2 upstream, with their downstream cell (index into the same list).
    acc_km2 = up["area_km2"]
    Hs, Ws = acc_km2.shape
    is_st = acc_km2.ravel() >= STREAM_KM2
    ids = np.nonzero(is_st)[0]
    pos = np.full(Hs * Ws, -1, np.int64)
    pos[ids] = np.arange(len(ids))
    dn = up["down"][ids]
    st_down = np.where(dn >= 0, pos[np.maximum(dn, 0)], -1).astype(np.int32)
    xs, ys = rasterio.transform.xy(up["transform"], ids // Ws, ids % Ws)
    ST_X = np.asarray(xs, np.float64) - tr.c  # metres east of the model grid origin
    ST_Y = tr.f - np.asarray(ys, np.float64)  # metres south of the model grid origin
    import geopandas as gpd

    dom = gpd.read_file(ROOT / "data/regions" / f"{region}_domain.geojson").to_crs(crs)
    inside = features.rasterize(((g, 1) for g in dom.geometry), out_shape=shape, transform=tr, all_touched=True, dtype="uint8") > 0
    flags = np.zeros(shape, np.uint8)
    flags[chan] |= 1
    flags[sea] |= 2
    flags[inside] |= 4
    zq = np.clip(np.round((zc + Z_OFFSET) * 100), 0, 65535).astype(np.uint16)
    arrays = [
        ("z", "uint16", zq), ("n", "uint8", np.clip(np.round(n * 1000), 1, 255).astype(np.uint8)),
        ("cn", "uint8", np.clip(np.round(cn), 1, 100).astype(np.uint8)), ("flags", "uint8", flags),
        ("st_x", "float32", ST_X), ("st_y", "float32", ST_Y), ("st_down", "int32", st_down), ("st_area_km2", "float32", acc_km2.ravel()[ids]),
        ("st_cn", "float32", up["cn"].ravel()[ids]), ("st_slope_pct", "float32", up["slope_pct"].ravel()[ids]), ("st_length_m", "float32", up["length_m"].ravel()[ids]),
    ]
    inputs = {p: sha256(pack / p) for p in ["dem_fabdem.tif", f"lulc_io_{io_year}.tif", "water_osm.gpkg"]}
    lon_lat = lambda x, y: [round(v, 7) for v in rasterio.warp.transform(crs, "EPSG:4326", [x], [y])[0] + rasterio.warp.transform(crs, "EPSG:4326", [x], [y])[1]]
    W_, H_ = shape[1], shape[0]
    corners = [lon_lat(tr.c, tr.f), lon_lat(tr.c + W_ * tr.a, tr.f), lon_lat(tr.c + W_ * tr.a, tr.f + H_ * tr.e), lon_lat(tr.c, tr.f + H_ * tr.e)]
    header = {
        "type": "banjir3d-engine-pack", "version": 1, "region": region, "created": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "grid": {"crs": str(crs), "nx": W_, "ny": H_, "dx": tr.a, "dy": -tr.e, "origin": [tr.c, tr.f], "corners_lonlat": corners},
        "encoding": {"z": f"(z + {Z_OFFSET} m) in cm", "n": "n x 1000", "cn": "curve number", "flags": "bit0 channel, bit1 sea, bit2 inside the region domain polygon", "st_*": "GLO-90 D8 stream cells (>= 1 km2 upstream): centre in metres east/south of the model origin, downstream index (-1 none), upstream area, area-mean CN, mean slope (%), longest flow path (m)"},
        "arrays": [], "inputs_sha256": inputs, "landcover_year": io_year, "landcover_share": share,
        "parameters": PARAMS, "channels": chan_info, "sea": {"cells": int(sea.sum()), "rule": "IO water, z <= 0.5 m, connected to the north edge"},
        "soil": soil_info, "upstream": up_info,
        "checks": {
            "dem_min_m": round(float(zc.min()), 2), "dem_max_m": round(float(zc.max()), 2),
            "n_range": [round(float(n.min()), 3), round(float(n.max()), 3)], "cn_range": [round(float(cn.min()), 1), round(float(cn.max()), 1)],
            "cn_mean_land": round(float(cn[~sea].mean()), 1), "stream_cells": int(len(ids)), "largest_upstream_km2": round(float(acc_km2.max()), 1),
        },
    }
    off = 0
    for name, dt, a in arrays:
        b = a.astype(dt).tobytes()
        header["arrays"].append({"name": name, "dtype": dt, "offset": off, "length": int(a.size)})
        off += len(b)
        off += (-off) % 4  # 4-byte alignment for typed-array views
    hb = json.dumps(header, separators=(",", ":")).encode()
    hb += b" " * ((-len(hb)) % 4)
    raw = bytearray(len(hb).to_bytes(4, "little") + hb)
    for name, dt, a in arrays:
        raw += a.astype(dt).tobytes()
        raw += b"\0" * ((-len(raw)) % 4)
    gz = out / f"engine_{region}.bin.gz"
    with gzip.open(gz, "wb", compresslevel=9) as fh:
        fh.write(bytes(raw))
    header["output"] = {"file": gz.name, "bytes": gz.stat().st_size, "sha256": sha256(gz), "build_seconds": round(time.time() - t0, 1)}
    (out / f"engine_{region}.json").write_text(json.dumps(header, indent=1))
    return header


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("pack", type=Path, help="region pack directory (release files)")
    ap.add_argument("out", type=Path)
    ap.add_argument("--region", default="jakarta")
    ap.add_argument("--soil", default="soilgrids", help="soilgrids | placeholder:D (offline development only)")
    a = ap.parse_args()
    h = build(a.pack, a.out, a.region, a.soil)
    print(json.dumps({k: h[k] for k in ("grid", "channels", "sea", "checks", "output")}, indent=1))
