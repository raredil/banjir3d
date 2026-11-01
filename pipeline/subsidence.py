"""Land subsidence rate map for the flood engine (mm/year, positive = sinking) from the Sinking City InSAR dataset.

  python pipeline/subsidence.py <out dir> [--region jakarta]

Inputs (downloaded):
  Zenodo record 19456870 (Shabrina et al. 2026, CC BY 4.0), "01 Land subsidence.zip": annual Sentinel-1 line-of-sight (LOS)
  velocities 2016-2024 (LiCSBAS, LiCSAR frame 098A_09673_121312, ascending), kriged to 30 m UTM 48S (landsub_<year>_int_value.tif,
  mm/year, positive = towards the satellite) with their kriging standard deviation (landsub_<year>_int_sd.tif).
  LiCSAR frame metadata 098A_09673_121312.geo.U.tif: up component of the LOS unit vector (cos of the incidence angle).
Method (data/methods/methods.md, section 4):
  1. Mean LOS velocity of the nine annual maps per cell (single years are noisy: year-to-year spread is larger than the trend).
  2. Vertical velocity = LOS velocity / U (horizontal motion assumed negligible, as usual for compaction-driven subsidence).
  3. Sinking rate = max(0, -vertical velocity): uplift values are treated as noise, as the dataset authors do in their maps.
  4. Standard error of the mean from the nine kriging standard deviations, divided by U.
Outputs: subsidence_insar.tif (float32 mm/year, region 30 m grid, nodata outside the InSAR map = DKI Jakarta),
         subsidence_insar.pmtiles (display), subsidence_insar.json (provenance and statistics).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from pathlib import Path

import numpy as np
import rasterio
from rasterio.warp import Resampling, reproject

from b3d import load_regions
from b3d.grid import region_grid
from b3d.tiles import ramp_render, render_pmtiles
from b3d.util import http_get, now_utc, output_record, write_cog

ZENODO = "https://zenodo.org/api/records/19456870"
ZIP_KEY = "01 Land subsidence.zip"
LICSAR_U = "https://gws-access.jasmin.ac.uk/public/nceo_geohazards/LiCSAR_products/98/098A_09673_121312/metadata/098A_09673_121312.geo.U.tif"
YEARS = range(2016, 2025)
NODATA = -9999.0
# display ramp (mm/year sinking): transparent below 2 mm/year
RAMP = [(0, (0, 0, 0, 0)), (2, (255, 237, 160, 0)), (5, (254, 217, 118, 200)), (15, (253, 141, 60, 220)), (30, (227, 26, 28, 235)), (50, (128, 0, 38, 255))]


def mean_sinking(los: np.ndarray, sd: np.ndarray, u: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """los, sd: (years, H, W) mm/year with NaN for no data; u: (H, W). Returns sinking rate, its standard error, vertical velocity."""
    n = np.sum(np.isfinite(los), axis=0)
    with np.errstate(invalid="ignore", divide="ignore"):
        v_los = np.nanmean(np.where(np.isfinite(los), los, np.nan), axis=0)
        se_los = np.sqrt(np.nansum(np.where(np.isfinite(sd), sd, 0.0) ** 2, axis=0)) / np.maximum(n, 1)
        v_up = v_los / u
        sink = np.maximum(0.0, -v_up)
        se = se_los / u
    bad = (n == 0) | ~np.isfinite(u) | (u <= 0.1)
    sink[bad] = np.nan
    se[bad] = np.nan
    v_up[bad] = np.nan
    return sink, se, v_up


def main(out: Path, region_id: str) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    work = out / "_work"
    work.mkdir(exist_ok=True)
    rec = http_get(ZENODO).json()
    f = next(x for x in rec["files"] if x["key"] == ZIP_KEY)
    zpath = work / "landsub.zip"
    zpath.write_bytes(http_get(f["links"]["self"], timeout=600).content)
    algo, want = f["checksum"].split(":", 1)
    got = hashlib.new(algo, zpath.read_bytes()).hexdigest()
    if got != want:
        raise SystemExit(f"Zenodo checksum mismatch: {got} != {want}")
    upath = work / "licsar_U.tif"
    upath.write_bytes(http_get(LICSAR_U, timeout=300).content)
    region = load_regions()[region_id]
    grid = region_grid(region, 30)
    H, W = grid.shape

    def onto(path_or_bytes, rs=Resampling.bilinear, nodata=None):
        a = np.full((H, W), np.nan, np.float32)
        with rasterio.open(path_or_bytes) as src:
            reproject(rasterio.band(src, 1), a, dst_transform=grid.transform, dst_crs=grid.crs, resampling=rs,
                      src_nodata=nodata if nodata is not None else src.nodata, dst_nodata=np.nan)
        return a

    z = zipfile.ZipFile(zpath)
    names = {Path(n).name: n for n in z.namelist()}
    los, sd = [], []
    for y in YEARS:
        for kind, lst in (("value", los), ("sd", sd)):
            p = work / f"landsub_{y}_int_{kind}.tif"
            p.write_bytes(z.read(names[p.name]))
            a = onto(p)
            a[np.abs(a) > 1000] = np.nan  # nodata 99999 after bilinear blending at the edge
            lst.append(a)
    los, sd = np.stack(los), np.stack(sd)
    u = onto(upath)
    sink, se, v_up = mean_sinking(los, sd, u)
    ok = np.isfinite(sink)
    arr = np.where(ok, sink, NODATA).astype(np.float32)
    cog = write_cog(out / "subsidence_insar.tif", arr, transform=grid.transform, crs=grid.crs, nodata=NODATA, predictor=3,
                    overview_resampling="average", tags={"units": "mm/year", "positive": "sinking", "period": "2016-2024",
                                                         "source": "Shabrina et al. 2026, Zenodo 10.5281/zenodo.19456870 (CC BY 4.0)"})
    pm = render_pmtiles(cog, out / "subsidence_insar.pmtiles", bbox=region["bbox"], minzoom=8, maxzoom=13,
                        render=ramp_render(RAMP), resampling=Resampling.bilinear)
    yearly = {str(y): round(float(np.nanmedian(-los[i][ok] / u[ok])), 2) for i, y in enumerate(YEARS)}
    v = sink[ok]
    stats = {
        "cells": int(ok.sum()), "area_km2": round(ok.sum() * 0.0009, 1),
        "sinking_rate_p50_p90_p99_max_mm_yr": np.percentile(v, [50, 90, 99, 100]).round(1).tolist(),
        "share_over_10_mm_yr": round(float((v > 10).mean()), 4), "share_over_30_mm_yr": round(float((v > 30).mean()), 4),
        "uplift_capped_share": round(float((v_up[ok] > 0).mean()), 4),
        "standard_error_p50_p99_mm_yr": np.percentile(se[ok], [50, 99]).round(2).tolist(),
        "median_vertical_sinking_by_year_mm": yearly,
        "u_range": [round(float(np.nanmin(u[ok])), 4), round(float(np.nanmax(u[ok])), 4)],
    }
    meta = {"dataset": "jakarta-subsidence-sinking-city", "created": now_utc(),
            "sources": [f["links"]["self"], LICSAR_U], "zenodo_checksum": f["checksum"],
            "steps": ["mean of the nine annual LOS velocities 2016-2024", "vertical = LOS / U (LiCSAR up component)",
                      "sinking = max(0, -vertical)", "bilinear onto the region 30 m grid"],
            "stats": stats, "outputs": [output_record(cog, units="mm/year"), output_record(pm, kind="raster", ramp=RAMP, units="mm/year")]}
    (out / "subsidence_insar.json").write_text(json.dumps(meta, indent=1))
    print(json.dumps(stats, indent=1))
    return meta


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out", type=Path)
    ap.add_argument("--region", default="jakarta")
    a = ap.parse_args()
    main(a.out, a.region)
