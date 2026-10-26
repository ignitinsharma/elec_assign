import type { UseQueryResult } from '@tanstack/react-query'

export function PageState({
  query,
  label,
}: {
  query: Pick<UseQueryResult, 'isPending' | 'isError' | 'error' | 'refetch'>
  label: string
}) {
  if (query.isPending)
    return (
      <div className="state-panel" role="status">
        Loading {label}…
      </div>
    )
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
