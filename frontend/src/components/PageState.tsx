import type { UseQueryResult } from '@tanstack/react-query'
import { LoadingRegion } from './Skeleton'

export function PageState({
  query,
  label,
  kind = 'chart',
}: {
  query: Pick<UseQueryResult, 'isPending' | 'isError' | 'error' | 'refetch'>
  label: string
  kind?: 'decision' | 'revisions' | 'accuracy' | 'method' | 'chart' | 'card'
}) {
  if (query.isPending) return <LoadingRegion kind={kind} />
  if (query.isError)
    return (
      <div className="state-panel error" role="alert">
        <strong>Could not load {label}.</strong>
        <p>
          {query.error instanceof Error
            ? query.error.message
            : 'Please try again.'}
        </p>
        <button onClick={() => void query.refetch()}>Retry</button>
      </div>
    )
  return (
    <div className="state-panel">
      No {label} is available for this selection.
    </div>
  )
}
