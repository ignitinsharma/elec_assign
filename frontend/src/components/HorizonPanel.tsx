import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HorizonResponse } from '../types/analytics'
import { formatMw } from '../utils/format'
import { chartRows } from '../utils/chartData'
import { formatAxisTick, niceAxis } from '../utils/chartAxes'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { BreakdownTable } from './BreakdownTable'
import { ChartPanel } from './ChartPanel'

export function HorizonPanel({ data }: { data: HorizonResponse }) {
  const reducedMotion = useReducedMotion()
  const plotted = chartRows(data.buckets)
  const axis = niceAxis(plotted.flatMap((row) => [row.mae ?? 0, row.bias ?? 0]))
  return (
    <ChartPanel
      title="Forecast error by lead time (all vintages)"
      description="Day-ahead decisions use roughly 16–40 h lead times; shorter lead times were not available to the buyer. Separate all-vintages analysis, including publications after the decision cutoff. MAE and bias in MW."
      table={
        <BreakdownTable
          rows={data.buckets}
          heading="All-vintages horizon buckets"
        />
      }
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={plotted}
          margin={{ top: 10, right: 10, bottom: 8, left: 0 }}
          accessibilityLayer
        >
          <CartesianGrid strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="key" />
          <YAxis
            domain={axis.domain}
            ticks={axis.ticks}
            tickFormatter={formatAxisTick}
            label={{ value: 'MW', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            formatter={(value, name) => [
              formatMw(Number(value), name === 'Bias'),
              name,
            ]}
          />
          <Legend />
          <Line
            dataKey="mae"
            name="MAE"
            stroke="var(--mae)"
            strokeWidth={3}
            isAnimationActive={!reducedMotion}
            animationDuration={400}
          />
          <Line
            dataKey="bias"
            name="Bias"
            stroke="var(--warning)"
            strokeWidth={3}
            isAnimationActive={!reducedMotion}
            animationDuration={400}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartPanel>
  )
}
