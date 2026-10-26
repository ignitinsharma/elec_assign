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
  return (
    <ChartPanel
      title={title}
      description={description}
      table={<BreakdownTable rows={rows} heading={title} />}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={chartRows(rows)}
          margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
          accessibilityLayer
        >
          <CartesianGrid strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="key" interval={rows.length > 20 ? 4 : 0} />
          <YAxis
            tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}
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
            fill="var(--forecast)"
            radius={[3, 3, 0, 0]}
          />
          <Bar
            dataKey="bias"
            name="Bias"
            fill="var(--actual)"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  )
}
