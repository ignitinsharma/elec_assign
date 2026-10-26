"""Diagnose January wind forecast bias using only the committed BMRS snapshot.

Shifts compare a forecast for UTC time t with the actual at t + shift. The
baseline uses exact hourly :00 actuals; half-hour shifts use observed FUELHH
rows and never interpolate. Positive error means forecast minus actual > 0.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import DATA_DIR  # noqa: E402
from app.services.forecast_selector import delivery_days  # noqa: E402
from app.services.metrics import compute_metrics, decision_breakdowns, join_decision_actuals  # noqa: E402
from app.services.snapshot import Snapshot, load_snapshot  # noqa: E402

SHIFT_MINUTES = (-180, -120, -60, -30, 0, 30, 60, 120, 180)


def shifted_comparison(selected: pd.DataFrame, actuals: pd.DataFrame, shift_minutes: int) -> pd.DataFrame:
    """Pair forecast(t) with observed actual(t + shift), without interpolation."""
    frame = selected[["startTime", "forecast_mw"]].copy()
    frame["actual_time"] = frame["startTime"] + pd.to_timedelta(shift_minutes, unit="m")
    actual = actuals[["startTime", "generation"]].rename(
        columns={"startTime": "actual_time", "generation": "actual_mw"}
    )
    return frame.merge(actual, on="actual_time", how="inner", validate="one_to_one")


def comparison_summary(frame: pd.DataFrame) -> dict[str, Any]:
    """Return unrounded error metrics and Pearson correlation."""
    metrics = compute_metrics(frame)
    correlation = frame["forecast_mw"].corr(frame["actual_mw"]) if len(frame) > 1 else float("nan")
    return {
        "n": metrics["n"],
        "mae_mw": metrics["mae_mw"],
        "bias_mw": metrics["bias_mw"],
        "rmse_mw": metrics["rmse_mw"],
        "pearson_r": float(correlation) if pd.notna(correlation) else None,
    }


def ols_diagnostics(frame: pd.DataFrame) -> dict[str, float | None]:
    """Fit actual = intercept + slope * forecast by ordinary least squares."""
    valid = frame[["forecast_mw", "actual_mw"]].dropna().astype(float)
    forecast = valid["forecast_mw"].to_numpy()
    actual = valid["actual_mw"].to_numpy()
    design = np.column_stack((np.ones(len(valid)), forecast))
    intercept, slope = np.linalg.lstsq(design, actual, rcond=None)[0]
    predicted = intercept + slope * forecast
    total = float(np.square(actual - actual.mean()).sum())
    r_squared = 1 - float(np.square(actual - predicted).sum()) / total if total else None
    nonzero = valid["actual_mw"] != 0
    ratio = (valid.loc[nonzero, "forecast_mw"] / valid.loc[nonzero, "actual_mw"]).median()
    return {
        "intercept_mw": float(intercept),
        "slope": float(slope),
        "r_squared": r_squared,
        "median_forecast_actual_ratio": float(ratio) if pd.notna(ratio) else None,
    }


def positive_day_run(daily: list[dict[str, Any]]) -> dict[str, Any]:
    """Summarise the fraction and longest consecutive run of positive-bias days."""
    longest = 0
    current = 0
    longest_end = -1
    positive = 0
    for index, row in enumerate(daily):
        if row["bias_mw"] > 0:
            positive += 1
            current += 1
            if current > longest:
                longest = current
                longest_end = index
        else:
            current = 0
    return {
        "positive_days": positive,
        "positive_days_percent": 100 * positive / len(daily) if daily else None,
        "longest_run_days": longest,
        "longest_run_start": daily[longest_end - longest + 1]["delivery_day"] if longest else None,
        "longest_run_end": daily[longest_end]["delivery_day"] if longest else None,
    }


def select_latest_short_horizon(forecasts: pd.DataFrame) -> pd.DataFrame:
    """Select the most recent 0–6 h vintage for each hourly startTime."""
    eligible = forecasts.loc[forecasts["horizon_hours"].between(0, 6, inclusive="both")]
    return (
        eligible.sort_values(["startTime", "publishTime"])
        .drop_duplicates("startTime", keep="last")
        .rename(columns={"generation": "forecast_mw"})
    )[["startTime", "forecast_mw", "publishTime", "horizon_hours"]].reset_index(drop=True)


def leave_one_day_out_correction(frame: pd.DataFrame) -> pd.DataFrame:
    """Subtract mean error from all other local delivery days for each row.

    This cross-validation illustration uses future days and is not a
    chronological trading simulation or a production calibration.
    """
    corrected = frame.copy()
    corrected["delivery_day"] = delivery_days(corrected["startTime"])
    corrected["error_mw"] = corrected["forecast_mw"] - corrected["actual_mw"]
    by_day = corrected.groupby("delivery_day")["error_mw"].transform("sum")
    counts = corrected.groupby("delivery_day")["error_mw"].transform("count")
    denominator = len(corrected) - counts
    if denominator.eq(0).any():
        raise ValueError("Leave-one-day-out correction requires at least two delivery days")
    corrected["training_bias_mw"] = (corrected["error_mw"].sum() - by_day) / denominator
    corrected["forecast_mw"] = corrected["forecast_mw"] - corrected["training_bias_mw"]
    return corrected


def run_analysis(snapshot: Snapshot) -> dict[str, Any]:
    """Calculate all diagnostics from the already-loaded committed snapshot."""
    selected = snapshot.selected(9)
    baseline = snapshot.joined(9)
    shifts = [
        {"shift_minutes": minutes, **comparison_summary(shifted_comparison(selected, snapshot.actuals, minutes))}
        for minutes in SHIFT_MINUTES
    ]
    best_shift = min(shifts, key=lambda row: row["mae_mw"])
    unshifted = next(row for row in shifts if row["shift_minutes"] == 0)

    breakdowns = decision_breakdowns(baseline)
    daily = [
        {"delivery_day": row["key"], "n": row["metrics"]["n"], "bias_mw": row["metrics"]["bias_mw"]}
        for row in breakdowns["by_delivery_day"]
    ]
    terciles = [
        {"band": row["key"], "n": row["metrics"]["n"], "bias_mw": row["metrics"]["bias_mw"]}
        for row in breakdowns["by_wind_band"]
    ]

    short_selected = select_latest_short_horizon(snapshot.forecasts)
    short_joined = join_decision_actuals(short_selected, snapshot.actuals)
    matched_decision = baseline.loc[baseline["startTime"].isin(short_joined["startTime"])]

    corrected = leave_one_day_out_correction(baseline)
    uncorrected_metrics = compute_metrics(baseline)
    corrected_metrics = compute_metrics(corrected)
    return {
        "analysed_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "basis": "January 2026; cutoff 09:00 Europe/London on D-1; error = forecast - actual MW; exact hourly :00 actuals",
        "time_alignment": {
            "shift_definition": "forecast at t compared with actual at t + shift; no interpolation",
            "rows": shifts,
            "best_mae_shift_minutes": best_shift["shift_minutes"],
            "best_mae_reduction_percent": 100 * (unshifted["mae_mw"] - best_shift["mae_mw"]) / unshifted["mae_mw"],
        },
        "bias_structure": {
            "ols_actual_on_forecast": ols_diagnostics(baseline),
            "wind_tercile_thresholds_mw": breakdowns["wind_band_thresholds_mw"],
            "by_wind_level": terciles,
            "by_delivery_day": daily,
            "positive_day_run": positive_day_run(daily),
        },
        "horizon_check": {
            "window": "0 <= horizon_hours <= 6; latest eligible vintage per startTime",
            "decision_full": comparison_summary(baseline),
            "decision_same_hours": comparison_summary(matched_decision),
            "short_horizon_same_hours": comparison_summary(short_joined),
        },
        "bias_correction_illustration": {
            "method": "Leave one delivery day out; subtract other days' mean error; illustrative, not for production",
            "uncorrected": {key: uncorrected_metrics[key] for key in ("n", "mae_mw", "p90_shortfall_mw", "p95_shortfall_mw")},
            "corrected": {key: corrected_metrics[key] for key in ("n", "mae_mw", "p90_shortfall_mw", "p95_shortfall_mw")},
        },
        "definitions": {
            "fuelhh": {
                "dataset_url": "https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream",
                "context_url": "https://bmrs.elexon.co.uk/generation-by-fuel-type",
                "context_quote": "The data comes from Operational Metering for BMUs connected to the transmission system",
                "documented": "Operational Metering for BMUs connected to the transmission system; embedded generation and wind farms without operational meters are excluded.",
            },
            "windfor": {
                "dataset_url": "https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream",
                "context_url": "https://bmrs.elexon.co.uk/wind-generation",
                "context_quote": "wind farms which are visible to the ESO and have operational metering",
                "documented": "Forecasts wind farms visible to the ESO with operational metering.",
            },
            "unclear": "The documentation does not provide a matched asset list or prove identical WINDFOR/FUELHH WIND scope for January 2026.",
        },
    }


def print_report(report: dict[str, Any]) -> None:
    """Print compact, labelled tables; JSON retains unrounded values."""
    alignment = report["time_alignment"]
    print("Time alignment: forecast at t versus actual at t + shift (minutes)")
    print(pd.DataFrame(alignment["rows"]).round(2).to_string(index=False))
    print(f"Best MAE shift: {alignment['best_mae_shift_minutes']:+d} minutes")

    structure = report["bias_structure"]
    print("\nOLS: actual = a + b × forecast")
    print(pd.DataFrame([structure["ols_actual_on_forecast"]]).round(4).to_string(index=False))
    print("\nBias by actual wind-level tercile (MW)")
    print(pd.DataFrame(structure["by_wind_level"]).round(2).to_string(index=False))
    print("\nBias by delivery day (MW)")
    print(pd.DataFrame(structure["by_delivery_day"]).round(2).to_string(index=False))
    print("\nPositive-bias day run")
    print(pd.DataFrame([structure["positive_day_run"]]).round(2).to_string(index=False))

    print("\nShort-horizon versus decision-time (MW; same-hour rows are paired)")
    horizon = report["horizon_check"]
    print(pd.DataFrame([{"basis": key, **horizon[key]} for key in
                        ("decision_full", "decision_same_hours", "short_horizon_same_hours")]).round(2).to_string(index=False))

    print("\nLeave-one-day-out constant correction (illustrative, not for production)")
    correction = report["bias_correction_illustration"]
    print(pd.DataFrame([{"basis": key, **correction[key]} for key in ("uncorrected", "corrected")]).round(2).to_string(index=False))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DATA_DIR / "bias_diagnostics.json")
    args = parser.parse_args()
    report = run_analysis(load_snapshot())
    print_report(report)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(f"\nWrote {args.output}")


if __name__ == "__main__":
    main()
