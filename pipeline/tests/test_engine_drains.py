import geopandas as gpd
import numpy as np
from rasterio.transform import from_origin
from shapely.geometry import LineString

from engine_pack import carve_drains
from jakartasatu import channel_size, num_range


def test_channel_size_fields():
    assert channel_size({"LEBAR_MIN": 5.0, "LEBAR_MAX": 5.0, "KED_MIN": 8.0, "KED_MAX": 8.0}) == (5.0, 8.0)
    assert channel_size({"LBR_M": "4 - 10,5", "DALAM_M": "1,1 - 6"}) == (7.25, 3.55)
    assert num_range("0") is None and num_range(None) is None


def test_carve_drains_area_equivalent_depth(tmp_path):
    tr = from_origin(700000, 9300000, 30, 30)
    z = np.full((5, 5), 3.0)
    line = LineString([(700000 + 15, 9300000 - 75), (700000 + 135, 9300000 - 75)])  # along row 2
    g = gpd.GeoDataFrame({"width_m": [15.0], "depth_m": [4.0]}, geometry=[line], crs="EPSG:32748")
    p = tmp_path / "js.gpkg"
    g.to_file(p, layer="drain_primary_line", driver="GPKG")
    out, chan, h0, info = carve_drains(z, z.copy(), np.zeros((5, 5), bool), tr, p)
    assert np.allclose(out[2], 3.0 - 4.0 * 15 / 30)  # 2 m area-equivalent lowering
    assert chan[2].all() and not chan[0].any()
    assert info["cells_lowered"] == 5 and info["records"]["drain_primary_line"] == 1
    assert np.allclose(h0[2], 2.0) and h0[0].sum() == 0  # flat terrain: recorded surface = ground, carved part starts full
    assert carve_drains(z, z, chan, tr, None)[3] == {}
