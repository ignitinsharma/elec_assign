import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DecisionDesk } from './DecisionDesk'
import { decisionBanner } from '../utils/format'
import type { DecisionResponse } from '../types/analytics'

const fixture: DecisionResponse = {
  date: '2026-01-01',
  decision_date: '2025-12-31',
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
  ],
  summary: {
    forecast_min_mw: 120,
    forecast_max_mw: 120,
    forecast_mean_mw: 120,
    total_forecast_mwh: 120,
    mae_mw: 20,
    bias_mw: 20,
    earliest_publishTime: '2025-12-31T07:30:00Z',
    latest_publishTime: '2025-12-31T07:30:00Z',
  },
}

vi.mock('../hooks/useDashboard', () => ({
  useDashboard: () => ({
    meta: {
      available_delivery_dates: ['2026-01-01'],
      available_delivery_decisions: [
        { delivery_date: '2026-01-01', decision_date: '2025-12-31' },
      ],
      cutoff_hour_default: 9,
    },
    day: '2026-01-01',
    setDay: vi.fn(),
    cutoff: 9,
    setCutoff: vi.fn(),
  }),
}))
vi.mock('../hooks/useWindData', () => ({
  useDecision: () => ({ data: fixture, isPending: false, isError: false }),
}))

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    value: 800,
  })
})

it('renders API-backed KPIs, sign convention, banner and hourly table', async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DecisionDesk />
    </QueryClientProvider>,
  )
  expect(screen.getByText(decisionBanner(fixture))).toBeInTheDocument()
  expect(
    screen.getByText(
      'Positive error = forecast above actual = extra power to buy.',
    ),
  ).toBeInTheDocument()
  expect(screen.getByText('120 MWh')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Table' }))
  expect(
    screen.getByRole('table', { name: /Decision-time hourly forecast/ }),
  ).toBeInTheDocument()
  expect(screen.getByRole('cell', { name: '+20 MW' })).toBeInTheDocument()
})
