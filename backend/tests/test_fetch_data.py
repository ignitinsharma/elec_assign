"""Offline checks for BMRS request boundaries and snapshot normalization."""

from datetime import date, datetime, timezone

import httpx
import pandas as pd
import pytest

from app.services.data_loader import clean_actuals, clean_forecasts, load_actuals, load_forecasts
from scripts.fetch_data import fetch_actuals, fetch_forecasts, request_rows, validation_report


def test_daily_request_chunking() -> None:
    seen: list[dict[str, str]] = []

    def respond(request: httpx.Request) -> httpx.Response:
        seen.append(dict(request.url.params))
        return httpx.Response(200, json=[])

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        fetch_actuals(client, date(2026, 1, 1), date(2026, 1, 3))
        fetch_forecasts(
            client,
            datetime(2025, 12, 31, 12, tzinfo=timezone.utc),
            datetime(2026, 1, 1, 23, 59, 59, tzinfo=timezone.utc),
        )

    assert [row["settlementDateFrom"] for row in seen[:3]] == ["2026-01-01", "2026-01-02", "2026-01-03"]
    assert all(row["settlementDateFrom"] == row["settlementDateTo"] and row["fuelType"] == "WIND" for row in seen[:3])
    assert [(row["publishDateTimeFrom"], row["publishDateTimeTo"]) for row in seen[3:]] == [
        ("2025-12-31T12:00:00Z", "2026-01-01T00:00:00Z"),
        ("2026-01-01T00:00:00Z", "2026-01-01T23:59:59Z"),
    ]


def test_transient_failures_retry_with_backoff() -> None:
    responses = iter([429, 503, 200])
    delays: list[float] = []

    def respond(_: httpx.Request) -> httpx.Response:
        code = next(responses)
        return httpx.Response(code, json=[{"generation": 1}] if code == 200 else {"error": "busy"})

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        rows = request_rows(client, "https://example.test/stream", {}, sleep=delays.append)

    assert rows == [{"generation": 1}]
    assert delays == [1, 2]


def test_client_error_does_not_retry() -> None:
    requests = 0

    def respond(_: httpx.Request) -> httpx.Response:
        nonlocal requests
        requests += 1
        return httpx.Response(400, json={"error": "bad range"})

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        with pytest.raises(httpx.HTTPStatusError):
            request_rows(client, "https://example.test/stream", {}, sleep=lambda _: None)
    assert requests == 1


def test_parsing_deduplication_and_horizon(tmp_path) -> None:
    actual_row = {
        "startTime": "2026-01-01T00:00:00Z",
        "settlementDate": "2026-01-01",
        "settlementPeriod": 1,
        "publishTime": "2026-01-01T00:30:00Z",
        "generation": 100,
        "fuelType": "WIND",
    }
    actuals, actual_duplicates = clean_actuals([actual_row, actual_row, {**actual_row, "generation": 101}])
    assert actual_duplicates == {"exact_duplicates": 1, "duplicate_keys": 2}
    assert len(actuals) == 1
    assert actuals.loc[0, "generation"] == 101
    assert str(actuals["startTime"].dtype) == "datetime64[ns, UTC]"

    forecast_row = {"startTime": "2026-01-01T00:00:00Z", "publishTime": "2025-12-30T12:00:00Z", "generation": 200}
    forecasts, forecast_duplicates = clean_forecasts([forecast_row, forecast_row, {**forecast_row, "generation": 201}])
    assert forecast_duplicates == {"exact_duplicates": 1, "duplicate_keys": 2}
    assert forecasts.loc[0, "generation"] == 201
    assert forecasts.loc[0, "horizon_hours"] == 36.0
    assert str(forecasts["publishTime"].dtype) == "datetime64[ns, UTC]"

    actual_path = tmp_path / "actuals.csv.gz"
    forecast_path = tmp_path / "forecasts.csv.gz"
    actuals.to_csv(actual_path, index=False, compression="gzip")
    forecasts.to_csv(forecast_path, index=False, compression="gzip")
    loaded_actuals = load_actuals(actual_path)
    loaded_forecasts = load_forecasts(forecast_path)
    assert isinstance(loaded_actuals["startTime"].dtype, pd.DatetimeTZDtype)
    assert isinstance(loaded_forecasts["publishTime"].dtype, pd.DatetimeTZDtype)
    loaded_actuals.loc[0, "generation"] = 999
    assert load_actuals(actual_path).loc[0, "generation"] == 101


def test_validation_lists_uncovered_half_hours() -> None:
    actual_rows = [
        {
            "startTime": f"2026-01-01T{hour:02d}:{minute:02d}:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 2 * hour + minute // 30 + 1,
            "publishTime": f"2026-01-01T{hour:02d}:{(minute + 30) % 60:02d}:00Z",
            "generation": 100,
            "fuelType": "WIND",
        }
        for hour in range(24)
        for minute in (0, 30)
    ]
    forecasts_rows = [
        {"startTime": f"2026-01-01T{hour:02d}:00:00Z", "publishTime": "2025-12-31T00:00:00Z", "generation": 120}
        for hour in range(24)
    ]
    actuals, actual_duplicates = clean_actuals(actual_rows)
    forecasts, forecast_duplicates = clean_forecasts(forecasts_rows)
    report = validation_report(actuals, forecasts, date(2026, 1, 1), date(2026, 1, 1), actual_duplicates, forecast_duplicates)
    assert report["actuals"]["missing_startTimes"] == []
    assert len(report["forecasts"]["missing_startTimes"]) == 24
    assert report["cross_check"]["exception_count"] == 24
    assert report["cross_check"]["exceptions"][0] == {"startTime": "2026-01-01T00:30:00Z", "actual": True, "forecast": False}
