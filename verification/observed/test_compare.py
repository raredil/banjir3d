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
