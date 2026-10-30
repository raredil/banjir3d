"""Display tiles keep the source detail: Lanczos at the top zoom (finer than the source) is sharper than averaging."""
import io
import json

import mercantile
import numpy as np
import rasterio
from PIL import Image
from pmtiles.reader import MmapSource, Reader
from rasterio.transform import from_origin
from rasterio.warp import Resampling

from b3d.tiles import render_pmtiles, rgb_render

BBOX = [106.84, -6.21, 106.85, -6.20]  # inside one z14 tile area near Manggarai


def _cog(path):
    # 10 m UTM 48S raster with random texture (like a city seen at 10 m), covering BBOX with margin
    rng = np.random.default_rng(1)
    data = rng.integers(20, 235, size=(3, 300, 300), dtype="uint8")
    tr = from_origin(702000 - 500, 9315000 + 1500, 10, 10)
    with rasterio.open(path, "w", driver="GTiff", width=300, height=300, count=3, dtype="uint8", crs="EPSG:32748",
                       transform=tr, nodata=0) as d:
        d.write(data)


def _contrast(pm, z):
    rd = Reader(MmapSource(open(pm, "rb")))
    t = mercantile.tile((BBOX[0] + BBOX[2]) / 2, (BBOX[1] + BBOX[3]) / 2, z)
    a = np.asarray(Image.open(io.BytesIO(rd.get(z, t.x, t.y))).convert("RGB")).astype(float).mean(-1)[64:192, 64:192]
    return np.abs(np.diff(a, axis=0)).mean() + np.abs(np.diff(a, axis=1)).mean(), rd.metadata()


def test_lanczos_top_zoom_is_sharper(tmp_path):
    cog = tmp_path / "img.tif"
    _cog(cog)
    kw = dict(bbox=BBOX, minzoom=13, maxzoom=14, render=rgb_render, fmt="webp", resampling=Resampling.average)
    soft = render_pmtiles(cog, tmp_path / "avg.pmtiles", quality=92, **kw)
    sharp = render_pmtiles(cog, tmp_path / "lz.pmtiles", max_resampling=Resampling.lanczos, quality=92, **kw)
    c_soft, _ = _contrast(soft, 14)
    c_sharp, meta = _contrast(sharp, 14)
    assert c_sharp > 1.1 * c_soft
    assert meta["resampling_maxzoom"] == "lanczos" and meta["webp_quality"] == 92
    # lower zooms are downsampled and keep the averaging kernel (no aliasing)
    assert json.loads(json.dumps(meta))["resampling"] == "average"
