"""Read-only API over the committed wind snapshot."""

from __future__ import annotations

import json
from datetime import date, timedelta, timezone
from functools import lru_cache
from typing import Annotated

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.config import DATA_DIR, DECISION_CUTOFF_HOUR, TIMEZONE
from app.schemas.analytics import (
    AccuracyPointsResponse,
    AccuracyResponse,
    BreakdownResponse,
    BreakdownsResponse,
    DaySummaryResponse,
    DecisionForecastResponse,
    DeliveryDecisionResponse,
    DecisionRowResponse,
    ForecastVintagesResponse,
    HorizonResponse,
    MetaResponse,
    MetricResponse,
    VintageGroupResponse,
    VintageRowResponse,
)
from app.schemas.diagnostics import DiagnosticsResponse
from app.services.forecast_selector import cutoff_for_day, delivery_days, select_vintages_for
from app.services.metrics import (
    BreakdownRow,
    MetricValues,
    all_vintages_horizon_analysis,
    compute_metrics,
    decision_breakdowns,
)
from app.services.snapshot import Snapshot, load_snapshot

router = APIRouter(prefix="/api", tags=["analysis"])
CutoffQuery = Annotated[int | None, Query(ge=0, le=23, description="Decision hour on the previous London-local day")]


def get_snapshot(request: Request) -> Snapshot:
    if not hasattr(request.app.state, "snapshot"):
        request.app.state.snapshot = load_snapshot()
    return request.app.state.snapshot


def _cutoff(value: int | None) -> int:
    return DECISION_CUTOFF_HOUR if value is None else value


def _require_day(day: date, snapshot: Snapshot) -> None:
    if day not in snapshot.available_days:
        raise HTTPException(status_code=404, detail="Delivery date is outside the available snapshot")


def _default_accuracy_dates(snapshot: Snapshot) -> tuple[date, date]:
    """Default to delivery days whose day-ahead decisions fell in January 2026."""
    january_decisions = [
        day for day in snapshot.available_days
        if date(2026, 1, 1) <= day - timedelta(days=1) <= date(2026, 1, 31)
    ]
    days = january_decisions or snapshot.available_days
    return days[0], days[-1]


def _day_frame(frame: pd.DataFrame, day: date) -> pd.DataFrame:
    return frame.loc[delivery_days(frame["startTime"]) == day]


def _round(value: float | None, digits: int = 2) -> float | None:
    return None if value is None else round(value, digits)


def _metric_response(values: MetricValues) -> MetricResponse:
    rounded = {key: (value if key == "n" else _round(value, 4 if key == "nmae" else 2)) for key, value in values.items()}
    return MetricResponse(**rounded)


def _breakdown_response(rows: list[BreakdownRow]) -> list[BreakdownResponse]:
    return [BreakdownResponse(key=row["key"], metrics=_metric_response(row["metrics"])) for row in rows]


def _decision_rows(frame: pd.DataFrame) -> list[DecisionRowResponse]:
    return [
        DecisionRowResponse(
            startTime=row.startTime,
            forecast_mw=float(row.forecast_mw),
            actual_mw=float(row.actual_mw),
            error_mw=float(row.error_mw),
            publishTime=row.publishTime,
            horizon_hours=_round(float(row.horizon_hours)),
        )
        for row in frame.itertuples(index=False)
    ]


@lru_cache(maxsize=1)
def get_diagnostics() -> DiagnosticsResponse:
    """Validate and cache the committed report; never contact Elexon."""
    return DiagnosticsResponse.model_validate(json.loads((DATA_DIR / "bias_diagnostics.json").read_text()))


@router.get("/diagnostics", response_model=DiagnosticsResponse)
def diagnostics(report: Annotated[DiagnosticsResponse, Depends(get_diagnostics)]) -> DiagnosticsResponse:
    return report


@router.get("/meta", response_model=MetaResponse)
def meta(snapshot: Annotated[Snapshot, Depends(get_snapshot)]) -> MetaResponse:
    default_start, default_end = _default_accuracy_dates(snapshot)
    return MetaResponse(
        available_delivery_dates=snapshot.available_days,
        available_delivery_decisions=[
            DeliveryDecisionResponse(delivery_date=day, decision_date=day - timedelta(days=1))
            for day in snapshot.available_days
        ],
        accuracy_default_start=default_start,
        accuracy_default_end=default_end,
        cutoff_hour_default=DECISION_CUTOFF_HOUR,
        timezone=TIMEZONE,
        snapshot_metadata=snapshot.metadata,
        methodology_notes=[
            "Delivery day and previous-day decision cutoff use Europe/London calendar time.",
            "Latest forecast published at or before the cutoff is selected for each hourly startTime.",
            "Forecasts join FUELHH actuals on exact UTC startTime; :30 actuals are not interpolated.",
            "Error is forecast minus actual MW; positive error is wind shortfall requiring extra procurement.",
            "All-vintages horizon analysis is separate from decision-time accuracy.",
        ],
    )


@router.get("/decision-forecast", response_model=DecisionForecastResponse)
def decision_forecast(
    date: date,
    snapshot: Annotated[Snapshot, Depends(get_snapshot)],
    cutoff_hour: CutoffQuery = None,
) -> DecisionForecastResponse:
    _require_day(date, snapshot)
    hour = _cutoff(cutoff_hour)
    frame = _day_frame(snapshot.joined(hour), date)
    if frame.empty:
        raise HTTPException(status_code=404, detail="No decision-time forecast is available for this date")
    cutoff_london = cutoff_for_day(date, hour)
    day_metrics = compute_metrics(frame)
    return DecisionForecastResponse(
        date=date,
        decision_date=date - timedelta(days=1),
        cutoff_hour=hour,
        cutoff_london=cutoff_london,
        cutoff_london_label=cutoff_london.strftime("%Y-%m-%d %H:%M %Z"),
        cutoff_utc=cutoff_london.astimezone(timezone.utc),
        rows=_decision_rows(frame),
        summary=DaySummaryResponse(
            forecast_min_mw=float(frame["forecast_mw"].min()),
            forecast_max_mw=float(frame["forecast_mw"].max()),
            forecast_mean_mw=_round(float(frame["forecast_mw"].mean())),
            total_forecast_mwh=float(frame["forecast_mw"].sum()),
            mae_mw=_round(day_metrics["mae_mw"]),
            bias_mw=_round(day_metrics["bias_mw"]),
            earliest_publishTime=frame["publishTime"].min(),
            latest_publishTime=frame["publishTime"].max(),
        ),
    )


@router.get("/forecast-vintages", response_model=ForecastVintagesResponse)
def forecast_vintages(
    date: date,
    snapshot: Annotated[Snapshot, Depends(get_snapshot)],
    cutoff_hour: CutoffQuery = None,
) -> ForecastVintagesResponse:
    _require_day(date, snapshot)
    hour = _cutoff(cutoff_hour)
    frame = select_vintages_for(snapshot.forecasts, date, hour)
    if frame.empty:
        raise HTTPException(status_code=404, detail="No vintage is available by this date's cutoff")
    groups = [
        VintageGroupResponse(
            publishTime=publish_time,
            rows=[VintageRowResponse(startTime=row.startTime, forecast_mw=float(row.forecast_mw), horizon_hours=_round(float(row.horizon_hours))) for row in group.itertuples(index=False)],
        )
        for publish_time, group in frame.groupby("publishTime", sort=True)
    ]
    cutoff_london = cutoff_for_day(date, hour)
    selected = _day_frame(snapshot.joined(hour), date)
    return ForecastVintagesResponse(
        date=date,
        decision_date=date - timedelta(days=1),
        cutoff_hour=hour,
        cutoff_london=cutoff_london,
        cutoff_london_label=cutoff_london.strftime("%Y-%m-%d %H:%M %Z"),
        cutoff_utc=cutoff_london.astimezone(timezone.utc),
        vintages=groups,
        selected_rows=_decision_rows(selected),
    )


@router.get("/accuracy", response_model=AccuracyResponse)
def accuracy(
    snapshot: Annotated[Snapshot, Depends(get_snapshot)],
    start: date | None = None,
    end: date | None = None,
    cutoff_hour: CutoffQuery = None,
) -> AccuracyResponse:
    default_start, default_end = _default_accuracy_dates(snapshot)
    first = start or default_start
    last = end or default_end
    if first > last:
        raise HTTPException(status_code=422, detail="start must be on or before end")
    _require_day(first, snapshot)
    _require_day(last, snapshot)
    hour = _cutoff(cutoff_hour)
    joined = snapshot.joined(hour)
    local_days = delivery_days(joined["startTime"])
    frame = joined.loc[(local_days >= first) & (local_days <= last)]
    if frame.empty:
        raise HTTPException(status_code=404, detail="No comparable forecasts are available in this range")
    breakdowns = decision_breakdowns(frame)
    return AccuracyResponse(
        start=first,
        end=last,
        cutoff_hour=hour,
        basis="Decision-time forecasts joined to exact hourly FUELHH :00 actuals",
        overall=_metric_response(compute_metrics(frame)),
        breakdowns=BreakdownsResponse(
            by_delivery_day=_breakdown_response(breakdowns["by_delivery_day"]),
            by_hour_london=_breakdown_response(breakdowns["by_hour_london"]),
            by_horizon_bucket=_breakdown_response(breakdowns["by_horizon_bucket"]),
            by_wind_band=_breakdown_response(breakdowns["by_wind_band"]),
            wind_band_thresholds_mw=[_round(value) for value in breakdowns["wind_band_thresholds_mw"]],
        ),
    )


@router.get("/accuracy/horizon", response_model=HorizonResponse)
def accuracy_horizon(snapshot: Annotated[Snapshot, Depends(get_snapshot)]) -> HorizonResponse:
    return HorizonResponse(
        basis="All WINDFOR vintages with nonnegative horizon, joined to exact hourly FUELHH :00 actuals; separate from decision-time accuracy",
        buckets=_breakdown_response(all_vintages_horizon_analysis(snapshot.forecasts, snapshot.actuals)),
    )


@router.get("/accuracy/points", response_model=AccuracyPointsResponse)
def accuracy_points(
    snapshot: Annotated[Snapshot, Depends(get_snapshot)],
    start: date | None = None,
    end: date | None = None,
    cutoff_hour: CutoffQuery = None,
) -> AccuracyPointsResponse:
    """Return bounded hourly pairs for the forecast-vs-actual scatter."""
    default_start, default_end = _default_accuracy_dates(snapshot)
    first, last = start or default_start, end or default_end
    if first > last:
        raise HTTPException(status_code=422, detail="start must be on or before end")
    _require_day(first, snapshot)
    _require_day(last, snapshot)
    hour = _cutoff(cutoff_hour)
    frame = snapshot.joined(hour)
    local_days = delivery_days(frame["startTime"])
    rows = _decision_rows(frame.loc[(local_days >= first) & (local_days <= last)])
    if not rows:
        raise HTTPException(status_code=404, detail="No comparable forecasts are available in this range")
    return AccuracyPointsResponse(
        start=first,
        end=last,
        cutoff_hour=hour,
        basis="Decision-time forecasts joined to exact hourly FUELHH :00 actuals",
        rows=rows,
    )
