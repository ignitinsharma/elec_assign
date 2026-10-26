export interface MetaResponse {
  available_delivery_dates: string[]
  cutoff_hour_default: number
  timezone: string
  snapshot_metadata: Record<string, unknown>
  methodology_notes: string[]
}

export interface DecisionRow {
  startTime: string
  forecast_mw: number
  actual_mw: number
  error_mw: number
  publishTime: string
  horizon_hours: number
}

export interface DecisionResponse {
  date: string
  cutoff_hour: number
  cutoff_london: string
  cutoff_london_label: string
  cutoff_utc: string
  rows: DecisionRow[]
  summary: {
    forecast_min_mw: number
    forecast_max_mw: number
    forecast_mean_mw: number
    total_forecast_mwh: number
    mae_mw: number
    bias_mw: number
    earliest_publishTime: string
    latest_publishTime: string
  }
}

export interface VintageResponse {
  date: string
  cutoff_hour: number
  cutoff_london: string
  cutoff_london_label: string
  cutoff_utc: string
  vintages: {
    publishTime: string
    rows: { startTime: string; forecast_mw: number; horizon_hours: number }[]
  }[]
  selected_rows: DecisionRow[]
}

export interface Metrics {
  n: number
  mae_mw: number | null
  rmse_mw: number | null
  bias_mw: number | null
  mape_percent: number | null
  mean_actual_mw: number | null
  nmae: number | null
  error_std_mw: number | null
  p50_abs_error_mw: number | null
  p90_abs_error_mw: number | null
  p95_abs_error_mw: number | null
  p90_shortfall_mw: number | null
  p95_shortfall_mw: number | null
}

export interface Breakdown {
  key: string
  metrics: Metrics
}

export interface AccuracyResponse {
  start: string
  end: string
  cutoff_hour: number
  basis: string
  overall: Metrics
  breakdowns: {
    by_delivery_day: Breakdown[]
    by_hour_london: Breakdown[]
    by_horizon_bucket: Breakdown[]
    by_wind_band: Breakdown[]
    wind_band_thresholds_mw: number[]
  }
}

export interface HorizonResponse {
  basis: string
  buckets: Breakdown[]
}

export interface PointsResponse {
  start: string
  end: string
  cutoff_hour: number
  basis: string
  rows: DecisionRow[]
}

export interface DiagnosticsResponse {
  analysed_at_utc: string
  basis: string
  bias_correction_illustration: {
    method: string
    uncorrected: {
      n: number
      mae_mw: number
      p90_shortfall_mw: number
      p95_shortfall_mw: number
    }
    corrected: {
      n: number
      mae_mw: number
      p90_shortfall_mw: number
      p95_shortfall_mw: number
    }
  }
}
