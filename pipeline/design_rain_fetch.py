"""Daily CHIRPS rain over Jakarta, 1981-2025, for the return-period design rain (pipeline/design_rain.py). Runs in an Action
(design-rain.yml) because data.chc.ucsb.edu is not reachable from the cloud session.

  python pipeline/design_rain_fetch.py <out dir> [first year] [last year]

Reads only the window around DKI from each daily global file over HTTP range requests (GDAL /vsicurl/), so no global file is
downloaded. File names are taken from the server's directory listing of each year (CHIRPS v2.0 p05: Cloud-Optimized GeoTIFF folder
'cogs' first, plain 'tifs' second). Writes chirps_daily_jakarta.npz (dates, lon, lat, rain mm/day) and manifest.json (URLs, counts).
CHIRPS: Funk et al. (2015) Sci Data 2:150066, doi:10.1038/sdata.2015.66. A CHIRPS day is taken as the UTC calendar day.
"""
import datetime
import hashlib
import json
import os
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

BASE = "https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/"
FOLDERS = (("cogs/p05/", re.compile(r'href="(chirps-v2\.0\.(\d{4})\.(\d{2})\.(\d{2})\.cog)"')),
           ("tifs/p05/", re.compile(r'href="(chirps-v2\.0\.(\d{4})\.(\d{2})\.(\d{2})\.tif)"')))
BOX = (106.50, -6.65, 107.15, -5.95)  # lon0, lat0, lon1, lat1: DKI (without the Thousand Islands) plus a margin for nearby gauges
os.environ.update({"GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR", "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".cog,.tif",
                   "GDAL_HTTP_MAX_RETRY": "5", "GDAL_HTTP_RETRY_DELAY": "3", "VSI_CACHE": "FALSE"})


def listing(url: str) -> str:
    assert url.startswith(BASE)
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def files_of_year(y: int) -> tuple[str, dict]:
    for folder, rx in FOLDERS:
        try:
            html = listing(f"{BASE}{folder}{y}/")
        except Exception as e:  # noqa: BLE001 - try the next folder
            print(y, folder, "no listing:", e)
            continue
        got = {f"{a}-{b}-{c}": f"{BASE}{folder}{y}/{name}" for name, a, b, c in rx.findall(html)}
        if got:
            return folder, got
    return "", {}


def read_window(url: str):
    import rasterio
    from rasterio.windows import from_bounds
    for attempt in range(3):
        try:
            with rasterio.open("/vsicurl/" + url) as ds:
                w = from_bounds(*BOX, transform=ds.transform).round_offsets().round_lengths()
                a = ds.read(1, window=w).astype(np.float32)
                nod = ds.nodata
                tr = ds.window_transform(w)
            if nod is not None:
                a[a == nod] = np.nan
            a[a < 0] = np.nan  # CHIRPS uses -9999 for ocean
            return a, tr
        except Exception as e:  # noqa: BLE001
            err = e
    print("failed", url, err)
    return None, None


def main(out: Path, y0: int, y1: int):
    out.mkdir(parents=True, exist_ok=True)
    urls, folders = {}, {}
    for y in range(y0, y1 + 1):
        folder, got = files_of_year(y)
        folders[y] = folder
        urls.update(got)
        print(y, folder, len(got), "files")
    dates = sorted(urls)
    if not dates:
        sys.exit("no CHIRPS files found")
    with ThreadPoolExecutor(24) as ex:
        res = list(ex.map(lambda d: read_window(urls[d]), dates))
    ok = [(d, a, tr) for d, (a, tr) in zip(dates, res) if a is not None]
    shape = max((a.shape for _, a, _ in ok), key=lambda s: sum(1 for _, a, _ in ok if a.shape == s))
    ok = [x for x in ok if x[1].shape == shape]
    tr = ok[0][2]
    ny, nx = shape
    lon = tr.c + tr.a * (np.arange(nx) + 0.5)
    lat = tr.f + tr.e * (np.arange(ny) + 0.5)
    rain = np.stack([a for _, a, _ in ok])
    days = np.array([d for d, _, _ in ok])
    np.savez_compressed(out / "chirps_daily_jakarta.npz", dates=days, lon=lon, lat=lat, rain=rain)
    every = []
    d = datetime.date(y0, 1, 1)
    while d <= datetime.date(y1, 12, 31):
        every.append(str(d))
        d += datetime.timedelta(days=1)
    missing = sorted(set(every) - set(days.tolist()))
    sha = hashlib.sha256((out / "chirps_daily_jakarta.npz").read_bytes()).hexdigest()
    (out / "manifest.json").write_text(json.dumps({
        "source": "CHIRPS v2.0 daily, 0.05 degree (Funk et al. 2015, doi:10.1038/sdata.2015.66), Climate Hazards Center, UC Santa Barbara",
        "base_url": BASE, "folders_by_year": folders, "box_lon_lat": BOX, "first": days[0], "last": days[-1], "n_days": int(len(days)),
        "missing_days": missing, "grid": {"nx": int(nx), "ny": int(ny), "lon0": float(lon[0]), "lat0": float(lat[0]), "d": float(tr.a)},
        "npz_sha256": sha, "made_by": "pipeline/design_rain_fetch.py"}, indent=1))
    print(len(days), "days,", len(missing), "missing, grid", nx, "x", ny)


if __name__ == "__main__":
    a = sys.argv[1:]
    main(Path(a[0]), int(a[1]) if len(a) > 1 else 1981, int(a[2]) if len(a) > 2 else 2025)
