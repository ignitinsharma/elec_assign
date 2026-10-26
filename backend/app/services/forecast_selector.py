"""Select the latest WINDFOR vintage available before each delivery day's cutoff.

WINDFOR has hourly start times. Selection never creates forecasts for FUELHH's
intervening half-hour slots; comparison uses exact startTime joins only.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import pandas as pd

from app.config import TIMEZONE
from app.services.data_loader import load_forecasts

LONDON = ZoneInfo(TIMEZONE)
SELECTED_COLUMNS = ["startTime", "forecast_mw", "publishTime", "horizon_hours", "cutoff_time"]


def validate_cutoff_hour(cutoff_hour: int) -> None:
    if not 0 <= cutoff_hour <= 23:
        raise ValueError("cutoff_hour must be between 0 and 23")


def cutoff_for_day(day: date, cutoff_hour: int) -> datetime:
    """Return the decision cutoff for local delivery day D in Europe/London."""
    validate_cutoff_hour(cutoff_hour)
    return datetime.combine(day - timedelta(days=1), time(cutoff_hour), tzinfo=LONDON)


def delivery_days(start_times: pd.Series) -> pd.Series:
    """Map UTC start times to Europe/London local calendar dates."""
    return start_times.dt.tz_convert(LONDON).dt.date


def select_decision_forecast(forecasts: pd.DataFrame, cutoff_hour: int) -> pd.DataFrame:
    """Choose the latest publishTime <= each delivery day's local cutoff.

    All filtering and per-startTime selection is vectorised. A publishTime
    exactly on the cutoff is eligible; later vintages are excluded.
    """
    validate_cutoff_hour(cutoff_hour)
    if forecasts.empty:
        return pd.DataFrame(columns=SELECTED_COLUMNS)
    frame = forecasts[["startTime", "publishTime", "generation"]].copy()
    local_naive_day = frame["startTime"].dt.tz_convert(LONDON).dt.tz_localize(None).dt.normalize()
    frame["cutoff_time"] = (
        (local_naive_day - pd.to_timedelta(1, unit="D") + pd.to_timedelta(cutoff_hour, unit="h"))
        .dt.tz_localize(LONDON)
        .dt.tz_convert(timezone.utc)
    )
    frame = frame.loc[frame["publishTime"] <= frame["cutoff_time"]]
    frame = frame.sort_values(["startTime", "publishTime"]).drop_duplicates("startTime", keep="last")
    frame = frame.rename(columns={"generation": "forecast_mw"})
    frame["horizon_hours"] = (frame["startTime"] - frame["publishTime"]).dt.total_seconds() / 3600
    return frame[SELECTED_COLUMNS].sort_values("startTime").reset_index(drop=True)


def select_vintages_for(forecasts: pd.DataFrame, day: date, cutoff_hour: int) -> pd.DataFrame:
    """Return every vintage for local day D published no later than its cutoff."""
    cutoff = cutoff_for_day(day, cutoff_hour).astimezone(timezone.utc)
    frame = forecasts.loc[(delivery_days(forecasts["startTime"]) == day) & (forecasts["publishTime"] <= cutoff)].copy()
    frame = frame.rename(columns={"generation": "forecast_mw"})
    return frame[["startTime", "publishTime", "forecast_mw", "horizon_hours"]].sort_values(
        ["publishTime", "startTime"]
    ).reset_index(drop=True)


def select_vintages(day: date, cutoff_hour: int) -> pd.DataFrame:
    """Return cutoff-eligible vintages from the committed January snapshot."""
    return select_vintages_for(load_forecasts(), day, cutoff_hour)
