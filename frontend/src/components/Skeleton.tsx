import { useEffect, useState } from 'react'

export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton ${className}`} />
}

export function LoadingRegion({
  kind = 'chart',
}: {
  kind?: 'decision' | 'revisions' | 'accuracy' | 'method' | 'chart' | 'card'
}) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 6000)
    return () => window.clearTimeout(timer)
  }, [])
  const main =
    kind === 'decision' ||
    kind === 'revisions' ||
    kind === 'accuracy' ||
    kind === 'method'
  return (
    <div
      className="loading-region"
      role="status"
      aria-busy="true"
      aria-label="Loading data"
    >
      {main && (
        <div className="skeleton-title">
          <Skeleton className="skeleton-heading" />
          <Skeleton className="skeleton-subtitle" />
        </div>
      )}
      {(kind === 'decision' || kind === 'revisions') && (
        <Skeleton className="skeleton-banner" />
      )}
      {(kind === 'decision' || kind === 'accuracy') && (
        <div className={`metric-grid ${kind === 'decision' ? 'four' : 'six'}`}>
          {Array.from({ length: kind === 'decision' ? 4 : 6 }, (_, index) => (
            <div className="skeleton-card" key={index}>
              <Skeleton className="skeleton-label" />
              <Skeleton className="skeleton-value" />
            </div>
          ))}
        </div>
      )}
      {kind === 'method' && (
        <div className="method-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="skeleton-card" key={index}>
              <Skeleton className="skeleton-label" />
              <Skeleton className="skeleton-subtitle" />
              <Skeleton className="skeleton-subtitle" />
            </div>
          ))}
        </div>
      )}
      {kind !== 'card' && kind !== 'method' && (
        <div className="skeleton-chart">
          <Skeleton className="skeleton-chart-title" />
          <Skeleton className="skeleton-chart-body" />
        </div>
      )}
      {kind === 'card' && (
        <div className="skeleton-card">
          <Skeleton className="skeleton-label" />
          <Skeleton className="skeleton-value" />
          <Skeleton className="skeleton-subtitle" />
        </div>
      )}
      {main && kind !== 'method' && (
        <div className="skeleton-table">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton className="skeleton-row" key={index} />
          ))}
        </div>
      )}
      {slow && (
        <p className="slow-message">
          Waking up the data service, this can take a few seconds.
        </p>
      )}
    </div>
  )
}
