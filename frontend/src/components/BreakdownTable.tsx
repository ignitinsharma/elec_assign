import type { Breakdown } from '../types/analytics'
import { formatMw } from '../utils/format'

export function BreakdownTable({
  rows,
  heading,
}: {
  rows: Breakdown[]
  heading: string
}) {
  return (
    <table>
      <caption>{heading}</caption>
      <thead>
        <tr>
          <th>Group</th>
          <th>n</th>
          <th>MAE MW</th>
          <th>Bias MW</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row">{row.key}</th>
            <td>{row.metrics.n}</td>
            <td>{formatMw(row.metrics.mae_mw)}</td>
            <td>{formatMw(row.metrics.bias_mw, true)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
