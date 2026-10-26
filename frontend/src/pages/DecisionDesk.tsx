import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartPanel } from '../components/ChartPanel'
import { DayCutoffControls } from '../components/Controls'
import { useDashboard } from '../hooks/useDashboard'
import { MetricCard } from '../components/MetricCard'
import { PageState } from '../components/PageState'
import { decisionOptions, useDecision } from '../hooks/useWindData'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { formatAxisTick, niceAxis } from '../utils/chartAxes'
import type { DecisionRow } from '../types/analytics'
import {
  decisionBanner,
  deliveryDecisionLabel,
  downloadRows,
  formatHour,
  formatLondon,
  formatMw,
  formatMwh,
  peakShortfall,
  SIGN_CONVENTION,
} from '../utils/format'

function HourlyTable({ rows }: { rows: DecisionRow[] }) {
  return (
    <div className="table-scroll">
      <table>
        <caption>
          Decision-time hourly forecast compared with actual generation
        </caption>
        <thead>
          <tr>
            <th scope="col">Delivery time · London</th>
            <th scope="col">Forecast MW</th>
            <th scope="col">Actual MW</th>
            <th scope="col">Error MW</th>
            <th scope="col">Published · London</th>
            <th scope="col">Horizon h</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.startTime}>
              <th scope="row">{formatHour(row.startTime)}</th>
              <td>{formatMw(row.forecast_mw)}</td>
              <td>{formatMw(row.actual_mw)}</td>
              <td className={row.error_mw > 0 ? 'shortfall-text' : ''}>
                {formatMw(row.error_mw, true)}
              </td>
              <td>{formatLondon(row.publishTime)}</td>
              <td>{row.horizon_hours.toFixed(1)} h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DecisionTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: DecisionRow }[]
}) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="chart-tooltip">
      <strong>{formatLondon(row.startTime)}</strong>
      <span>Forecast {formatMw(row.forecast_mw)}</span>
      <span>Actual {formatMw(row.actual_mw)}</span>
      <span>Error {formatMw(row.error_mw, true)}</span>
      <span>Published {formatLondon(row.publishTime)}</span>
      <span>Horizon {row.horizon_hours.toFixed(1)} h</span>
    </div>
  )
}

export function DecisionDesk() {
  const { meta, day, setDay, cutoff, setCutoff } = useDashboard()
  const query = useDecision(day, cutoff)
  const queryClient = useQueryClient()
  const reducedMotion = useReducedMotion()
  useEffect(() => {
    const index = meta.available_delivery_dates.indexOf(day)
    for (const neighbor of [
      meta.available_delivery_dates[index - 1],
      meta.available_delivery_dates[index + 1],
    ]) {
      if (neighbor)
        void queryClient.prefetchQuery(decisionOptions(neighbor, cutoff))
    }
  }, [day, cutoff, meta, queryClient])
  const [tableView, setTableView] = useState(false)
  const data = query.data
  const peak = data ? peakShortfall(data.rows) : undefined
  const chartRows =
    data?.rows.map((row) => ({
      ...row,
      shortfallBand: row.error_mw > 0 ? [row.actual_mw, row.forecast_mw] : null,
      hour: formatHour(row.startTime).slice(0, 5),
    })) ?? []
  const axis = niceAxis(
    chartRows.flatMap((row) => [row.forecast_mw, row.actual_mw]),
  )

  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">01 / Decision view</span>
          <h1 tabIndex={-1}>Decision Desk</h1>
          <p>
            The forecast your team could have used, alongside what wind actually
            delivered.
          </p>
        </div>
        <DayCutoffControls
          meta={meta}
          day={day}
          onDay={setDay}
          cutoff={cutoff}
          onCutoff={setCutoff}
        />
      </div>
      {query.isPending || query.isError || !data ? (
        <PageState query={query} label="decision forecast" kind="decision" />
      ) : data.rows.length === 0 ? (
        <PageState query={query} label="hourly forecasts" />
      ) : (
        <div
          className={`data-content data-crossfade ${query.isPlaceholderData ? 'is-updating' : ''}`}
          key={`${data.date}-${data.cutoff_hour}`}
          aria-busy={query.isPlaceholderData}
        >
          {query.isPlaceholderData && (
            <span className="updating-indicator" role="status">
              Updating…
            </span>
          )}
          <p className="basis-note">
            {deliveryDecisionLabel(
              data.date,
              data.decision_date,
              data.cutoff_hour,
            )}
          </p>
          <div className="decision-banner">
            <span className="banner-icon" aria-hidden="true">
              ◷
            </span>
            <p>{decisionBanner(data)}</p>
          </div>
          <div className="metric-grid four">
            <MetricCard
              label="Total forecast"
              value={formatMwh(data.summary.total_forecast_mwh)}
              explanation="The sum of 24 hourly forecast MW values, one hour per value."
              tone="forecast"
            />
            <MetricCard
              label="Day MAE"
              value={formatMw(data.summary.mae_mw)}
              explanation="Average absolute gap between forecast and actual, in MW."
            />
            <MetricCard
              label="Day bias"
              value={formatMw(data.summary.bias_mw, true)}
              explanation="Average signed error: forecast minus actual, in MW."
            />
            <MetricCard
              label="Peak shortfall hour"
              value={peak ? formatMw(peak.error_mw) : '0 MW'}
              subtext={
                peak ? formatLondon(peak.startTime) : 'No shortfall recorded'
              }
              explanation={
                peak
                  ? `Largest forecast-above-actual gap at ${formatLondon(peak.startTime)}.`
                  : 'No forecast-above-actual hours.'
              }
              tone="warning"
            />
          </div>
          <p className="sign-note">
            <strong>How to read the gap:</strong> {SIGN_CONVENTION}
          </p>
          <div className="section-toolbar">
            <div>
              <span className="eyebrow">Hourly profile</span>
              <h2>Forecast and outturn</h2>
            </div>
            <div className="button-group">
              <button
                className={!tableView ? 'active' : ''}
                aria-pressed={!tableView}
                onClick={() => setTableView(false)}
              >
                Chart
              </button>
              <button
                className={tableView ? 'active' : ''}
                aria-pressed={tableView}
                onClick={() => setTableView(true)}
              >
                Table
              </button>
              <button onClick={() => downloadRows(data.rows, data.date)}>
                Download CSV
              </button>
            </div>
          </div>
          {tableView ? (
            <HourlyTable rows={data.rows} />
          ) : (
            <ChartPanel
              title="Hourly wind generation"
              description="MW by London delivery hour. Amber shading marks forecast above actual; the table below contains every plotted value."
              table={<HourlyTable rows={data.rows} />}
            >
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart
                  data={chartRows}
                  margin={{ top: 12, right: 12, bottom: 10, left: 8 }}
                  accessibilityLayer
                >
                  <CartesianGrid strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="hour" interval={3} />
                  <YAxis
                    domain={axis.domain}
                    ticks={axis.ticks}
                    tickFormatter={formatAxisTick}
                    label={{ value: 'MW', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<DecisionTooltip />} />
                  <Legend />
                  <Area
                    dataKey="shortfallBand"
                    name="Shortfall gap"
                    fill="var(--warning-soft)"
                    stroke="var(--warning)"
                    strokeWidth={0}
                    connectNulls={false}
                    isAnimationActive={!reducedMotion}
                    animationDuration={400}
                  />
                  <Line
                    dataKey="forecast_mw"
                    name="Forecast"
                    stroke="var(--forecast)"
                    strokeWidth={3}
                    dot={false}
                    isAnimationActive={!reducedMotion}
                    animationDuration={400}
                  />
                  <Line
                    dataKey="actual_mw"
                    name="Actual"
                    stroke="var(--actual)"
                    strokeWidth={3}
                    dot={false}
                    isAnimationActive={!reducedMotion}
                    animationDuration={400}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartPanel>
          )}
        </div>
      )}
    </>
  )
}
