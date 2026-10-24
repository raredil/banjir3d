import numpy as np
import pytest
import rasterio
from rasterio.transform import from_bounds

from b3d.grid import region_grid, warp_to_grid


def _crsless_tile(path):
    """Like a DEMNAS tile: geographic transform, no CRS tag, NaN no-data."""
    a = np.full((300, 300), 5.0, dtype="float32")
    a[:10] = np.nan
    with rasterio.open(path, "w", driver="GTiff", width=300, height=300, count=1, dtype="float32", nodata=np.nan,
                       transform=from_bounds(106.8, -6.3, 106.9, -6.2, 300, 300)) as dst:
        dst.write(a, 1)
    return str(path)


def test_crsless_source(tmp_path):
    src = _crsless_tile(tmp_path / "t.tif")
    grid = region_grid({"bbox": [106.82, -6.28, 106.88, -6.22], "crs": "EPSG:32748"}, 30)
    with pytest.raises(ValueError):
        warp_to_grid([src], grid, nodata=-9999.0)
    out = warp_to_grid([src], grid, nodata=-9999.0, assume_crs="EPSG:4326")
    assert np.all(out == 5.0)
