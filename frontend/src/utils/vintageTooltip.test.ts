import { expect, it } from 'vitest'
import type { VintageResponse } from '../types/analytics'
import { summarizeVintageHour } from './vintageTooltip'

it('summarises other vintages without listing every revision', () => {
  const row = {
    startTime: '2026-01-01T00:00:00Z',
    forecast_mw: 120,
    actual_mw: 100,
    error_mw: 20,
    publishTime: '2025-12-31T09:00:00Z',
    horizon_hours: 15,
  }
  const data: VintageResponse = {
    date: '2026-01-01',
    decision_date: '2025-12-31',
    cutoff_hour: 9,
    cutoff_london: '2025-12-31T09:00:00Z',
    cutoff_london_label: '31 Dec 09:00 GMT',
    cutoff_utc: '2025-12-31T09:00:00Z',
    selected_rows: [row],
    vintages: [
      {
        publishTime: '2025-12-31T03:00:00Z',
        rows: [
          { startTime: row.startTime, forecast_mw: 80, horizon_hours: 21 },
        ],
      },
      {
        publishTime: '2025-12-31T06:00:00Z',
        rows: [
          { startTime: row.startTime, forecast_mw: 130, horizon_hours: 18 },
        ],
      },
      {
        publishTime: row.publishTime,
        rows: [
          { startTime: row.startTime, forecast_mw: 120, horizon_hours: 15 },
        ],
      },
    ],
  }
  expect(summarizeVintageHour(data, row.startTime)).toEqual({
    hour: row.startTime,
    actualMw: 100,
    selectedMw: 120,
    selectedPublishTime: row.publishTime,
    otherMinMw: 80,
    otherMaxMw: 130,
    vintageCount: 3,
  })
})
