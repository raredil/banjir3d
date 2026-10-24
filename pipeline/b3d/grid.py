"""Target grids (UTM, snapped to the resolution) and warping sources onto them."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import rasterio
from affine import Affine
from rasterio.crs import CRS
from rasterio.warp import Resampling, reproject, transform_bounds


@dataclass(frozen=True)
class Grid:
    crs: CRS
    transform: Affine
    width: int
    height: int

    @property
    def shape(self) -> tuple[int, int]:
        return self.height, self.width

    @property
    def bounds(self) -> tuple[float, float, float, float]:
        t = self.transform
        return t.c, t.f + t.e * self.height, t.c + t.a * self.width, t.f


def region_grid(region: dict, res: float) -> Grid:
    crs = CRS.from_user_input(region["crs"])
    l, b, r, t = transform_bounds("EPSG:4326", crs, *region["bbox"], densify_pts=50)
    l, b = np.floor(l / res) * res, np.floor(b / res) * res
    r, t = np.ceil(r / res) * res, np.ceil(t / res) * res
    return Grid(crs, Affine(res, 0, l, 0, -res, t), int(round((r - l) / res)), int(round((t - b) / res)))


def warp_to_grid(sources: list[str], grid: Grid, *, dtype="float32", nodata=None, resampling=Resampling.bilinear,
                 band: int = 1, src_nodata=None, assume_crs=None) -> np.ndarray:
    """Warp one band of each source (in order, later fills gaps) onto the grid.

    assume_crs: CRS for sources that carry none (e.g. DEMNAS tiles: geographic, no CRS tag). Without it such a
    source is an error, because GDAL would otherwise warp it to an all-no-data result without complaint.
    """
    fill = nodata if nodata is not None else 0
    out = np.full(grid.shape, fill, dtype=dtype)
    for s in sources:
        with rasterio.open(s) as src:
            src_crs = src.crs or (CRS.from_user_input(assume_crs) if assume_crs else None)
            if src_crs is None:
                raise ValueError(f"{s}: no CRS in file and no assume_crs given")
            tmp = np.full(grid.shape, fill, dtype=dtype)
            # a Band source always uses the file's own (missing) CRS, so CRS-less files are read into memory first
            source = rasterio.band(src, band) if src.crs else src.read(band)
            reproject(
                source, tmp,
                src_crs=src_crs, src_transform=src.transform,
                src_nodata=src_nodata if src_nodata is not None else src.nodata,
                dst_transform=grid.transform, dst_crs=grid.crs, dst_nodata=fill,
                resampling=resampling, num_threads=4,
            )
        mask = (out == fill) & (tmp != fill)
        out[mask] = tmp[mask]
    return out
