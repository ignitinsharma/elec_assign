import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PointsResponse } from '../types/analytics'
import { formatLondon, formatMw } from '../utils/format'
import { ChartPanel } from './ChartPanel'

export function ScatterPanel({ data }: { data: PointsResponse }) {
  const axisMax = Math.max(
    ...data.rows.flatMap((row) => [row.forecast_mw, row.actual_mw]),
  )
  return (
    <ChartPanel
      title="Forecast vs actual"
      description={`${data.rows.length} hourly decision-time points. The diagonal represents a perfect forecast; points above it overforecast wind.`}
      table={
        <table>
          <caption>Forecast versus actual hourly points</caption>
          <thead>
            <tr>
              <th>Delivery · London</th>
              <th>Actual MW</th>
              <th>Forecast MW</th>
              <th>Error MW</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.startTime}>
                <th scope="row">{formatLondon(row.startTime)}</th>
                <td>{formatMw(row.actual_mw)}</td>
                <td>{formatMw(row.forecast_mw)}</td>
                <td>{formatMw(row.error_mw, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart
          margin={{ top: 12, right: 15, bottom: 18, left: 8 }}
          accessibilityLayer
        >
          <CartesianGrid strokeDasharray="3 5" />
          <XAxis
            type="number"
            dataKey="actual_mw"
            name="Actual"
            domain={[0, axisMax]}
            tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}
            label={{
              value: 'Actual MW',
              position: 'insideBottom',
              offset: -10,
            }}
          />
          <YAxis
            type="number"
            dataKey="forecast_mw"
            name="Forecast"
            domain={[0, axisMax]}
            tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}
            label={{ value: 'Forecast MW', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            formatter={(value, name) => [formatMw(Number(value)), name]}
          />
          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: axisMax, y: axisMax },
            ]}
            stroke="var(--muted)"
            strokeDasharray="5 5"
          />
          <Scatter
            name="Hourly comparisons"
            data={data.rows}
            fill="var(--forecast)"
            fillOpacity={0.5}
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartPanel>
  )
}
