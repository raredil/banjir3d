"""Shared helpers: GDAL settings, downloads, checksums, COG writing, provenance steps."""
from __future__ import annotations

import datetime as dt
import hashlib
import os
import platform
import shutil
import tempfile
import time
from pathlib import Path

import numpy as np
import rasterio
import rasterio.shutil
import requests

GDAL_ENV = {
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif,.TIF,.tiff",
    "GDAL_HTTP_MULTIRANGE": "YES",
    "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES",
    "GDAL_HTTP_MAX_RETRY": "5",
    "GDAL_HTTP_RETRY_DELAY": "2",
    "AWS_NO_SIGN_REQUEST": "YES",
    "VSI_CACHE": "TRUE",
    "GDAL_CACHEMAX": "1024",
}
os.environ.update({k: v for k, v in GDAL_ENV.items() if k not in os.environ})
# Use the system CA bundle (also covers TLS-inspecting proxies) for GDAL's curl.
for _ca in ("/etc/ssl/certs/ca-certificates.crt",):
    if Path(_ca).exists():
        os.environ.setdefault("CURL_CA_BUNDLE", _ca)

USER_AGENT = "Banjir3D-pipeline/0.1 (+https://github.com/raredil/banjir3d)"


def now_utc() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def http_get(url: str, *, params=None, data=None, timeout=120, retries=4, stream=False, headers=None):
    """GET (or POST when data is given) with retries and backoff."""
    hdr = {"User-Agent": USER_AGENT, **(headers or {})}
    for attempt in range(retries + 1):
        try:
            if data is not None:
                r = requests.post(url, data=data, timeout=timeout, headers=hdr)
            else:
                r = requests.get(url, params=params, timeout=timeout, stream=stream, headers=hdr)
            if r.status_code in (429, 500, 502, 503, 504) and attempt < retries:
                raise requests.HTTPError(f"HTTP {r.status_code}")
            r.raise_for_status()
            return r
        except (requests.ConnectionError, requests.Timeout, requests.HTTPError):
            if attempt == retries:
                raise
            time.sleep(2 ** (attempt + 1))


def download(url: str, dest: Path, **kw) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with http_get(url, stream=True, timeout=600, **kw) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r.raw, f, length=1 << 20)
    return dest


def write_cog(path: Path, arr: np.ndarray, *, transform, crs, nodata=None, colormap=None,
              compress="DEFLATE", predictor=None, tags=None, overview_resampling="nearest", **extra) -> Path:
    """Write a 2-D or 3-D array as a Cloud Optimized GeoTIFF."""
    if arr.ndim == 2:
        arr = arr[None]
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / "tmp.tif"
        prof = dict(driver="GTiff", width=arr.shape[2], height=arr.shape[1], count=arr.shape[0], dtype=arr.dtype,
                    crs=crs, transform=transform, nodata=nodata, tiled=True, blockxsize=512, blockysize=512,
                    compress="DEFLATE", BIGTIFF="IF_SAFER")
        with rasterio.open(tmp, "w", **prof) as dst:
            dst.write(arr)
            if colormap:
                dst.write_colormap(1, colormap)
            if tags:
                dst.update_tags(**tags)
        opts = dict(compress=compress, overview_resampling=overview_resampling, BIGTIFF="IF_SAFER", blocksize=512)
        if predictor:
            opts["predictor"] = predictor
        opts.update(extra)
        rasterio.shutil.copy(tmp, path, driver="COG", **opts)
    return path


def raster_info(path: Path) -> dict:
    with rasterio.open(path) as src:
        return {"crs": str(src.crs), "resolution": [abs(src.res[0]), abs(src.res[1])], "width": src.width,
                "height": src.height, "dtype": src.dtypes[0], "nodata": src.nodata, "bands": src.count}


def output_record(path: Path, **kw) -> dict:
    rec = {"file": path.name, "bytes": path.stat().st_size, "sha256": sha256(path)}
    if path.suffix == ".tif":
        rec.update(raster_info(path))
    rec.update(kw)
    return rec


def software_versions() -> dict:
    import pyogrio
    import pyproj
    import shapely
    return {
        "python": platform.python_version(),
        "rasterio": rasterio.__version__,
        "gdal": rasterio.__gdal_version__,
        "pyogrio": pyogrio.__version__,
        "pyproj": pyproj.__version__,
        "proj": pyproj.proj_version_str,
        "shapely": shapely.__version__,
        "numpy": np.__version__,
    }


def url_exists(url: str) -> bool:
    """True if the URL answers 200/206 to a 1-byte range request (404/403 → False)."""
    for attempt in range(3):
        try:
            r = requests.get(url, headers={"User-Agent": USER_AGENT, "Range": "bytes=0-0"}, timeout=60)
            if r.status_code in (200, 206):
                return True
            if r.status_code in (403, 404, 410):
                return False
        except (requests.ConnectionError, requests.Timeout):
            pass
        time.sleep(2 ** (attempt + 1))
    raise RuntimeError(f"cannot probe {url}")
