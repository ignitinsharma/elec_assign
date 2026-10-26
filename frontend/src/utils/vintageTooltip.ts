import type { VintageResponse } from '../types/analytics'

export interface VintageHourSummary {
  hour: string
  actualMw: number
  selectedMw: number
  selectedPublishTime: string
  otherMinMw: number | null
  otherMaxMw: number | null
  vintageCount: number
}

export function summarizeVintageHour(
  data: VintageResponse,
  startTime: string,
): VintageHourSummary | null {
  const selected = data.selected_rows.find((row) => row.startTime === startTime)
  if (!selected) return null
  const vintages = data.vintages.flatMap((vintage) =>
    vintage.rows
      .filter((row) => row.startTime === startTime)
      .map((row) => ({
        value: row.forecast_mw,
        publishTime: vintage.publishTime,
      })),
  )
  const other = vintages
    .filter((row) => row.publishTime !== selected.publishTime)
    .map((row) => row.value)
  return {
    hour: startTime,
    actualMw: selected.actual_mw,
    selectedMw: selected.forecast_mw,
    selectedPublishTime: selected.publishTime,
    otherMinMw: other.length ? Math.min(...other) : null,
    otherMaxMw: other.length ? Math.max(...other) : null,
    vintageCount: vintages.length,
  }
}
