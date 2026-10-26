export function MetricCard({
  label,
  value,
  explanation,
  tone,
  subtext,
}: {
  label: string
  value: string
  explanation?: string
  tone?: 'warning' | 'forecast'
  subtext?: string
}) {
  return (
    <div className={`metric-card ${tone ? `metric-${tone}` : ''}`}>
      <div className="metric-heading">
        <span>{label}</span>
        {explanation && (
          <details className="metric-help">
            <summary aria-label={`About ${label}`}>i</summary>
            <div>{explanation}</div>
          </details>
        )}
      </div>
      <strong>{value}</strong>
      {subtext && <span className="metric-subtext">{subtext}</span>}
    </div>
  )
}
