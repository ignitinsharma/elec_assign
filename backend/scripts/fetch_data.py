"""Fetch and validate a local FUELHH/WINDFOR snapshot from Elexon BMRS."""

from __future__ import annotations

import argparse
import calendar
import json
import logging
import sys
import time
from datetime import date, datetime, time as clock_time, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Iterator

import httpx
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import DATA_DIR  # noqa: E402
from app.services.data_loader import clean_actuals, clean_forecasts  # noqa: E402

logger = logging.getLogger(__name__)
BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
ACTUALS_URL = f"{BASE_URL}/datasets/FUELHH/stream"
FORECASTS_URL = f"{BASE_URL}/datasets/WINDFOR/stream"
RETRYABLE_STATUS = {429, 500, 502, 503, 504}


def daily_dates(start: date, end: date) -> Iterator[date]:
    """Yield inclusive dates; FUELHH settlementDateTo is inclusive."""
    day = start
    while day <= end:
        yield day
        day += timedelta(days=1)


def forecast_windows(start: datetime, end: datetime) -> Iterator[tuple[datetime, datetime]]:
    """Yield daily publication windows, including the requested final second."""
    cursor = start
    while cursor < end:
        following_midnight = datetime.combine(cursor.date() + timedelta(days=1), clock_time(), timezone.utc)
        window_end = min(following_midnight, end)
        yield cursor, window_end
        cursor = window_end


def utc_text(value: datetime) -> str:
    return value.isoformat(timespec="seconds").replace("+00:00", "Z")


def request_rows(
    client: httpx.Client,
    url: str,
    params: dict[str, str],
    *,
    sleep: Callable[[float], None] = time.sleep,
    attempts: int = 5,
) -> list[dict[str, Any]]:
    """Fetch a JSON array, retrying transient failures with exponential backoff."""
    for attempt in range(attempts):
        try:
            response = client.get(url, params=params)
            response.raise_for_status()
            rows = response.json()
            if not isinstance(rows, list) or not all(isinstance(row, dict) for row in rows):
                raise ValueError(f"Unexpected response shape from {url}")
            return rows
        except (httpx.TimeoutException, httpx.TransportError, httpx.HTTPStatusError) as error:
            retryable = not isinstance(error, httpx.HTTPStatusError) or error.response.status_code in RETRYABLE_STATUS
            if not retryable or attempt == attempts - 1:
                raise
            delay = min(2**attempt, 16)
            logger.warning("Request failed (%s); retry %d/%d in %ds", error, attempt + 1, attempts - 1, delay)
            sleep(delay)
    raise RuntimeError("Unreachable retry state")


def fetch_actuals(client: httpx.Client, start: date, end: date) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for day in daily_dates(start, end):
        params = {"settlementDateFrom": day.isoformat(), "settlementDateTo": day.isoformat(), "fuelType": "WIND"}
        chunk = request_rows(client, ACTUALS_URL, params)
        logger.info("FUELHH %s: %d rows", day, len(chunk))
        rows.extend(chunk)
    return rows


def fetch_forecasts(client: httpx.Client, start: datetime, end: datetime) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for window_start, window_end in forecast_windows(start, end):
        params = {"publishDateTimeFrom": utc_text(window_start), "publishDateTimeTo": utc_text(window_end)}
        chunk = request_rows(client, FORECASTS_URL, params)
        logger.info("WINDFOR %s to %s: %d rows", params["publishDateTimeFrom"], params["publishDateTimeTo"], len(chunk))
        rows.extend(chunk)
    return rows


def _iso_list(values: pd.DatetimeIndex | pd.Series) -> list[str]:
    return [value.isoformat().replace("+00:00", "Z") for value in values]


def validation_report(
    actuals: pd.DataFrame,
    forecasts: pd.DataFrame,
    start: date,
    end: date,
    actual_duplicates: dict[str, int],
    forecast_duplicates: dict[str, int],
) -> dict[str, Any]:
    """Summarize coverage and anomalies over the requested UTC delivery dates."""
    expected = pd.date_range(start=start.isoformat(), end=f"{end.isoformat()} 23:30:00", freq="30min", tz="UTC")
    actual_times = pd.DatetimeIndex(actuals["startTime"])
    forecast_times = pd.DatetimeIndex(forecasts["startTime"].unique())
    missing_actual = expected.difference(actual_times)
    missing_forecast = expected.difference(forecast_times)
    publish_counts = forecasts.groupby("publishTime").size().sort_index()
    publish_intervals = publish_counts.index.to_series().diff().dropna().dt.total_seconds() / 3600
    exceptions = [
        {"startTime": utc_text(point.to_pydatetime()), "actual": point in actual_times, "forecast": point in forecast_times}
        for point in expected
        if point not in actual_times or point not in forecast_times
    ]
    report: dict[str, Any] = {
        "actuals": {
            "expected_rows": len(expected),
            "actual_rows": len(actuals),
            "missing_startTimes": _iso_list(missing_actual),
            "extra_startTimes": _iso_list(actual_times.difference(expected)),
            "duplicates": actual_duplicates,
            "null_generation": int(actuals["generation"].isna().sum()),
            "negative_generation": int((actuals["generation"] < 0).sum()),
            "generation_min": int(actuals["generation"].min()) if actuals["generation"].notna().any() else None,
            "generation_max": int(actuals["generation"].max()) if actuals["generation"].notna().any() else None,
            "generation_mean": float(actuals["generation"].mean()) if actuals["generation"].notna().any() else None,
        },
        "forecasts": {
            "rows": len(forecasts),
            "publishTimes": len(publish_counts),
            "rows_per_publishTime": {utc_text(key.to_pydatetime()): int(value) for key, value in publish_counts.items()},
            "publish_frequency_hours": {
                "min": float(publish_intervals.min()) if len(publish_intervals) else None,
                "median": float(publish_intervals.median()) if len(publish_intervals) else None,
                "max": float(publish_intervals.max()) if len(publish_intervals) else None,
            },
            "horizon_hours": {"min": float(forecasts["horizon_hours"].min()), "max": float(forecasts["horizon_hours"].max())},
            "negative_horizon_rows": int((forecasts["horizon_hours"] < 0).sum()),
            "covered_startTimes": len(expected.difference(missing_forecast)),
            "missing_startTimes": _iso_list(missing_forecast),
            "duplicates": forecast_duplicates,
            "null_generation": int(forecasts["generation"].isna().sum()),
            "negative_generation": int((forecasts["generation"] < 0).sum()),
        },
        "cross_check": {"exceptions": exceptions, "exception_count": len(exceptions)},
    }
    return report


def _date_range(frame: pd.DataFrame, column: str) -> dict[str, str]:
    return {"min": utc_text(frame[column].min().to_pydatetime()), "max": utc_text(frame[column].max().to_pydatetime())}


def fetch_snapshot(start: date, end: date, output_dir: Path, forecast_publish_start: date | None = None) -> dict[str, Any]:
    """Fetch, clean, report, and store a complete snapshot for a UTC date range."""
    if start > end:
        raise ValueError("start date must be on or before end date")
    publish_start = forecast_publish_start or start - timedelta(days=17)
    publish_from = datetime.combine(publish_start, clock_time(), timezone.utc)
    publish_to = datetime.combine(end, clock_time(23, 59, 59), timezone.utc)
    timeout = httpx.Timeout(90.0, connect=10.0)
    with httpx.Client(timeout=timeout, headers={"Accept": "application/json", "User-Agent": "day-ahead-wind-review/1.0"}) as client:
        raw_actuals = fetch_actuals(client, start, end)
        raw_forecasts = fetch_forecasts(client, publish_from, publish_to)
    actuals, actual_duplicates = clean_actuals(raw_actuals)
    forecasts, forecast_duplicates = clean_forecasts(raw_forecasts)
    delivery_start = pd.Timestamp(start, tz="UTC")
    delivery_end = pd.Timestamp(end + timedelta(days=1), tz="UTC")
    actuals = actuals.loc[(actuals["startTime"] >= delivery_start) & (actuals["startTime"] < delivery_end)].copy()
    forecasts = forecasts.loc[(forecasts["startTime"] >= delivery_start) & (forecasts["startTime"] < delivery_end)].copy()
    if actuals.empty or forecasts.empty:
        raise ValueError("No delivery rows remain after filtering")
    report = validation_report(actuals, forecasts, start, end, actual_duplicates, forecast_duplicates)
    output_dir.mkdir(parents=True, exist_ok=True)
    full_month = (start.year, start.month) == (end.year, end.month) and start.day == 1 and end.day == calendar.monthrange(end.year, end.month)[1]
    suffix = start.strftime("%Y-%m") if full_month else f"{start:%Y-%m-%d}_{end:%Y-%m-%d}"
    actual_path = output_dir / f"actuals_wind_{suffix}.csv.gz"
    forecast_path = output_dir / f"forecasts_wind_{suffix}.csv.gz"
    actuals.to_csv(actual_path, index=False, compression="gzip")
    forecasts.to_csv(forecast_path, index=False, compression="gzip")
    metadata = {
        "fetched_at": utc_text(datetime.now(timezone.utc)),
        "source_urls": {"actuals": ACTUALS_URL, "forecasts": FORECASTS_URL},
        "parameters": {
            "actuals": {"settlementDateFrom": start.isoformat(), "settlementDateTo": end.isoformat(), "fuelType": "WIND"},
            "forecasts": {"publishDateTimeFrom": utc_text(publish_from), "publishDateTimeTo": utc_text(publish_to)},
        },
        "row_counts": {"actuals_raw": len(raw_actuals), "actuals_clean": len(actuals), "forecasts_raw": len(raw_forecasts), "forecasts_clean": len(forecasts)},
        "date_ranges": {
            "actual_startTime": _date_range(actuals, "startTime"),
            "actual_publishTime": _date_range(actuals, "publishTime"),
            "forecast_startTime": _date_range(forecasts, "startTime"),
            "forecast_publishTime": _date_range(forecasts, "publishTime"),
        },
        "files": {actual_path.name: actual_path.stat().st_size, forecast_path.name: forecast_path.stat().st_size},
    }
    (output_dir / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    (output_dir / "validation_report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    logger.info("Saved %s (%d bytes) and %s (%d bytes)", actual_path, actual_path.stat().st_size, forecast_path, forecast_path.stat().st_size)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-date", type=date.fromisoformat, default=date(2026, 1, 1), help="First UTC delivery date")
    parser.add_argument("--end-date", type=date.fromisoformat, default=date(2026, 2, 1), help="Last UTC delivery date")
    parser.add_argument("--output-dir", type=Path, default=DATA_DIR, help="Snapshot directory")
    parser.add_argument("--forecast-publish-start", type=date.fromisoformat, help="UTC publication start; defaults to 17 days before start")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    fetch_snapshot(args.start_date, args.end_date, args.output_dir, args.forecast_publish_start)


if __name__ == "__main__":
    main()
