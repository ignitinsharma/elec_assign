import type { Breakdown } from '../types/analytics'

export function chartRows(rows: Breakdown[]) {
  return rows.map((row) => ({
    key: /^\d{4}-\d{2}-\d{2}$/.test(row.key) ? row.key.slice(8) : row.key,
    mae: row.metrics.mae_mw,
    bias: row.metrics.bias_mw,
  }))
}
