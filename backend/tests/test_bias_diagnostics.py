"""Offline checks for the snapshot-only bias diagnostic helpers."""

import pandas as pd
import pytest

from scripts.bias_diagnostics import (
    leave_one_day_out_correction,
    ols_diagnostics,
    positive_day_run,
    select_latest_short_horizon,
    shifted_comparison,
)


def test_shift_uses_observed_half_hour_and_stated_sign() -> None:
    selected = pd.DataFrame({
        "startTime": pd.to_datetime(["2026-01-01T01:00:00Z"]),
        "forecast_mw": [110],
    })
    actuals = pd.DataFrame({
        "startTime": pd.to_datetime(["2026-01-01T00:30:00Z", "2026-01-01T01:00:00Z", "2026-01-01T01:30:00Z"]),
        "generation": [90, 100, 120],
    })
    assert shifted_comparison(selected, actuals, -30)["actual_mw"].tolist() == [90]
    assert shifted_comparison(selected, actuals, 0)["actual_mw"].tolist() == [100]
    assert shifted_comparison(selected, actuals, 30)["actual_mw"].tolist() == [120]


def test_ols_short_horizon_and_positive_run() -> None:
    regression = ols_diagnostics(pd.DataFrame({"forecast_mw": [1, 2, 3], "actual_mw": [3, 5, 7]}))
    assert regression["intercept_mw"] == pytest.approx(1)
    assert regression["slope"] == pytest.approx(2)
    assert regression["r_squared"] == pytest.approx(1)
    assert regression["median_forecast_actual_ratio"] == pytest.approx(0.4)

    forecasts = pd.DataFrame({
        "startTime": pd.to_datetime(["2026-01-01T12:00:00Z"] * 3),
        "publishTime": pd.to_datetime(["2026-01-01T05:00:00Z", "2026-01-01T07:00:00Z", "2026-01-01T13:00:00Z"]),
        "horizon_hours": [7, 5, -1],
        "generation": [100, 110, 120],
    })
    assert select_latest_short_horizon(forecasts)["forecast_mw"].tolist() == [110]
    run = positive_day_run([
        {"delivery_day": "2026-01-01", "bias_mw": 2},
        {"delivery_day": "2026-01-02", "bias_mw": 3},
        {"delivery_day": "2026-01-03", "bias_mw": -1},
    ])
    assert (run["positive_days"], run["longest_run_days"]) == (2, 2)
    assert run["longest_run_start"] == "2026-01-01"


def test_leave_one_day_out_excludes_held_out_day() -> None:
    frame = pd.DataFrame({
        "startTime": pd.to_datetime(["2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z", "2026-01-02T00:00:00Z"]),
        "forecast_mw": [12, 16, 30],
        "actual_mw": [10, 10, 10],
    })
    corrected = leave_one_day_out_correction(frame)
    assert corrected["training_bias_mw"].tolist() == [20, 20, 4]
    assert corrected["forecast_mw"].tolist() == [-8, -4, 26]
    assert frame["forecast_mw"].tolist() == [12, 16, 30]
