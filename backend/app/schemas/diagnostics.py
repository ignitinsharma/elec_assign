"""Contract for the committed, retrospective bias diagnostics report."""

from datetime import date, datetime

from pydantic import BaseModel


class Comparison(BaseModel):
    n: int
    mae_mw: float
    bias_mw: float
    rmse_mw: float
    pearson_r: float | None


class ShiftComparison(Comparison):
    shift_minutes: int


class TimeAlignment(BaseModel):
    shift_definition: str
    rows: list[ShiftComparison]
    best_mae_shift_minutes: int
    best_mae_reduction_percent: float


class OlsDiagnostics(BaseModel):
    intercept_mw: float
    slope: float
    r_squared: float | None
    median_forecast_actual_ratio: float | None


class WindBandBias(BaseModel):
    band: str
    n: int
    bias_mw: float


class DailyBias(BaseModel):
    delivery_day: date
    n: int
    bias_mw: float


class PositiveDayRun(BaseModel):
    positive_days: int
    positive_days_percent: float | None
    longest_run_days: int
    longest_run_start: date | None
    longest_run_end: date | None


class BiasStructure(BaseModel):
    ols_actual_on_forecast: OlsDiagnostics
    wind_tercile_thresholds_mw: list[float]
    by_wind_level: list[WindBandBias]
    by_delivery_day: list[DailyBias]
    positive_day_run: PositiveDayRun


class HorizonCheck(BaseModel):
    window: str
    decision_full: Comparison
    decision_same_hours: Comparison
    short_horizon_same_hours: Comparison


class CorrectionMetrics(BaseModel):
    n: int
    mae_mw: float
    p90_shortfall_mw: float
    p95_shortfall_mw: float


class BiasCorrectionIllustration(BaseModel):
    method: str
    uncorrected: CorrectionMetrics
    corrected: CorrectionMetrics


class DatasetDefinition(BaseModel):
    dataset_url: str
    context_url: str
    context_quote: str
    documented: str


class Definitions(BaseModel):
    fuelhh: DatasetDefinition
    windfor: DatasetDefinition
    unclear: str


class DiagnosticsResponse(BaseModel):
    analysed_at_utc: datetime
    basis: str
    time_alignment: TimeAlignment
    bias_structure: BiasStructure
    horizon_check: HorizonCheck
    bias_correction_illustration: BiasCorrectionIllustration
    definitions: Definitions
