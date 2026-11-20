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
