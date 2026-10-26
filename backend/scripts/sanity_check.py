"""Reproduce real-snapshot cutoff, coverage, and accuracy sanity checks."""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.forecast_selector import delivery_days  # noqa: E402
from app.services.metrics import compute_metrics, join_decision_actuals  # noqa: E402
from app.services.snapshot import load_snapshot  # noqa: E402


def _timestamp(value: pd.Timestamp) -> str:
    return value.isoformat().replace("+00:00", "Z")


def _hourly_average_actuals(actuals: pd.DataFrame) -> pd.DataFrame:
    """Average each UTC hour's :00 and :30 FUELHH MW observations."""
    frame = actuals[["startTime", "generation"]].copy()
    frame["hour_start"] = frame["startTime"].dt.floor("h")
    counts = frame.groupby("hour_start").size()
    if not counts.eq(2).all():
        raise AssertionError("Every UTC hour must have exactly two half-hour actuals")
    return frame.groupby("hour_start", as_index=False)["generation"].mean().rename(columns={"hour_start": "startTime"})


def run_checks() -> dict[str, Any]:
    snapshot = load_snapshot()
    days: list[date] = snapshot.available_days
    if days != list(pd.date_range("2026-01-01", "2026-02-01").date):
        raise AssertionError("Snapshot must cover January 1 through February 1 delivery days")
    selected = snapshot.selected(9)
    assert (selected["publishTime"] <= selected["cutoff_time"]).all(), "A selected forecast was published after cutoff"
    assert selected["horizon_hours"].ge(0).all(), "A selected forecast has negative horizon"
    local_days = delivery_days(selected["startTime"])
    per_day: list[dict[str, Any]] = []
    for day in days:
        frame = selected.loc[local_days == day]
        assert len(frame) == 24, f"{day}: expected 24 selected forecast hours, got {len(frame)}"
        per_day.append({
            "delivery_day": day.isoformat(),
            "selected_hours": len(frame),
            "horizon_hours": {"min": float(frame["horizon_hours"].min()), "median": float(frame["horizon_hours"].median()), "max": float(frame["horizon_hours"].max())},
            "publishTime_range_utc": {"min": _timestamp(frame["publishTime"].min()), "max": _timestamp(frame["publishTime"].max())},
        })

    hourly_actuals = _hourly_average_actuals(snapshot.actuals)
    sensitivity: list[dict[str, Any]] = []
    for hour in (7, 9, 11):
        chosen = snapshot.selected(hour)
        for basis, actuals in (("start_of_hour_actual", snapshot.actuals), ("hourly_mean_actual", hourly_actuals)):
            joined = join_decision_actuals(chosen, actuals)
            sensitivity.append({"cutoff_hour": hour, "actual_basis": basis, **compute_metrics(joined)})

    baseline = snapshot.joined(9)
    baseline_days = delivery_days(baseline["startTime"])
    january_decisions = baseline.loc[
        (baseline_days >= date(2026, 1, 2)) & (baseline_days <= date(2026, 2, 1))
    ]
    daily = [
        {"delivery_day": day.isoformat(), **compute_metrics(baseline.loc[baseline_days == day])}
        for day in days
    ]
    by_hour = [
        {"hour_london": hour, **compute_metrics(baseline.loc[baseline["startTime"].dt.tz_convert("Europe/London").dt.hour == hour])}
        for hour in range(24)
    ]
    report = {
        "per_day_selection": per_day,
        "selection_summary": {
            "days": len(days),
            "selected_hours": len(selected),
            "all_published_by_cutoff": True,
            "horizon_hours": {"min": float(selected["horizon_hours"].min()), "median": float(selected["horizon_hours"].median()), "max": float(selected["horizon_hours"].max())},
            "publishTime_range_utc": {"min": _timestamp(selected["publishTime"].min()), "max": _timestamp(selected["publishTime"].max())},
        },
        "baseline_cutoff_9": compute_metrics(baseline),
        "january_decisions_cutoff_9": compute_metrics(january_decisions),
        "sensitivity": sensitivity,
        "worst_three_days_mae": sorted(daily, key=lambda row: row["mae_mw"], reverse=True)[:3],
        "best_three_days_mae": sorted(daily, key=lambda row: row["mae_mw"])[:3],
        "hour_largest_positive_bias": max(by_hour, key=lambda row: row["bias_mw"]),
        "hour_largest_absolute_bias": max(by_hour, key=lambda row: abs(row["bias_mw"])),
    }
    return report


if __name__ == "__main__":
    print(json.dumps(run_checks(), indent=2))
