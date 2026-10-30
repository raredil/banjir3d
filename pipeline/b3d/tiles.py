"""Render a COG into a raster PMTiles archive for the web map (Web Mercator tiles).

Display-only products: analysis always uses the COGs in the region pack.
"""
from __future__ import annotations

import io
from pathlib import Path
from typing import Callable

import mercantile
import numpy as np
import rasterio
from PIL import Image
from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import Writer
from rasterio.vrt import WarpedVRT
from rasterio.warp import Resampling

TILE = 256


def terrarium(h: np.ndarray, valid: np.ndarray) -> np.ndarray:
    """Encode elevation (m) as Terrarium RGB (MapLibre raster-dem encoding 'terrarium')."""
    v = np.where(valid, h, 0.0).astype("float64") + 32768.0
    r = np.floor(v / 256.0)
    g = np.floor(v) - r * 256.0
    b = np.floor((v - np.floor(v)) * 256.0)
    return np.stack([r, g, b]).clip(0, 255).astype("uint8")


def _encode(rgba: np.ndarray, fmt: str, quality: int = 82) -> bytes | None:
    """rgba: (bands, H, W) uint8 with 3 or 4 bands. Returns None for fully transparent tiles."""
    if rgba.shape[0] == 4 and not rgba[3].any():
        return None
    img = Image.fromarray(np.moveaxis(rgba, 0, -1), "RGBA" if rgba.shape[0] == 4 else "RGB")
    buf = io.BytesIO()
    if fmt == "webp":
        img.save(buf, "WEBP", quality=quality, method=4)
    else:
        img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def render_pmtiles(cog: Path, out: Path, *, bbox: list[float], minzoom: int, maxzoom: int,
                   render: Callable[[np.ndarray, np.ndarray], np.ndarray], fmt: str = "png",
                   resampling=Resampling.bilinear, metadata: dict | None = None, bands=None,
                   max_resampling=None, quality: int = 82) -> Path:
    """render(data[bands,H,W], valid[H,W]) -> uint8 (3|4, H, W).

    max_resampling: resampling for the top zoom only. Use it when the top zoom is finer than the source (upsampling),
    where an averaging kernel blurs: e.g. 10 m imagery at z14 (9.5 m pixels) keeps more detail with Lanczos.
    """
    tiles = []
    for z in range(minzoom, maxzoom + 1):
        tiles += list(mercantile.tiles(*bbox, zooms=z))
    tiles.sort(key=lambda t: zxy_to_tileid(t.z, t.x, t.y))
    out.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(cog) as src, open(out, "wb") as f:
        idx = bands or list(range(1, src.count + 1))
        w = Writer(f)
        written = 0
        for t in tiles:
            xb = mercantile.xy_bounds(t)
            tr = rasterio.transform.from_bounds(xb.left, xb.bottom, xb.right, xb.top, TILE, TILE)
            res = max_resampling if (max_resampling is not None and t.z == maxzoom) else resampling
            with WarpedVRT(src, crs="EPSG:3857", transform=tr, width=TILE, height=TILE, resampling=res,
                           src_nodata=src.nodata, nodata=src.nodata) as vrt:
                data = vrt.read(idx, masked=True)
            valid = ~np.ma.getmaskarray(data).any(axis=0)
            if not valid.any():
                continue
            blob = _encode(render(np.ma.getdata(data), valid), fmt, quality)
            if blob is None:
                continue
            w.write_tile(zxy_to_tileid(t.z, t.x, t.y), blob)
            written += 1
        c = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
        w.finalize(
            {
                "tile_type": TileType.WEBP if fmt == "webp" else TileType.PNG,
                "tile_compression": Compression.NONE,
                "min_lon_e7": int(bbox[0] * 1e7), "min_lat_e7": int(bbox[1] * 1e7),
                "max_lon_e7": int(bbox[2] * 1e7), "max_lat_e7": int(bbox[3] * 1e7),
                "center_zoom": max(minzoom, min(maxzoom, 10)),
                "center_lon_e7": int(c[0] * 1e7), "center_lat_e7": int(c[1] * 1e7),
            },
            {"format": fmt, "tiles_written": written, "resampling": resampling.name,
             **({"resampling_maxzoom": max_resampling.name} if max_resampling is not None else {}),
             **({"webp_quality": quality} if fmt == "webp" else {}), **(metadata or {})},
        )
    return out


def palette_render(colors: dict[int, tuple[int, int, int]]):
    lut = np.zeros((256, 4), dtype="uint8")
    for k, rgb in colors.items():
        lut[k] = (*rgb, 255)

    def render(data, valid):
        rgba = lut[data[0].astype("uint8")]
        rgba[~valid] = 0
        return np.moveaxis(rgba, -1, 0)
    return render


def ramp_render(stops: list[tuple[float, tuple[int, int, int, int]]], transform=lambda x: x):
    """Piecewise-linear RGBA ramp on transform(value)."""
    xs = np.array([s[0] for s in stops], dtype="float64")
    cs = np.array([s[1] for s in stops], dtype="float64")

    def render(data, valid):
        v = transform(data[0].astype("float64"))
        out = np.stack([np.interp(v, xs, cs[:, i]) for i in range(4)]).astype("uint8")
        out[:, ~valid] = 0
        return out
    return render


def rgb_render(data, valid):
    out = np.concatenate([data[:3].astype("uint8"), (valid * 255).astype("uint8")[None]])
    return out
