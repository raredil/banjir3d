"""Check that what the web app shows and simulates equals the region-pack source data.

Usage: python check_pack.py <pack dir> <out.json> [--tag TAG]
The pack dir holds the release files (SHA256SUMS, manifest.json, *.tif, *.pmtiles). Exit code 1 if a check fails. Checks:
1. checksums: every file present matches SHA256SUMS;
2. dem: elevations the Explore engine reads (FABDEM z12 Terrarium tiles) versus the FABDEM COG (cell mean of the
   30 m pixels inside each tile pixel, and bilinear value at the pixel centre), over the 10 km sample and the region;
3. landcover: WorldCover class the engine decodes from the z14 tiles versus the COG class at the pixel centre;
4. imagery: Sentinel-2 display tiles versus the COG (PSNR and local contrast), z14, sample box.
"""
from __future__ import annotations

import hashlib
import io
import json
import sys
from pathlib import Path

import mercantile
import numpy as np
import rasterio
from PIL import Image
from pmtiles.reader import MmapSource, Reader
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT
from rasterio.warp import Resampling

ROOT = Path(__file__).resolve().parents[2]
REGIONS = json.loads((ROOT / "data/regions.json").read_text())
WC = json.loads((ROOT / "data/roughness/worldcover-manning.json").read_text())
TS = 256


def checksums(d: Path) -> dict:
    ok, bad = [], []
    for line in (d / "SHA256SUMS").read_text().splitlines():
        h, name = line.split(maxsplit=1)
        name = name.lstrip("*")
        f = d / name
        if not f.exists():
            continue
        (ok if hashlib.sha256(f.read_bytes()).hexdigest() == h else bad).append(name)
    return {"checked": len(ok) + len(bad), "ok": sorted(ok), "mismatch": sorted(bad), "pass": not bad and bool(ok)}


def tile_png(rd: Reader, z: int, x: int, y: int) -> np.ndarray | None:
    b = rd.get(z, x, y)
    return None if b is None else np.asarray(Image.open(io.BytesIO(b)).convert("RGBA")).astype("float64")


def warp(src, t: mercantile.Tile, res, bands, size=TS) -> np.ma.MaskedArray:
    xb = mercantile.xy_bounds(t)
    tr = from_bounds(xb.left, xb.bottom, xb.right, xb.top, size, size)
    with WarpedVRT(src, crs="EPSG:3857", transform=tr, width=size, height=size, resampling=res,
                   src_nodata=src.nodata, nodata=src.nodata) as v:
        return v.read(bands, masked=True)


def stats(diff: np.ndarray) -> dict:
    a = np.abs(diff)
    return {"n": int(diff.size), "mean": round(float(diff.mean()), 4), "rmse": round(float(np.sqrt((diff ** 2).mean())), 4),
            "p95_abs": round(float(np.percentile(a, 95)), 4), "max_abs": round(float(a.max()), 4)}


def dem(d: Path, bbox: list[float]) -> dict:
    rd = Reader(MmapSource(open(d / "dem_fabdem.pmtiles", "rb")))
    src = rasterio.open(d / "dem_fabdem.tif")
    d_mean, d_bil, sub_sd = [], [], []
    for t in mercantile.tiles(*bbox, zooms=12):
        img = tile_png(rd, 12, t.x, t.y)
        if img is None:
            continue
        h = img[..., 0] * 256 + img[..., 1] + img[..., 2] / 256 - 32768
        bil = warp(src, t, Resampling.bilinear, [1])[0]
        mean = warp(src, t, Resampling.average, [1])[0]
        # spread of the 30 m pixels inside each 38 m model cell: detail a 38 m grid cannot hold
        fine = warp(src, t, Resampling.nearest, [1], TS * 4)[0].reshape(TS, 4, TS, 4).std(axis=(1, 3))
        ok = (img[..., 3] > 0) & ~np.ma.getmaskarray(bil) & ~np.ma.getmaskarray(mean)
        d_bil.append((h - bil.data)[ok]); d_mean.append((h - mean.data)[ok]); sub_sd.append(np.ma.filled(fine, np.nan)[ok])
    sd = np.concatenate(sub_sd)
    return {"tile_vs_cog_bilinear_m": stats(np.concatenate(d_bil)), "tile_vs_cog_cell_mean_m": stats(np.concatenate(d_mean)),
            "subcell_std_of_30m_pixels_m": {"median": round(float(np.nanmedian(sd)), 3), "p95": round(float(np.nanpercentile(sd, 95)), 3)}}


def landcover(d: Path, bbox: list[float]) -> dict:
    rd = Reader(MmapSource(open(d / "lulc_worldcover_2021.pmtiles", "rb")))
    src = rasterio.open(d / "lulc_worldcover_2021.tif")
    codes = np.array(sorted(int(c) for c in WC["classes"]))
    pal = np.array([[int(WC["colors"][str(c)][i:i + 2], 16) for i in (1, 3, 5)] for c in codes], dtype="float64")
    agree = total = 0
    for t in mercantile.tiles(*bbox, zooms=14):
        img = tile_png(rd, 14, t.x, t.y)
        if img is None:
            continue
        rgb = img[..., :3].reshape(-1, 3)
        got = codes[((rgb[:, None, :] - pal[None]) ** 2).sum(-1).argmin(1)].reshape(TS, TS)  # same rule as roughness.ts classify()
        ref = warp(src, t, Resampling.nearest, [1])[0]
        ok = (img[..., 3] > 0) & ~np.ma.getmaskarray(ref)
        agree += int((got[ok] == ref.data[ok]).sum()); total += int(ok.sum())
    return {"pixels": total, "agreement": round(agree / total, 5)}


def imagery(d: Path, bbox: list[float], name="imagery_s2.pmtiles") -> dict:
    rd = Reader(MmapSource(open(d / name, "rb")))
    src = rasterio.open(d / "imagery_s2_rgb.tif")
    psnr, c_tile, c_ref, nbytes, n = [], [], [], 0, 0
    contrast = lambda a: float(np.abs(np.diff(a, axis=0)).mean() + np.abs(np.diff(a, axis=1)).mean())
    for t in mercantile.tiles(*bbox, zooms=14):
        b = rd.get(14, t.x, t.y)
        if b is None:
            continue
        img = np.asarray(Image.open(io.BytesIO(b)).convert("RGB")).astype("float64").mean(-1)
        ref = np.ma.filled(warp(src, t, Resampling.lanczos, [1, 2, 3]).astype("float64"), 0).mean(0)
        psnr.append(10 * np.log10(255 ** 2 / np.mean((img - ref) ** 2)))
        c_tile.append(contrast(img)); c_ref.append(contrast(ref)); nbytes += len(b); n += 1
    return {"file": name, "tiles_z14": n, "mean_kb_per_tile": round(nbytes / n / 1024, 1), "psnr_vs_cog_lanczos_db": round(float(np.mean(psnr)), 2),
            "local_contrast_kept": round(float(np.sum(c_tile) / np.sum(c_ref)), 3)}


# Pass limits. Terrarium stores elevation in steps of 1/256 m (0.0039 m), so 0.01 m means "exactly the source".
LIMITS = {"dem_max_abs_m": 0.01, "landcover_agreement": 0.999, "imagery_contrast_kept": 0.95, "imagery_psnr_db": 38.0}


def summary(res: dict) -> list[dict]:
    dm, lc, im = res["dem_region"]["tile_vs_cog_bilinear_m"], res["landcover_sample"], res["imagery_sample"]
    return [
        {"id": "checksums", "what": "Release files match SHA256SUMS", "value": f"{len(res['checksums']['ok'])} ok, {len(res['checksums']['mismatch'])} mismatch",
         "pass": res["checksums"]["pass"]},
        {"id": "dem", "what": "Terrain the simulation reads = FABDEM source (largest difference, whole region)",
         "value": f"{dm['max_abs']} m", "limit": f"<= {LIMITS['dem_max_abs_m']} m", "pass": dm["max_abs"] <= LIMITS["dem_max_abs_m"]},
        {"id": "landcover", "what": "Land-cover class the simulation reads = WorldCover source (10 km sample)",
         "value": f"{lc['agreement'] * 100:.2f} %", "limit": f">= {LIMITS['landcover_agreement'] * 100:.1f} %", "pass": lc["agreement"] >= LIMITS["landcover_agreement"]},
        {"id": "imagery", "what": "Satellite map tiles keep the detail of the 10 m source (10 km sample, z14)",
         "value": f"{im['local_contrast_kept'] * 100:.1f} % detail, {im['psnr_vs_cog_lanczos_db']} dB",
         "limit": f">= {LIMITS['imagery_contrast_kept'] * 100:.0f} %, >= {LIMITS['imagery_psnr_db']:.0f} dB",
         "pass": im["local_contrast_kept"] >= LIMITS["imagery_contrast_kept"] and im["psnr_vs_cog_lanczos_db"] >= LIMITS["imagery_psnr_db"]},
    ]


def main(d: Path, out: Path, tag: str | None) -> bool:
    sample, region = REGIONS["sample-ciliwung"]["bbox"], REGIONS["jakarta"]["bbox"]
    res = {"pack": tag, "checks": [], "checksums": checksums(d),
           "dem_sample": dem(d, sample), "dem_region": dem(d, region),
           "landcover_sample": landcover(d, sample), "imagery_sample": imagery(d, sample)}
    res["checks"] = summary(res)
    res["pass"] = all(c["pass"] for c in res["checks"])
    out.write_text(json.dumps(res, indent=1) + "\n")
    for c in res["checks"]:
        print(f"{'PASS' if c['pass'] else 'FAIL'}  {c['what']}: {c['value']}")
    return res["pass"]


if __name__ == "__main__":
    tag = sys.argv[sys.argv.index("--tag") + 1] if "--tag" in sys.argv else None
    sys.exit(0 if main(Path(sys.argv[1]), Path(sys.argv[2]), tag) else 1)
