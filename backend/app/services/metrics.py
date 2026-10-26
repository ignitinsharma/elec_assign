"""Pure accuracy calculations on exact hourly WINDFOR/FUELHH startTime joins.

No forecast is interpolated to a FUELHH :30 slot. Error is forecast minus
actual MW; a positive value is a wind shortfall requiring extra procurement.
"""

from __future__ import annotations

from math import sqrt
from typing import TypedDict
from zoneinfo import ZoneInfo

import pandas as pd

from app.config import TIMEZONE

LONDON = ZoneInfo(TIMEZONE)
HORIZON_EDGES = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, float("inf")]
HORIZON_LABELS = [f"{int(left)}-{int(right)}" if right != float("inf") else f"{int(left)}+" for left, right in zip(HORIZON_EDGES[:-1], HORIZON_EDGES[1:])]


class MetricValues(TypedDict):
    n: int
    mae_mw: float | None
    rmse_mw: float | None
    bias_mw: float | None
    mape_percent: float | None
    mean_actual_mw: float | None
    nmae: float | None
    error_std_mw: float | None
    p50_abs_error_mw: float | None
    p90_abs_error_mw: float | None
    p95_abs_error_mw: float | None
    p90_shortfall_mw: float | None
    p95_shortfall_mw: float | None


class BreakdownRow(TypedDict):
    key: str
    metrics: MetricValues


class AccuracyBreakdowns(TypedDict):
    by_delivery_day: list[BreakdownRow]
    by_hour_london: list[BreakdownRow]
    by_horizon_bucket: list[BreakdownRow]
    by_wind_band: list[BreakdownRow]
    wind_band_thresholds_mw: list[float]


def join_decision_actuals(selected: pd.DataFrame, actuals: pd.DataFrame) -> pd.DataFrame:
    """Inner-join selected hourly forecasts to actuals on exact UTC startTime."""
    joined = selected.merge(
        actuals[["startTime", "generation"]].rename(columns={"generation": "actual_mw"}),
        on="startTime",
        how="inner",
        validate="one_to_one",
    )
    joined["error_mw"] = joined["forecast_mw"] - joined["actual_mw"]
    joined["shortfall_mw"] = joined["error_mw"].clip(lower=0)
    return joined


def compute_metrics(frame: pd.DataFrame) -> MetricValues:
    """Calculate unrounded metrics; percentiles use linear interpolation.

    Error standard deviation uses the population denominator (ddof=0).
    MAPE excludes zero-actual rows and is null if none remain.
    """
    valid = frame[["forecast_mw", "actual_mw"]].dropna().astype(float)
    n = len(valid)
    if not n:
        return {"n": 0, "mae_mw": None, "rmse_mw": None, "bias_mw": None, "mape_percent": None,
                "mean_actual_mw": None, "nmae": None, "error_std_mw": None, "p50_abs_error_mw": None,
                "p90_abs_error_mw": None, "p95_abs_error_mw": None, "p90_shortfall_mw": None,
                "p95_shortfall_mw": None}
    error = valid["forecast_mw"] - valid["actual_mw"]
    absolute = error.abs()
    shortfall = error.clip(lower=0)
    nonzero_actual = valid["actual_mw"] != 0
    mean_actual = float(valid["actual_mw"].mean())
    mae = float(absolute.mean())
    return {
        "n": n,
        "mae_mw": mae,
        "rmse_mw": sqrt(float((error**2).mean())),
        "bias_mw": float(error.mean()),
        "mape_percent": float((absolute[nonzero_actual] / valid.loc[nonzero_actual, "actual_mw"].abs()).mean() * 100) if nonzero_actual.any() else None,
        "mean_actual_mw": mean_actual,
        "nmae": mae / mean_actual if mean_actual != 0 else None,
        "error_std_mw": float(error.std(ddof=0)),
        "p50_abs_error_mw": float(absolute.quantile(0.50)),
        "p90_abs_error_mw": float(absolute.quantile(0.90)),
        "p95_abs_error_mw": float(absolute.quantile(0.95)),
        "p90_shortfall_mw": float(shortfall.quantile(0.90)),
        "p95_shortfall_mw": float(shortfall.quantile(0.95)),
    }


def horizon_buckets(hours: pd.Series) -> pd.Series:
    """Return left-closed, right-open six-hour forecast-horizon buckets."""
    return pd.cut(hours, bins=HORIZON_EDGES, labels=HORIZON_LABELS, right=False)


def _breakdown(frame: pd.DataFrame, keys: pd.Series, order: list[str] | None = None) -> list[BreakdownRow]:
    grouped = frame.assign(_key=keys.astype(str)).groupby("_key", sort=False)
    rows: list[BreakdownRow] = [{"key": str(key), "metrics": compute_metrics(group)} for key, group in grouped]
    if order is None:
        return sorted(rows, key=lambda row: row["key"])
    position = {key: index for index, key in enumerate(order)}
    return sorted(rows, key=lambda row: position.get(row["key"], len(position)))


def decision_breakdowns(frame: pd.DataFrame) -> AccuracyBreakdowns:
    """Break decision-time errors down by local day/hour, lead time, and wind level."""
    if frame.empty:
        return {"by_delivery_day": [], "by_hour_london": [], "by_horizon_bucket": [], "by_wind_band": [], "wind_band_thresholds_mw": []}
    local_time = frame["startTime"].dt.tz_convert(LONDON)
    actual = frame["actual_mw"].astype(float)
    low = float(actual.quantile(1 / 3))
    high = float(actual.quantile(2 / 3))
    bands = pd.Series("high", index=frame.index)
    bands.loc[actual <= high] = "medium"
    bands.loc[actual <= low] = "low"
    return {
        "by_delivery_day": _breakdown(frame, local_time.dt.date.astype(str)),
        "by_hour_london": _breakdown(frame, local_time.dt.hour.astype(str), [str(hour) for hour in range(24)]),
        "by_horizon_bucket": _breakdown(frame, horizon_buckets(frame["horizon_hours"]), HORIZON_LABELS),
        "by_wind_band": _breakdown(frame, bands, ["low", "medium", "high"]),
        "wind_band_thresholds_mw": [low, high],
    }


def all_vintages_horizon_analysis(forecasts: pd.DataFrame, actuals: pd.DataFrame) -> list[BreakdownRow]:
    """Measure ALL nonnegative-horizon vintages, separate from decision-time metrics."""
    eligible = forecasts.loc[forecasts["horizon_hours"] >= 0, ["startTime", "generation", "horizon_hours"]]
    joined = eligible.rename(columns={"generation": "forecast_mw"}).merge(
        actuals[["startTime", "generation"]].rename(columns={"generation": "actual_mw"}),
        on="startTime",
        how="inner",
        validate="many_to_one",
    )
    return _breakdown(joined, horizon_buckets(joined["horizon_hours"]), HORIZON_LABELS)
