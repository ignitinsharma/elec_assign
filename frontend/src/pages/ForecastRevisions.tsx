import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartPanel } from '../components/ChartPanel'
import { DayCutoffControls } from '../components/Controls'
import { useDashboard } from '../hooks/useDashboard'
import { PageState } from '../components/PageState'
import { useVintages } from '../hooks/useWindData'
import { formatHour, formatLondon, formatMw } from '../utils/format'
import { deliveryDecisionLabel } from '../utils/format'
import { formatAxisTick, niceAxis } from '../utils/chartAxes'
import {
  summarizeVintageHour,
  type VintageHourSummary,
} from '../utils/vintageTooltip'
import { useReducedMotion } from '../hooks/useReducedMotion'

function RevisionsTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: { summary: VintageHourSummary | null } }[]
}) {
  const summary = payload?.[0]?.payload.summary
  if (!active || !summary) return null
  return (
    <div className="chart-tooltip compact-tooltip">
      <strong>{formatLondon(summary.hour)}</strong>
      <span>Actual: {formatMw(summary.actualMw)}</span>
      <span>Selected: {formatMw(summary.selectedMw)}</span>
      <span>Published: {formatLondon(summary.selectedPublishTime)}</span>
      <span>
        Other vintages:{' '}
        {summary.otherMinMw == null
          ? '—'
          : `${formatMw(summary.otherMinMw)}–${formatMw(summary.otherMaxMw)}`}
      </span>
      <span>Vintages: {summary.vintageCount}</span>
    </div>
  )
}

export function ForecastRevisions() {
  const { meta, day, setDay, cutoff, setCutoff } = useDashboard()
  const query = useVintages(day, cutoff)
  const reducedMotion = useReducedMotion()
  const data = query.data
  const rows =
    data?.selected_rows.map((row) => ({
      startTime: row.startTime,
      hour: formatHour(row.startTime).slice(0, 5),
      localTime: formatLondon(row.startTime),
      selected: row.forecast_mw,
      actual: row.actual_mw,
      summary: summarizeVintageHour(data, row.startTime),
    })) ?? []
  const byStart = new Map(rows.map((row) => [row.startTime, row]))
  data?.vintages.forEach((vintage, index) =>
    vintage.rows.forEach((row) => {
      const target = byStart.get(row.startTime)
      if (target) Object.assign(target, { [`v${index}`]: row.forecast_mw })
    }),
  )
  const axis = niceAxis(
    rows.flatMap((row) => [
      row.selected,
      row.actual,
      ...data!.vintages.flatMap((vintage) =>
        vintage.rows
          .filter((item) => item.startTime === row.startTime)
          .map((item) => item.forecast_mw),
      ),
    ]),
  )

  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">02 / Forecast history</span>
          <h1 tabIndex={-1}>Forecast Revisions</h1>
          <p>
            See every published view of the delivery day available before the
            decision cutoff.
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
        <PageState query={query} label="forecast vintages" kind="revisions" />
      ) : data.vintages.length === 0 ? (
        <PageState query={query} label="forecast vintages" />
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
              ↗
            </span>
            <p>
              <strong>
                {data.vintages.length} publications available by{' '}
                {formatLondon(data.cutoff_utc)}.
              </strong>{' '}
              The selected line uses the latest eligible publication for each
              hour. Forecasts are revised several times daily; publication
              spacing varies.
            </p>
          </div>
          <ChartPanel
            title="How the forecast moved"
            description="Muted lines are earlier vintages. The strong blue line is the selected decision-time forecast; the dark teal line is actual generation. All values are MW."
            table={
              <table>
                <caption>All forecast vintages available by cutoff</caption>
                <thead>
                  <tr>
                    <th>Published · London</th>
                    <th>Delivery · London</th>
                    <th>Forecast MW</th>
                    <th>Horizon h</th>
                  </tr>
                </thead>
                <tbody>
                  {data.vintages.flatMap((vintage) =>
                    vintage.rows.map((row) => (
                      <tr key={`${vintage.publishTime}-${row.startTime}`}>
                        <td>{formatLondon(vintage.publishTime)}</td>
                        <td>{formatLondon(row.startTime)}</td>
                        <td>{formatMw(row.forecast_mw)}</td>
                        <td>{row.horizon_hours.toFixed(1)} h</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            }
          >
            <ResponsiveContainer width="100%" height={390}>
              <LineChart
                data={rows}
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
                <Tooltip
                  content={<RevisionsTooltip />}
                  offset={24}
                  cursor={false}
                  wrapperStyle={{ pointerEvents: 'none' }}
                />
                {data.vintages.map((vintage, index) => (
                  <Line
                    key={vintage.publishTime}
                    dataKey={`v${index}`}
                    name={`Published ${formatLondon(vintage.publishTime)}`}
                    stroke="var(--vintage)"
                    strokeOpacity={0.35}
                    strokeWidth={1.3}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={!reducedMotion}
                    animationDuration={400}
                  />
                ))}
                <Line
                  dataKey="selected"
                  name="Selected at cutoff"
                  stroke="var(--forecast)"
                  strokeWidth={3.5}
                  dot={false}
                  isAnimationActive={!reducedMotion}
                  animationDuration={400}
                />
                <Line
                  dataKey="actual"
                  name="Actual"
                  stroke="var(--actual)"
                  strokeWidth={3}
                  dot={false}
                  isAnimationActive={!reducedMotion}
                  animationDuration={400}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>
          <p className="chart-footnote">
            The selected line may combine publication times if different hours
            were last revised in different releases. Times shown in
            Europe/London.
          </p>
        </div>
      )}
    </>
  )
}
