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

export function ForecastRevisions() {
  const { meta, day, setDay, cutoff, setCutoff } = useDashboard()
  const query = useVintages(day, cutoff)
  const data = query.data
  const rows =
    data?.selected_rows.map((row) => ({
      startTime: row.startTime,
      hour: formatHour(row.startTime).slice(0, 5),
      localTime: formatLondon(row.startTime),
      selected: row.forecast_mw,
      actual: row.actual_mw,
    })) ?? []
  const byStart = new Map(rows.map((row) => [row.startTime, row]))
  data?.vintages.forEach((vintage, index) =>
    vintage.rows.forEach((row) => {
      const target = byStart.get(row.startTime)
      if (target) Object.assign(target, { [`v${index}`]: row.forecast_mw })
    }),
  )

  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">02 / Forecast history</span>
          <h1>Forecast Revisions</h1>
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
        <PageState query={query} label="forecast vintages" />
      ) : data.vintages.length === 0 ? (
        <PageState query={query} label="forecast vintages" />
      ) : (
        <>
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
                  tickFormatter={(value: number) =>
                    `${Math.round(value / 1000)}k`
                  }
                  label={{ value: 'MW', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  formatter={(value, name) => [formatMw(Number(value)), name]}
                  labelFormatter={(_, payload) =>
                    String(payload?.[0]?.payload?.localTime ?? '')
                  }
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
                    isAnimationActive={false}
                  />
                ))}
                <Line
                  dataKey="selected"
                  name="Selected at cutoff"
                  stroke="var(--forecast)"
                  strokeWidth={3.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="actual"
                  name="Actual"
                  stroke="var(--actual)"
                  strokeWidth={3}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>
          <p className="chart-footnote">
            The selected line may combine publication times if different hours
            were last revised in different releases. Times shown in
            Europe/London.
          </p>
        </>
      )}
    </>
  )
}
