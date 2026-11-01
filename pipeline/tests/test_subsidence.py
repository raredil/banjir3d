import numpy as np

from subsidence import mean_sinking


def test_mean_sinking_vertical_and_capped():
    u = np.full((1, 3), 0.8)
    # three years of LOS velocity (mm/yr, + = towards the satellite): sinking cell, uplift cell, cell with one missing year
    los = np.array([[[-8.0, 4.0, -16.0]], [[-8.0, 2.0, np.nan]], [[-8.0, 6.0, -16.0]]])
    sd = np.full_like(los, 2.0)
    sink, se, v_up = mean_sinking(los, sd, u)
    assert np.allclose(sink[0], [10.0, 0.0, 20.0])  # -(-8)/0.8, uplift capped at 0, mean of available years
    assert v_up[0, 1] > 0
    assert np.isclose(se[0, 0], np.sqrt(3 * 4.0) / 3 / 0.8)


def test_mean_sinking_no_data():
    los = np.full((2, 1, 1), np.nan)
    sink, se, _ = mean_sinking(los, los.copy(), np.full((1, 1), 0.78))
    assert np.isnan(sink[0, 0]) and np.isnan(se[0, 0])
