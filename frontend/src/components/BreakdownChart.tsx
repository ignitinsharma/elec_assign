import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Breakdown } from '../types/analytics'
import { formatMw } from '../utils/format'
import { chartRows } from '../utils/chartData'
import { formatAxisTick, niceAxis } from '../utils/chartAxes'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { BreakdownTable } from './BreakdownTable'
import { ChartPanel } from './ChartPanel'

export function BreakdownChart({
  rows,
  title,
  description,
}: {
  rows: Breakdown[]
  title: string
  description: string
}) {
  const reducedMotion = useReducedMotion()
  const plotted = chartRows(rows)
  const axis = niceAxis(plotted.flatMap((row) => [row.mae ?? 0, row.bias ?? 0]))
  return (
    <ChartPanel
      title={title}
      description={description}
      table={<BreakdownTable rows={rows} heading={title} />}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={plotted}
          margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
          accessibilityLayer
        >
          <CartesianGrid strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="key" interval={rows.length > 20 ? 4 : 0} />
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
          <Bar
            dataKey="mae"
            name="MAE"
            fill="var(--mae)"
            radius={[3, 3, 0, 0]}
            isAnimationActive={!reducedMotion}
            animationDuration={400}
          />
          <Bar
            dataKey="bias"
            name="Bias"
            fill="var(--warning)"
            radius={[3, 3, 0, 0]}
            isAnimationActive={!reducedMotion}
            animationDuration={400}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  )
}
