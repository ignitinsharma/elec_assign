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
import { BreakdownTable } from './BreakdownTable'
import { ChartPanel } from './ChartPanel'

export function HorizonPanel({ data }: { data: HorizonResponse }) {
  return (
    <ChartPanel
      title="Accuracy as delivery approaches"
      description="Separate all-vintages analysis: every nonnegative-horizon WINDFOR publication, including vintages after the trading cutoff. MAE and bias are MW by horizon bucket."
      table={
        <BreakdownTable
          rows={data.buckets}
          heading="All-vintages horizon buckets"
        />
      }
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={chartRows(data.buckets)}
          margin={{ top: 10, right: 10, bottom: 8, left: 0 }}
          accessibilityLayer
        >
          <CartesianGrid strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="key" />
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
          <Line
            dataKey="mae"
            name="MAE"
            stroke="var(--forecast)"
            strokeWidth={3}
          />
          <Line
            dataKey="bias"
            name="Bias"
            stroke="var(--actual)"
            strokeWidth={3}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartPanel>
  )
}
