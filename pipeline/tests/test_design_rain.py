"""Return-period design rain: Gumbel and log-Pearson III numbers checked by hand (Chow, Maidment and Mays 1988, ch. 12)."""
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import design_rain as dr  # noqa: E402


def test_gumbel_by_hand():
    x = [100, 120, 140, 160, 180]  # mean 140, s = sqrt(4000 / 4) = 31.623
    f = dr.gumbel_fit(x)
    assert f["mean"] == pytest.approx(140)
    assert f["s"] == pytest.approx(math.sqrt(1000))
    # K_T = -(sqrt 6 / pi)(0.5772 + ln ln (T / (T - 1))): T = 2 -> -0.164, T = 100 -> 3.137
    assert dr.gumbel_k(2) == pytest.approx(-0.1643, abs=1e-3)
    assert dr.gumbel_k(100) == pytest.approx(3.1367, abs=1e-3)
    assert f["R"][100] == pytest.approx(140 + 3.1367 * 31.623, abs=0.1)  # 239.2 mm
    # the Gumbel CDF at the T-year value is 1 - 1/T
    assert dr.gumbel_cdf(f["R"][100], f["mean"], f["s"]) == pytest.approx(0.99, abs=1e-4)


def test_lp3_zero_skew_is_log_normal():
    y = np.array([2.0, 2.1, 2.2, 2.3, 2.4])  # symmetric logs: skew 0
    f = dr.lp3_fit(10 ** y)
    assert f["skewLog"] == pytest.approx(0, abs=1e-9)
    assert f["R"][2] == pytest.approx(10 ** 2.2, rel=1e-6)  # median
    z90 = 1.2815515655446004  # standard normal 0.9 quantile
    assert dr.lp3_fit(10 ** y)["R"][10] == pytest.approx(10 ** (2.2 + z90 * y.std(ddof=1)), rel=1e-6)


def test_ks_distance():
    x = [1, 2, 3, 4]
    assert dr.ks_distance(x, lambda v: np.clip((np.asarray(v) - 0.5) / 4, 0, 1)) == pytest.approx(0.125)


def test_imerg_ascii_answer_of_ges_disc():
    """A real GES DISC OPeNDAP answer (IMERG V07 daily, 17 May 2013, logged by the Action on 2026-11-20)."""
    import design_rain_imerg as di
    rows = [(106.55, "17.69, 28.065, 34.315, 19.215, 10.175, 4.02, 3.185, 0.615"), (106.65, "13.795, 32.02, 15.365, 25.965, 11.22, 5.71, 1.905, 0.26"),
            (106.75, "16.005, 14.815, 23.15, 22.52, 16.935, 15.585, 10.39, 0.48"), (106.85, "16.505, 11.645, 27.15, 20.655, 28.225, 124.975, 3.36, 0"),
            (106.95, "22.495, 16.64, 15.84, 21.385, 22.31, 11.45, 2, 1.245"), (107.05, "33.04, 17.885, 19.98, 18.57, 23.17, 5.05, 0.985, 1.53"),
            (107.15, "24.87, 40.195, 30.13, 46.225, 7.63, 4.08, 0.9, 1.32")]
    txt = "Dataset: 3B-DAY.MS.MRG.3IMERG.20130517-S000000-E235959.V07B.nc4\nprecipitation.lat, -6.65, -6.55, -6.45, -6.35, -6.25, -6.15, -6.05, -5.95\n"
    txt += "\n".join(f"precipitation.precipitation[precipitation.time=12185][precipitation.lon={lo}], {v}" for lo, v in rows)
    a = di.parse(txt.encode())
    assert a.shape == (8, 7)  # lat north to south, lon west to east
    assert a[2, 3] == pytest.approx(124.975)  # lat -6.15, lon 106.85
    assert a[0, 0] == pytest.approx(0.615) and a[7, 6] == pytest.approx(24.87)
