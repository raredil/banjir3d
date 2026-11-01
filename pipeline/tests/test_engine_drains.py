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


def test_pump_rates(tmp_path):
    from shapely.geometry import Point, box
    from engine_pack import pump_rates
    tr = from_origin(700000, 9300000, 30, 30)
    chan = np.zeros((4, 4), bool)
    chan[0, 0] = True
    sea = np.zeros((4, 4), bool)
    p = tmp_path / "js.gpkg"
    gpd.GeoDataFrame({"NAMA": ["P"]}, geometry=[box(700000, 9300000 - 60, 700060, 9300000)], crs="EPSG:32748").to_file(p, layer="polders")
    # one pump inside, one 200 m away (snapped), one 2 km away (ignored), one without capacity
    gpd.GeoDataFrame({"TTLKPSTS": [0.003, 0.0006, 5.0, None]}, geometry=[Point(700030, 9299970), Point(700260, 9299970), Point(702500, 9299970), Point(700010, 9299990)],
                     crs="EPSG:32748").to_file(p, layer="pumps")
    rate, info = pump_rates(chan, sea, tr, p)
    land = rate > 0
    assert land.sum() == 3 and not land[0, 0]  # the 2 x 2 polder minus its channel cell
    assert np.isclose(rate[land].sum() * 900, 0.0036)  # all wet: the polder loses its pump capacity
    assert info["pumps_in_polders"] == 2 and info["polders_served"] == 1
    assert pump_rates(chan, sea, tr, None) == (None, {})
