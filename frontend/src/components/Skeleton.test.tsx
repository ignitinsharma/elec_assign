import { act, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { LoadingRegion } from './Skeleton'

it('shows layout skeletons and the cold-start note after six seconds', () => {
  vi.useFakeTimers()
  render(<LoadingRegion kind="decision" />)
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  expect(document.querySelectorAll('.skeleton-card')).toHaveLength(4)
  expect(screen.queryByText(/Waking up/)).not.toBeInTheDocument()
  act(() => vi.advanceTimersByTime(6000))
  expect(screen.getByText(/Waking up the data service/)).toBeInTheDocument()
  vi.useRealTimers()
})
