"""Typed JSON contracts for decision-time wind forecast analysis."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel


class MetricResponse(BaseModel):
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


class BreakdownResponse(BaseModel):
    key: str
    metrics: MetricResponse


class BreakdownsResponse(BaseModel):
    by_delivery_day: list[BreakdownResponse]
    by_hour_london: list[BreakdownResponse]
    by_horizon_bucket: list[BreakdownResponse]
    by_wind_band: list[BreakdownResponse]
    wind_band_thresholds_mw: list[float]


class DeliveryDecisionResponse(BaseModel):
    delivery_date: date
    decision_date: date


class MetaResponse(BaseModel):
    available_delivery_dates: list[date]
    available_delivery_decisions: list[DeliveryDecisionResponse]
    accuracy_default_start: date
    accuracy_default_end: date
    cutoff_hour_default: int
    timezone: str
    snapshot_metadata: dict[str, Any]
    methodology_notes: list[str]


class DecisionRowResponse(BaseModel):
    startTime: datetime
    forecast_mw: float
    actual_mw: float
    error_mw: float
    publishTime: datetime
    horizon_hours: float


class DaySummaryResponse(BaseModel):
    forecast_min_mw: float
    forecast_max_mw: float
    forecast_mean_mw: float
    total_forecast_mwh: float
    mae_mw: float
    bias_mw: float
    earliest_publishTime: datetime
    latest_publishTime: datetime


class DecisionForecastResponse(BaseModel):
    date: date
    decision_date: date
    cutoff_hour: int
    cutoff_london: datetime
    cutoff_london_label: str
    cutoff_utc: datetime
    rows: list[DecisionRowResponse]
    summary: DaySummaryResponse


class VintageRowResponse(BaseModel):
    startTime: datetime
    forecast_mw: float
    horizon_hours: float


class VintageGroupResponse(BaseModel):
    publishTime: datetime
    rows: list[VintageRowResponse]


class ForecastVintagesResponse(BaseModel):
    date: date
    decision_date: date
    cutoff_hour: int
    cutoff_london: datetime
    cutoff_london_label: str
    cutoff_utc: datetime
    vintages: list[VintageGroupResponse]
    selected_rows: list[DecisionRowResponse]


class AccuracyResponse(BaseModel):
    start: date
    end: date
    cutoff_hour: int
    basis: str
    overall: MetricResponse
    breakdowns: BreakdownsResponse


class HorizonResponse(BaseModel):
    basis: str
    buckets: list[BreakdownResponse]


class AccuracyPointsResponse(BaseModel):
    start: date
    end: date
    cutoff_hour: int
    basis: str
    rows: list[DecisionRowResponse]
