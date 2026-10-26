"""Normalize BMRS rows and load the committed CSV snapshot without network access."""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd

from app.config import DATA_DIR

logger = logging.getLogger(__name__)
ACTUAL_COLUMNS = ["startTime", "settlementDate", "settlementPeriod", "publishTime", "generation"]
FORECAST_COLUMNS = ["startTime", "publishTime", "generation", "horizon_hours"]


def _utc_column(frame: pd.DataFrame, name: str) -> None:
    frame[name] = pd.to_datetime(frame[name], utc=True, errors="coerce")
    if frame[name].isna().any():
        raise ValueError(f"{name} contains missing or invalid timestamps")


def _generation_column(frame: pd.DataFrame) -> None:
    frame["generation"] = pd.to_numeric(frame["generation"], errors="coerce").astype("Int64")


def _deduplicate(frame: pd.DataFrame, key: list[str], label: str) -> tuple[pd.DataFrame, dict[str, int]]:
    exact_count = int(frame.duplicated().sum())
    key_count = int(frame.duplicated(subset=key, keep="last").sum())
    if key_count:
        logger.warning("%s: keeping last row for %d duplicate keys (%d exact rows)", label, key_count, exact_count)
    return frame.drop_duplicates(subset=key, keep="last").reset_index(drop=True), {
        "exact_duplicates": exact_count,
        "duplicate_keys": key_count,
    }


def clean_actuals(rows: list[dict[str, Any]]) -> tuple[pd.DataFrame, dict[str, int]]:
    """Type and deduplicate FUELHH WIND rows, preserving missing generation for validation."""
    frame = pd.DataFrame(rows)
    if frame.empty:
        raise ValueError("FUELHH returned no rows")
    if not set(ACTUAL_COLUMNS).issubset(frame.columns):
        raise ValueError(f"FUELHH is missing columns: {sorted(set(ACTUAL_COLUMNS) - set(frame.columns))}")
    if "fuelType" in frame and not frame["fuelType"].eq("WIND").all():
        raise ValueError("FUELHH response contains a non-WIND fuel type")
    frame = frame[ACTUAL_COLUMNS].copy()
    _utc_column(frame, "startTime")
    _utc_column(frame, "publishTime")
    frame["settlementDate"] = pd.to_datetime(frame["settlementDate"], errors="coerce")
    if frame["settlementDate"].isna().any():
        raise ValueError("settlementDate contains missing or invalid dates")
    frame["settlementPeriod"] = pd.to_numeric(frame["settlementPeriod"], errors="coerce").astype("Int64")
    _generation_column(frame)
    frame, counts = _deduplicate(frame, ["startTime"], "FUELHH")
    return frame.sort_values("startTime").reset_index(drop=True), counts


def clean_forecasts(rows: list[dict[str, Any]]) -> tuple[pd.DataFrame, dict[str, int]]:
    """Type and deduplicate WINDFOR rows, calculating their forecast horizon."""
    frame = pd.DataFrame(rows)
    required = {"startTime", "publishTime", "generation"}
    if frame.empty:
        raise ValueError("WINDFOR returned no rows")
    if not required.issubset(frame.columns):
        raise ValueError(f"WINDFOR is missing columns: {sorted(required - set(frame.columns))}")
    frame = frame[["startTime", "publishTime", "generation"]].copy()
    _utc_column(frame, "startTime")
    _utc_column(frame, "publishTime")
    _generation_column(frame)
    frame["horizon_hours"] = (frame["startTime"] - frame["publishTime"]).dt.total_seconds() / 3600
    frame, counts = _deduplicate(frame, ["startTime", "publishTime"], "WINDFOR")
    return frame.sort_values(["startTime", "publishTime"]).reset_index(drop=True), counts


@lru_cache(maxsize=4)
def _read_actuals(path: str) -> pd.DataFrame:
    frame = pd.read_csv(path)
    frame["startTime"] = pd.to_datetime(frame["startTime"], utc=True)
    frame["publishTime"] = pd.to_datetime(frame["publishTime"], utc=True)
    frame["settlementDate"] = pd.to_datetime(frame["settlementDate"])
    frame["settlementPeriod"] = frame["settlementPeriod"].astype("Int64")
    frame["generation"] = frame["generation"].astype("Int64")
    return frame[ACTUAL_COLUMNS]


@lru_cache(maxsize=4)
def _read_forecasts(path: str) -> pd.DataFrame:
    frame = pd.read_csv(path)
    frame["startTime"] = pd.to_datetime(frame["startTime"], utc=True)
    frame["publishTime"] = pd.to_datetime(frame["publishTime"], utc=True)
    frame["generation"] = frame["generation"].astype("Int64")
    frame["horizon_hours"] = frame["horizon_hours"].astype(float)
    return frame[FORECAST_COLUMNS]


def load_actuals(path: Path | None = None) -> pd.DataFrame:
    """Return a typed copy of the cached actuals snapshot."""
    source = path or DATA_DIR / "actuals_wind_2026-01-01_2026-02-01.csv.gz"
    return _read_actuals(str(source.resolve())).copy(deep=True)


def load_forecasts(path: Path | None = None) -> pd.DataFrame:
    """Return a typed copy of the cached forecast snapshot."""
    source = path or DATA_DIR / "forecasts_wind_2026-01-01_2026-02-01.csv.gz"
    return _read_forecasts(str(source.resolve())).copy(deep=True)
