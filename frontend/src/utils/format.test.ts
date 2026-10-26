import { describe, expect, it } from 'vitest'
import type { DecisionResponse } from '../types/analytics'
import {
  decisionBanner,
  formatLondon,
  formatMw,
  formatMwh,
  formatPercent,
  peakShortfall,
  SIGN_CONVENTION,
} from './format'

const response: DecisionResponse = {
  date: '2026-01-01',
  cutoff_hour: 9,
  cutoff_london: '2025-12-31T09:00:00Z',
  cutoff_london_label: '2025-12-31 09:00 GMT',
  cutoff_utc: '2025-12-31T09:00:00Z',
  rows: [
    {
      startTime: '2026-01-01T00:00:00Z',
      forecast_mw: 120,
      actual_mw: 100,
      error_mw: 20,
      publishTime: '2025-12-31T07:30:00Z',
      horizon_hours: 16.5,
    },
    {
      startTime: '2026-01-01T01:00:00Z',
      forecast_mw: 130,
      actual_mw: 100,
      error_mw: 30,
      publishTime: '2025-12-31T07:30:00Z',
      horizon_hours: 17.5,
    },
  ],
  summary: {
    forecast_min_mw: 120,
    forecast_max_mw: 130,
    forecast_mean_mw: 125,
    total_forecast_mwh: 250,
    mae_mw: 25,
    bias_mw: 25,
    earliest_publishTime: '2025-12-31T07:30:00Z',
    latest_publishTime: '2025-12-31T07:30:00Z',
  },
}

describe('display formatting and decision interpretation', () => {
  it('keeps units, signs and London timezone labels', () => {
    expect(formatMw(1234)).toBe('1,234 MW')
    expect(formatMw(20, true)).toBe('+20 MW')
    expect(formatMwh(250)).toBe('250 MWh')
    expect(formatPercent(0.1837)).toBe('18.4%')
    expect(formatLondon('2026-07-01T08:00:00Z')).toContain('BST')
    expect(formatLondon('2026-01-01T08:00:00Z')).toContain('GMT')
  })

  it('states the cutoff, selected vintage and horizon from response rows', () => {
    expect(decisionBanner(response)).toBe(
      'Decision cutoff: 31 Dec 09:00 GMT. Forecast used: published 31 Dec 07:30 GMT, 16.5–17.5 h before delivery.',
    )
    expect(peakShortfall(response.rows)?.error_mw).toBe(30)
    expect(SIGN_CONVENTION).toBe(
      'Positive error = forecast above actual = extra power to buy.',
    )
  })
})
