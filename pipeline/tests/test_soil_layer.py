import json

import numpy as np
import pytest

pytest.importorskip("geopandas")
import rasterio  # noqa: E402

from engine_pack import soil_geojson  # noqa: E402


def test_soil_layer_groups_and_shares(tmp_path):
    hsg = np.full((20, 20), 3, np.uint8)
    hsg[:, :5] = 2  # a C strip
    keep = np.ones_like(hsg, bool)
    keep[0, :] = False  # outside the domain
    tr = rasterio.transform.from_origin(700000, 9300000, 30, 30)
    info = soil_geojson(hsg, keep, tr, "EPSG:32748", tmp_path / "soil.geojson")
    fc = json.loads((tmp_path / "soil.geojson").read_text())
    assert sorted(f["properties"]["hsg"] for f in fc["features"]) == ["C", "D"]
    assert info["groups"]["C"] == pytest.approx(0.25) and info["groups"]["D"] == pytest.approx(0.75)
