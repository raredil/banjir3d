import numpy as np
import pytest

pytest.importorskip("pyproj")
pytest.importorskip("scipy")

from micro_drains import capacity, manning_n, sink  # noqa: E402


def test_capacity_manning():
    # 0.5 x 0.5 m open concrete drain, S = 0.004: A = 0.25, P = 1.5, R = 1/6
    q = capacity(0.5, 0.5, False, 0.015, 0.004)
    assert q == pytest.approx(0.25 * (1 / 6) ** (2 / 3) * 0.004 ** 0.5 / 0.015, rel=1e-9)
    assert capacity(0.5, 0.5, True, 0.015, 0.004) < q  # closed box: more wetted perimeter
    assert manning_n("Cor Beton") == 0.015 and manning_n("Turap Batu Kali") == 0.025 and manning_n("") == 0.020


def _fc(lines, w=0.5, d=0.5):
    from pyproj import Transformer

    tf = Transformer.from_crs("EPSG:32748", "EPSG:4326", always_xy=True)
    feats = []
    for ln in lines:
        lon, lat = tf.transform([p[0] for p in ln], [p[1] for p in ln])
        feats.append({"type": "Feature", "properties": {"w_m": w, "d_m": d, "jenis": "Terbuka", "konstruksi": "Cor Beton"},
                      "geometry": {"type": "LineString", "coordinates": [[a, b] for a, b in zip(lon, lat)]}})
    return {"type": "FeatureCollection", "features": feats}


def test_sink_network_capacity_over_served_area():
    # 40 x 40 cells of 30 m; a river along column 30; one drain from x = 150 m to the river along row 20
    ny = nx = 40
    x0, y0, dx = 700000.0, 9300000.0, 30.0
    z = np.tile(np.linspace(10, 6, nx), (ny, 1))
    chan = np.zeros((ny, nx), bool)
    chan[:, 30] = True
    sea = np.zeros_like(chan)
    yrow = y0 - 20.5 * dx
    fc = _fc([[(x0 + 150, yrow), (x0 + 30 * dx, yrow)]])
    rate, info = sink(fc, z, chan, sea, (x0, y0), dx)
    assert info["networks"] == 1 and info["networks_with_outlet"] == 1
    served = rate > 0
    assert not served[chan].any()
    # all served cells share one rate, and rate x served area = drain capacity
    q = info["capacity_outlets_m3s"]
    assert np.allclose(rate[served], rate[served][0])
    assert rate[served].sum() * dx * dx == pytest.approx(q, rel=0.06)  # q rounded to 0.1 m3/s in the summary
    # cells farther than 100 m from the drain are not served
    assert not served[0, 10] and served[20, 10]
