"""Synthetic, offline checks for cutoff selection, metrics, and API contracts."""

from datetime import date
from math import sqrt

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.data_loader import clean_actuals, clean_forecasts
from app.services.forecast_selector import cutoff_for_day, select_decision_forecast, select_vintages_for
from app.services.metrics import compute_metrics, join_decision_actuals
from app.services.snapshot import Snapshot


def _forecast(start: str, published: str, generation: int) -> dict:
    return {"startTime": start, "publishTime": published, "generation": generation}


def _actual(start: str, period: int, generation: int) -> dict:
    return {
        "startTime": start,
        "settlementDate": start[:10],
        "settlementPeriod": period,
        "publishTime": "2026-01-03T00:00:00Z",
        "generation": generation,
        "fuelType": "WIND",
    }


@pytest.fixture
def snapshot() -> Snapshot:
    forecasts, _ = clean_forecasts([
        _forecast("2026-01-01T00:00:00Z", "2025-12-31T06:00:00Z", 80),
        _forecast("2026-01-01T00:00:00Z", "2025-12-31T09:00:00Z", 110),
        _forecast("2026-01-01T00:00:00Z", "2025-12-31T10:00:00Z", 120),
        _forecast("2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z", 130),
        _forecast("2026-01-01T01:00:00Z", "2025-12-31T06:00:00Z", 90),
        _forecast("2026-01-01T01:00:00Z", "2025-12-31T09:00:00Z", 105),
        _forecast("2026-01-01T01:00:00Z", "2025-12-31T10:00:00Z", 115),
        _forecast("2026-01-02T00:00:00Z", "2026-01-01T07:00:00Z", 95),
        _forecast("2026-01-02T00:00:00Z", "2026-01-01T09:00:00Z", 105),
    ])
    actuals, _ = clean_actuals([
        _actual("2026-01-01T00:00:00Z", 1, 100),
        _actual("2026-01-01T00:30:00Z", 2, 100),
        _actual("2026-01-01T01:00:00Z", 3, 100),
        _actual("2026-01-02T00:00:00Z", 1, 100),
    ])
    return Snapshot(actuals, forecasts, {"source": "synthetic"})


def test_cutoff_includes_equal_excludes_later_and_changes_with_hour(snapshot: Snapshot) -> None:
    assert snapshot.selected(9) is snapshot.selected(9)  # the snapshot cache is keyed by cutoff hour
    selected_7 = select_decision_forecast(snapshot.forecasts, 7)
    selected_9 = select_decision_forecast(snapshot.forecasts, 9)
    selected_11 = select_decision_forecast(snapshot.forecasts, 11)
    assert selected_7["forecast_mw"].tolist() == [80, 90, 95]
    assert selected_9["forecast_mw"].tolist() == [110, 105, 105]
    assert selected_11["forecast_mw"].tolist() == [120, 115, 105]
    assert selected_9.iloc[0]["publishTime"] == pd.Timestamp("2025-12-31T09:00:00Z")
    assert selected_9.iloc[0]["cutoff_time"] == pd.Timestamp("2025-12-31T09:00:00Z")
    assert (selected_9["publishTime"] <= selected_9["cutoff_time"]).all()
    assert set(selected_9["startTime"].dt.minute) == {0}
    assert len(join_decision_actuals(selected_9, snapshot.actuals)) == 3  # :30 actual is never matched
    vintages = select_vintages_for(snapshot.forecasts, date(2026, 1, 1), 9)
    assert len(vintages) == 4
    assert vintages["publishTime"].max() == pd.Timestamp("2025-12-31T09:00:00Z")


def test_london_calendar_and_dst_boundaries() -> None:
    assert cutoff_for_day(date(2026, 3, 30), 9).isoformat() == "2026-03-29T09:00:00+01:00"
    rows, _ = clean_forecasts([
        _forecast("2026-07-01T23:00:00Z", "2026-07-01T08:00:00Z", 100),
        _forecast("2026-07-01T23:00:00Z", "2026-07-01T08:01:00Z", 200),
    ])
    selected = select_decision_forecast(rows, 9)
    assert selected.iloc[0]["forecast_mw"] == 100
    assert selected.iloc[0]["cutoff_time"] == pd.Timestamp("2026-07-01T08:00:00Z")


def test_metrics_sign_percentiles_and_zero_actual_guard() -> None:
    frame = pd.DataFrame({"forecast_mw": [12, 8, 5], "actual_mw": [10, 10, 0]})
    result = compute_metrics(frame)
    assert result["n"] == 3
    assert result["mae_mw"] == 3
    assert result["rmse_mw"] == pytest.approx(sqrt(11))
    assert result["bias_mw"] == pytest.approx(5 / 3)
    assert result["mape_percent"] == 20
    assert result["nmae"] == pytest.approx(0.45)
    assert result["p50_abs_error_mw"] == 2
    assert result["p90_shortfall_mw"] == pytest.approx(4.4)
    assert result["p95_shortfall_mw"] == pytest.approx(4.7)
    zero = compute_metrics(pd.DataFrame({"forecast_mw": [4], "actual_mw": [0]}))
    assert zero["mape_percent"] is None
    assert zero["nmae"] is None


def test_api_endpoints_and_input_errors(snapshot: Snapshot) -> None:
    with TestClient(create_app(snapshot)) as client:
        meta = client.get("/api/meta")
        assert meta.status_code == 200
        assert meta.json()["available_delivery_dates"] == ["2026-01-01", "2026-01-02"]

        decision = client.get("/api/decision-forecast?date=2026-01-01")
        assert decision.status_code == 200
        assert len(decision.json()["rows"]) == 2
        assert decision.json()["rows"][0]["error_mw"] == 10
        assert decision.json()["summary"]["total_forecast_mwh"] == 215

        vintages = client.get("/api/forecast-vintages?date=2026-01-01")
        assert vintages.status_code == 200
        assert len(vintages.json()["vintages"]) == 2
        assert len(vintages.json()["selected_rows"]) == 2

        accuracy = client.get("/api/accuracy?start=2026-01-01&end=2026-01-02")
        assert accuracy.status_code == 200
        assert accuracy.json()["overall"]["n"] == 3
        assert accuracy.json()["breakdowns"]["by_delivery_day"][0]["key"] == "2026-01-01"

        horizon = client.get("/api/accuracy/horizon")
        assert horizon.status_code == 200
        assert sum(bucket["metrics"]["n"] for bucket in horizon.json()["buckets"]) == 8

        points = client.get("/api/accuracy/points?start=2026-01-01&end=2026-01-02")
        assert points.status_code == 200
        assert len(points.json()["rows"]) == 3
        assert points.json()["rows"][0]["error_mw"] == 10

        diagnostics = client.get("/api/diagnostics")
        assert diagnostics.status_code == 200
        assert diagnostics.json()["bias_correction_illustration"]["corrected"]["n"] == 744

        for path, status in [
            ("/api/decision-forecast?date=bad", 422),
            ("/api/decision-forecast?date=2025-12-31", 404),
            ("/api/decision-forecast?date=2026-01-01&cutoff_hour=24", 422),
            ("/api/forecast-vintages?date=2026-02-01", 404),
            ("/api/accuracy?start=2026-01-02&end=2026-01-01", 422),
            ("/api/accuracy?start=2025-12-31", 404),
            ("/api/accuracy?cutoff_hour=-1", 422),
            ("/api/accuracy/points?start=2026-02-01&end=2026-02-01", 404),
            ("/api/accuracy/points?cutoff_hour=24", 422),
        ]:
            assert client.get(path).status_code == status
