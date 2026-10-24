"""Ingest the owner's DEMNAS upload (private draft release 'demnas-private').

Steps: list draft assets → download (.tif or .zip) → check against the expected tile list →
mosaic + reproject to the region grid (UTM, 8 m, bilinear) → COG → upload the COG, a tile report and
checksums back to the SAME draft release. Nothing is published: DEMNAS stays private until its licence is read.

Needs GITHUB_TOKEN (contents: write) and GITHUB_REPOSITORY.
"""
from __future__ import annotations

import json
import os
import re
import sys
import zipfile
from pathlib import Path

import requests
from rasterio.warp import Resampling

from b3d import DATA, load_regions
from b3d.grid import region_grid, warp_to_grid
from b3d.util import now_utc, output_record, sha256, write_cog

API = "https://api.github.com"
TAG = "demnas-private"
NODATA = -9999.0


def gh(method, url, **kw):
    h = {"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}", "X-GitHub-Api-Version": "2022-11-28", **kw.pop("headers", {})}
    r = requests.request(method, url, headers=h, timeout=600, **kw)
    r.raise_for_status()
    return r


def find_release(repo):
    for page in range(1, 6):
        for rel in gh("GET", f"{API}/repos/{repo}/releases", params={"per_page": 100, "page": page}).json():
            if rel["tag_name"] == TAG:
                return rel
    return None


def describe(path: Path) -> dict:
    """Header facts and a decimated value sample of one input file (to spot broken or un-georeferenced files)."""
    import rasterio

    d = {"file": path.name, "bytes": path.stat().st_size}
    try:
        with rasterio.open(path) as src:
            a = src.read(1, out_shape=(min(src.height, 500), min(src.width, 500)), masked=True)
            d.update(driver=src.driver, crs=str(src.crs), bounds=[round(x, 5) for x in src.bounds], size=[src.width, src.height],
                     dtype=src.dtypes[0], nodata=src.nodata, count=src.count, transform_is_identity=src.transform.is_identity,
                     valid_share=round(float(a.count()) / a.size, 4),
                     min_max=[round(float(a.min()), 2), round(float(a.max()), 2)] if a.count() else None)
    except Exception as e:
        d["error"] = f"{type(e).__name__}: {e}"
    return d


def qa_stats(arr, grid, region) -> dict:
    """Coverage and value ranges inside the domain and inside the admin area (no-data there = missing tiles)."""
    import numpy as np
    from rasterio.features import geometry_mask
    import shapely
    from pyproj import Transformer
    from shapely.geometry import shape

    fc = json.loads((DATA / region["domain"]).read_text()) if region.get("domain") else None
    out = {}
    to_utm = Transformer.from_crs("EPSG:4326", grid.crs, always_xy=True).transform
    for f in (fc or {}).get("features", []):
        geom = shapely.transform(shape(f["geometry"]), lambda c: np.column_stack(to_utm(c[:, 0], c[:, 1])))
        inside = ~geometry_mask([geom], out_shape=grid.shape, transform=grid.transform)
        v = arr[inside]
        ok = v[(v != NODATA) & np.isfinite(v)]
        p = np.percentile(ok, [0, 1, 50, 99, 100]).round(2).tolist() if ok.size else []
        out[f["properties"]["role"]] = {"cells": int(v.size), "nodata_share": round(1 - ok.size / max(v.size, 1), 5),
                                        "min_p1_p50_p99_max_m": p}
    return out


def main(region_id="jakarta", work=Path("demnas_work")) -> int:
    repo = os.environ["GITHUB_REPOSITORY"]
    rel = find_release(repo)
    if rel is None:
        print("No release with tag 'demnas-private' yet — nothing to do.")
        return 0
    if not rel["draft"]:
        print("::warning::The DEMNAS release is PUBLISHED (public). It should be a draft. Continuing, but please revert it to draft.")
    work.mkdir(exist_ok=True)
    expected = json.loads((DATA / "demnas" / f"{region_id}_tiles.json").read_text())["tiles"]
    wanted = {c for t in expected if t["needed"] for c in [t["code"], *t["sub_sheets_25k"]]}
    tifs, skipped = [], []
    for a in rel["assets"]:
        name = a["name"]
        if name.startswith("dem_demnas") or name in ("demnas_report.json", "DEMNAS_SHA256SUMS"):
            continue
        m = re.search(r"(\d{4}-\d{2,3})", name)
        if m and m.group(1) not in wanted:  # sheet outside this region's domain: keep it in the release, don't download
            skipped.append(name)
            continue
        dst = work / name
        if not dst.exists():
            with gh("GET", a["url"], headers={"Accept": "application/octet-stream"}, stream=True) as r, open(dst, "wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
        if name.lower().endswith(".zip"):
            with zipfile.ZipFile(dst) as z:
                for m in z.namelist():
                    if m.lower().endswith((".tif", ".tiff")):
                        out = work / Path(m).name
                        out.write_bytes(z.read(m))
                        tifs.append(out)
        elif name.lower().endswith((".tif", ".tiff")):
            tifs.append(dst)
    found = {}
    for p in tifs:
        m = re.search(r"(\d{4}-\d{2,3})", p.name)
        if m:
            found.setdefault(m.group(1), []).append(p.name)
    def covered(code):
        return code in found or all(s in found for s in next(t["sub_sheets_25k"] for t in expected if t["code"] == code))
    missing = [t["code"] for t in expected if t["needed"] and not covered(t["code"])]
    diag = [describe(p) for p in sorted(tifs)]
    for d in diag:
        print(json.dumps(d))
    report = {"checked": now_utc(), "region": region_id, "files": len(tifs), "skipped_outside_domain": skipped,
              "tiles_found": sorted(found), "missing_tiles": missing,
              "inputs": [{"file": p.name, "sha256": sha256(p)} for p in tifs], "diagnostics": diag}
    print(json.dumps({k: report[k] for k in ("files", "tiles_found", "missing_tiles")}, indent=1), f"skipped {len(skipped)}")
    if tifs:
        region = load_regions()[region_id]
        grid = region_grid(region, 8)
        # DEMNAS tiles carry no CRS tag; BIG documents them as geographic (WGS 84 lon/lat), EGM2008 heights
        arr = warp_to_grid([str(p) for p in sorted(tifs)], grid, nodata=NODATA, resampling=Resampling.bilinear,
                           assume_crs="EPSG:4326")
        cog = write_cog(work / f"dem_demnas_{region_id}_utm48s_8m.tif", arr, transform=grid.transform, crs=grid.crs,
                        nodata=NODATA, predictor=3, overview_resampling="average",
                        tags={"units": "m", "vertical_datum": "EGM2008", "source": "DEMNAS (BIG), private"})
        report["output"] = output_record(cog, units="m", vertical_datum="EGM2008",
                                         steps=["assign EPSG:4326 (no CRS tag in tiles)", "mosaic", "reproject EPSG:32748", "8 m", "bilinear"])
        report["qa"] = qa_stats(arr, grid, region)
        print(json.dumps({"qa": report["qa"]}, indent=1))
        upload = [cog]
    else:
        upload = []
    rep = work / "demnas_report.json"
    rep.write_text(json.dumps(report, indent=1) + "\n")
    upload.append(rep)
    for a in rel["assets"]:  # replace earlier outputs
        if a["name"] in {p.name for p in upload}:
            gh("DELETE", a["url"])
    base = rel["upload_url"].split("{")[0]
    for p in upload:
        with open(p, "rb") as f:
            gh("POST", base, params={"name": p.name}, headers={"Content-Type": "application/octet-stream"}, data=f)
        print("uploaded", p.name)
    admin_gap = report.get("qa", {}).get("admin", {}).get("nodata_share", 0)
    if admin_gap > 0.01:
        print(f"::error title=DEMNAS mosaic incomplete::{admin_gap:.1%} of DKI Jakarta has no data; see diagnostics above")
    return 1 if missing or admin_gap > 0.01 else 0


if __name__ == "__main__":
    sys.exit(main(*(sys.argv[1:2] or [])))
