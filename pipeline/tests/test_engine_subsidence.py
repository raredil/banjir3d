import numpy as np
import rasterio
from rasterio.transform import from_origin

from engine_pack import subsidence


def test_subsidence_onto_grid(tmp_path):
    tr = from_origin(700000, 9300000, 30, 30)
    a = np.array([[10.0, 20.0], [-9999.0, 40.0]], np.float32)
    p = tmp_path / "s.tif"
    with rasterio.open(p, "w", driver="GTiff", width=2, height=2, count=1, dtype="float32", crs="EPSG:32748", transform=tr, nodata=-9999) as d:
        d.write(a, 1)
    sub, info = subsidence(p, "mm/yr", 2013.0, tr, rasterio.crs.CRS.from_epsg(32748), (2, 2))
    assert sub.dtype == np.int16
    assert sub.tolist() == [[10, 20], [0, 40]]  # no data -> rate 0
    assert info["coverage_share"] == 0.75 and info["epoch"] == 2013.0
    assert subsidence(None, "mm/yr", 2013.0, tr, None, (2, 2)) == (None, {})
