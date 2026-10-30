"""Exposure pack: buildings, people and kecamatan (sub-district) per engine-pack cell, so the app can count what a flood reaches.

  python pipeline/exposure_pack.py <region pack dir> <out dir> [--region jakarta] [--overture-release 2026-10-21.0]

Inputs: engine_<region>.bin.gz (the 30 m model grid), buildings_overture.parquet and population_worldpop_2025.tif (region pack
release), Overture divisions (division_area, subtype localadmin = kecamatan, county = kota/kabupaten; from OpenStreetMap, ODbL).
Outputs: exposure_<region>.bin.gz (4-byte header length, JSON header, arrays) and exposure_<region>.json (the header).
Method (data/methods/methods.md, section 10):
  1. Buildings: one count per building, in the cell holding its footprint centroid.
  2. People: each WorldPop 100 m count is split evenly over the 30 m cells whose centres fall in that pixel (totals preserved).
  3. Kecamatan: Overture localadmin polygons rasterised on the model grid (cell centre inside); kota from the county holding the
     kecamatan's representative point. Land of a kota without kecamatan polygons (Kota Bekasi) is one unit named after the kota.
"""
from __future__ import annotations

import argparse
import gzip
import json
import re
import time
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer

from b3d.util import http_get, now_utc, sha256

S3_OVERTURE = "overturemaps-us-west-2"


def engine_grid(path: Path) -> tuple[dict, np.ndarray]:
    """Model grid and the inside-the-region-domain mask (flags bit 2) of the engine pack."""
    raw = gzip.decompress(path.read_bytes())
    hl = int.from_bytes(raw[:4], "little")
    h = json.loads(raw[4:4 + hl])
    a = next(d for d in h["arrays"] if d["name"] == "flags")
    flags = np.frombuffer(raw, np.uint8, a["length"], 4 + hl + a["offset"])
    return h["grid"], (flags & 4) > 0


def overture_divisions(bbox, release: str | None):
    import geopandas as gpd
    import pyarrow.compute as pc
    import pyarrow.dataset as ds
    import pyarrow.fs as pafs
    import shapely

    if release is None:
        listing = http_get(f"https://{S3_OVERTURE}.s3.us-west-2.amazonaws.com/",
                           params={"list-type": "2", "prefix": "release/", "delimiter": "/"}).text
        release = sorted(re.findall(r"<Prefix>release/([^<]+)/</Prefix>", listing))[-1]
    fs = pafs.S3FileSystem(anonymous=True, region="us-west-2")
    dset = ds.dataset(f"{S3_OVERTURE}/release/{release}/theme=divisions/type=division_area/", filesystem=fs, format="parquet")
    w, s, e, n = bbox
    flt = ((pc.field("bbox", "xmin") < e) & (pc.field("bbox", "xmax") > w) & (pc.field("bbox", "ymin") < n) & (pc.field("bbox", "ymax") > s)
           & pc.field("subtype").isin(["localadmin", "county"]) & (pc.field("is_land") == True))  # noqa: E712
    t = dset.to_table(columns=["id", "subtype", "names", "region", "sources", "geometry"], filter=flt).to_pylist()
    gdf = gpd.GeoDataFrame({"subtype": [r["subtype"] for r in t], "name": [r["names"]["primary"] for r in t], "province": [r["region"] for r in t],
                            "osm": [(r["sources"] or [{}])[0].get("record_id") for r in t]},
                           geometry=shapely.from_wkb([r["geometry"] for r in t]), crs="EPSG:4326")
    lic = sorted({s.get("license") for r in t for s in (r["sources"] or []) if s.get("license")})
    return gdf, release, lic


def build(pack: Path, out: Path, region: str, release: str | None) -> dict:
    import pyarrow.parquet as pq
    import shapely
    from rasterio.features import rasterize

    t0 = time.time()
    out.mkdir(parents=True, exist_ok=True)
    g, domain = engine_grid(pack / f"engine_{region}.bin.gz")
    nx, ny, dx = g["nx"], g["ny"], g["dx"]
    x0, y0 = g["origin"]
    crs = g["crs"]
    to_utm = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    to_ll = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)

    # 1. buildings by footprint centroid
    bld = np.zeros(nx * ny, np.int64)
    n_b = n_in = 0
    for batch in pq.ParquetFile(pack / "buildings_overture.parquet").iter_batches(columns=["geometry"], batch_size=200_000):
        c = shapely.centroid(shapely.from_wkb(batch.column("geometry").to_numpy(zero_copy_only=False)))
        x, y = to_utm.transform(shapely.get_x(c), shapely.get_y(c))
        i, j = np.floor((x - x0) / dx).astype(np.int64), np.floor((y0 - y) / dx).astype(np.int64)
        ok = (i >= 0) & (j >= 0) & (i < nx) & (j < ny)
        np.add.at(bld, j[ok] * nx + i[ok], 1)
        n_b += len(c); n_in += int(ok.sum())

    # 2. people: WorldPop pixel of each cell centre, count split over the cells sharing the pixel
    with rasterio.open(pack / "population_worldpop_2025.tif") as src:
        wp = src.read(1).astype(np.float64)
        wp[(wp < 0) | ~np.isfinite(wp)] = 0
        wtr = src.transform
    jj, ii = np.mgrid[0:ny, 0:nx]
    lon, lat = to_ll.transform(x0 + (ii.ravel() + 0.5) * dx, y0 - (jj.ravel() + 0.5) * dx)
    pc_, pr = np.floor((np.asarray(lon) - wtr.c) / wtr.a).astype(np.int64), np.floor((np.asarray(lat) - wtr.f) / wtr.e).astype(np.int64)
    ok = (pc_ >= 0) & (pr >= 0) & (pc_ < wp.shape[1]) & (pr < wp.shape[0])
    pix = np.where(ok, pr * wp.shape[1] + pc_, -1)
    share = np.bincount(pix[ok], minlength=wp.size)
    pop = np.zeros(nx * ny)
    pop[ok] = wp.ravel()[pix[ok]] / share[pix[ok]]
    split_error = float(pop.sum() - wp.ravel()[np.unique(pix[ok])].sum())
    # the buildings were clipped to the region domain polygon: people and kecamatan too, so both counts cover the same land
    pop[~domain] = 0

    # 3. kecamatan raster and kota names
    bbox = [min(c[0] for c in g["corners_lonlat"]), min(c[1] for c in g["corners_lonlat"]), max(c[0] for c in g["corners_lonlat"]), max(c[1] for c in g["corners_lonlat"])]
    div, rel, lic = overture_divisions(bbox, release)
    kec, kota = div[div.subtype == "localadmin"].reset_index(drop=True), div[div.subtype == "county"].reset_index(drop=True)
    kec_u, kota_u = kec.to_crs(crs), kota.to_crs(crs)
    tr = rasterio.transform.from_origin(x0, y0, dx, dx)
    kid = rasterize(((geom, k + 1) for k, geom in enumerate(kec_u.geometry)), out_shape=(ny, nx), transform=tr, fill=0, dtype="uint16").ravel()
    kid[~domain] = 0
    units = []
    for k, r in kec_u.iterrows():
        pt = r.geometry.representative_point()
        hit = kota_u[kota_u.contains(pt)]
        units.append({"name": r["name"], "kota": hit.iloc[0]["name"] if len(hit) else None, "province": r["province"], "osm": r["osm"]})
    # land with no kecamatan polygon in the source (e.g. Kota Bekasi): counted under its kota as one unit
    cid = rasterize(((geom, k + 1) for k, geom in enumerate(kota_u.geometry)), out_shape=(ny, nx), transform=tr, fill=0, dtype="uint16").ravel()
    rest = domain & (kid == 0) & (cid > 0)
    for k, r in kota_u.iterrows():
        cells = rest & (cid == k + 1)
        if cells.any():
            units.append({"name": None, "kota": r["name"], "province": r["province"], "osm": r["osm"]})
            kid[cells] = len(units)
    for k, u in enumerate(units):
        cells = kid == k + 1
        u.update(cells=int(cells.sum()), buildings=int(bld[cells].sum()), people=round(float(pop[cells].sum())))
    keep = [u for u in units if u["cells"] > 0]
    remap = np.zeros(len(units) + 1, np.uint16)
    for new, u in enumerate(keep, 1):
        remap[units.index(u) + 1] = new
    kid = remap[kid]
    assert len(keep) < 256

    arrays = {"kec": kid.astype(np.uint8), "bld": np.minimum(bld, 65535).astype(np.uint16), "pop": np.minimum(np.round(pop * 10), 65535).astype(np.uint16)}
    header = {
        "version": 1, "region": region, "created": now_utc(), "grid": g,
        "encoding": {"kec": "index + 1 into units (0 = none); a unit with name null is the part of a kota without kecamatan polygons", "bld": "buildings with their footprint centroid in the cell", "pop": "people x 10 (WorldPop 2025 split evenly over the 30 m cells of each 100 m pixel)"},
        "units": keep, "arrays": [],
        "sources": {"buildings": "Overture Maps buildings (region pack buildings_overture.parquet)", "people": "WorldPop Global2 constrained 2025 R2025A v1 (doi:10.5258/SOTON/WP00839)",
                    "kecamatan": f"Overture Maps divisions {rel}, division_area localadmin/county", "kecamatan_licence": lic},
        "inputs_sha256": {f: sha256(pack / f) for f in ("buildings_overture.parquet", "population_worldpop_2025.tif", f"engine_{region}.bin.gz")},
        "checks": {"buildings_read": n_b, "buildings_on_grid": n_in, "buildings_in_kecamatan": int(bld[kid > 0].sum()),
                   "people_in_domain": round(float(pop.sum())), "people_in_kecamatan": round(float(pop[kid > 0].sum())),
                   "people_split_error": round(split_error, 3), "units": len(keep), "kecamatan": sum(1 for u in keep if u["name"])},
    }
    off, body = 0, []
    for name, a in arrays.items():
        header["arrays"].append({"name": name, "dtype": str(a.dtype), "offset": off, "length": int(a.size)})
        b = a.tobytes(); body.append(b); off += len(b)
        pad = (-off) % 4; body.append(b"\0" * pad); off += pad
    hb = json.dumps(header, separators=(",", ":")).encode()
    hb += b" " * ((-len(hb)) % 4)
    gz = out / f"exposure_{region}.bin.gz"
    with gzip.open(gz, "wb", compresslevel=9) as fh:
        fh.write(len(hb).to_bytes(4, "little")); fh.write(hb)
        for b in body:
            fh.write(b)
    header["output"] = {"file": gz.name, "bytes": gz.stat().st_size, "sha256": sha256(gz), "build_seconds": round(time.time() - t0, 1)}
    (out / f"exposure_{region}.json").write_text(json.dumps(header, indent=1))
    return header


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("pack", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--region", default="jakarta")
    ap.add_argument("--overture-release", default=None)
    a = ap.parse_args()
    h = build(a.pack, a.out, a.region, a.overture_release)
    print(json.dumps({"checks": h["checks"], "output": h["output"]}))
    for u in sorted(h["units"], key=lambda u: -u["people"]):
        print(f'{str(u["name"]):28s} {str(u["kota"]):24s} {u["province"]} {u["cells"]:7d} {u["buildings"]:7d} {u["people"]:8d}')
