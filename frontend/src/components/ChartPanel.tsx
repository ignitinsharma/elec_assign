import type { ReactNode } from 'react'

export function ChartPanel({
  title,
  description,
  children,
  table,
}: {
  title: string
  description: string
  children: ReactNode
  table?: ReactNode
}) {
  return (
    <section className="chart-panel" aria-label={title}>
      <div className="section-head">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="chart-space">{children}</div>
      {table && (
        <details className="chart-table">
          <summary>View chart data as a table</summary>
          <div className="table-scroll">{table}</div>
        </details>
      )}
    </section>
  )
}
