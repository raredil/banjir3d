"""Checks of gauge_merge.py: the ratio field equals the gauge ratio next to a lone gauge, fades to 1 far away, and day windows
follow the 07:00 WIB (00:00 UTC) reading."""
import importlib.util
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

spec = importlib.util.spec_from_file_location("gm", Path(__file__).with_name("gauge_merge.py"))
gm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gm)


def test_field_near_and_far():
    gs = [{"lon": 106.8, "lat": -6.2, "lnr": math.log(2.0)}]
    near = gm.field(gs, 106.8, -6.2, 10.0)
    far = gm.field(gs, 107.3, -6.2, 10.0)  # ~55 km away
    assert abs(near - 2.0 ** (1 / (1 + 1 / 100))) < 1e-9  # w = 1/(0 + 1 km^2), fade weight 1/L^2
    assert 1.0 <= far < 1.05


def test_gauge_day_window():
    t0 = datetime(2020, 1, 1, 0, tzinfo=timezone.utc)
    ends = [t0 - timedelta(hours=30) + timedelta(hours=h) for h in range(60)]  # hour ends from 30 Dec 18 UTC
    series = [1.0] * 60
    G, S, used, miss = gm.gauge_totals({"days": {"2020-01-01": 50.0, "2020-01-03": 10.0}}, ends, series)
    assert used == ["2020-01-01"] and G == 50.0  # 3 Jan reading is outside the series
    assert S == 24.0 and miss == 0.0  # 31 Dec 00 UTC < t <= 1 Jan 00 UTC
