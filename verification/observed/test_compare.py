# Report scoring rules (run: python -m pytest verification/observed/test_compare.py)
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import compare  # noqa: E402


def test_channel_water_is_not_a_hit():
    ny = nx = 9
    h = np.zeros((ny, nx), np.float32)
    land = np.ones((ny, nx), bool)
    land[:, 4] = False  # a river channel down the middle, 2 m deep
    h[:, 4] = 2.0
    from pyproj import Transformer
    tr = Transformer.from_crs("EPSG:32748", "EPSG:4326", always_xy=True)
    s = {"utm": {"x0": 700000.0, "y0": 9300000.0, "zone": 48}, "dx": 90.0, "nx": nx, "ny": ny}
    lon, lat = tr.transform(700000 + 3.5 * 90, 9300000 - 4.5 * 90)  # land cell next to the river
    rep = [{"geometry": {"type": "Point", "coordinates": [lon, lat]}, "properties": {"report_data": {"flood_depth": 50}}}]
    r = compare.report_scores(rep, h, s, land, np.ones((ny, nx), bool))
    assert r["legacy_window_with_channels"]["hit_rate"] == 1.0  # the old rule counted the river
    assert r["cell"]["hit_rate"] == 0.0 and r["window_3x3_land"]["hit_rate"] == 0.0
    h[4, 2] = 0.3  # flooded land within the window
    r = compare.report_scores(rep, h, s, land, np.ones((ny, nx), bool))
    assert r["window_3x3_land"]["hit_rate"] == 1.0 and r["cell"]["hit_rate"] == 0.0
    assert 0 < r["window_3x3_land"]["random_hit_rate"] < 1


def test_distance_to_water_and_classes():
    water = np.zeros((20, 20), bool)
    water[:, 0] = True
    d = compare.distance_to_water(water, 90.0)
    assert d[5, 0] == 0 and d[5, 1] == 90 and d[5, 5] == 450 and d[5, 6] > 500  # 540 m is beyond the 500 m cap
    from pyproj import Transformer
    tr = Transformer.from_crs("EPSG:32748", "EPSG:4326", always_xy=True)
    s = {"utm": {"x0": 700000.0, "y0": 9300000.0, "zone": 48}, "dx": 90.0, "nx": 20, "ny": 20}
    h = np.zeros((20, 20), np.float32)
    h[:, 15:] = 0.5  # far land is wet
    land = ~water
    pt = lambda i: {"geometry": {"type": "Point", "coordinates": list(tr.transform(700000 + (i + 0.5) * 90, 9300000 - 10.5 * 90))},
                    "properties": {"depth_cm": 40}}
    r = compare.distance_class_scores([pt(1), pt(3), pt(16)], h, s, land, water, np.ones((20, 20), bool))
    c = r["classes"]
    assert (c["water"]["n"], c["le100"]["n"], c["100_500"]["n"], c["gt500"]["n"]) == (0, 1, 1, 1)
    assert c["gt500"]["hit_rate"] == 1.0 and c["le100"]["hit_rate"] == 0.0
    assert c["gt500"]["observed_median_m"] == 0.4 and c["gt500"]["model_median_m"] == 0.5
    assert abs(sum(v["share_of_cells"] for v in c.values()) - 1) < 1e-9
