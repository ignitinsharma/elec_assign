import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useDecision } from './useWindData'

const pending = new Map<string, (value: unknown) => void>()
vi.mock('../api/client', () => ({
  windApi: {
    decision: (day: string) =>
      new Promise((resolve) => pending.set(day, resolve)),
  },
}))

function Probe({ day }: { day: string }) {
  const query = useDecision(day, 9)
  return (
    <div>
      {query.data?.date ?? 'skeleton'}{' '}
      {query.isPlaceholderData ? 'Updating…' : ''}
    </div>
  )
}

it('keeps previous decision data visible while the next day loads', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = (day: string) => (
    <QueryClientProvider client={client}>
      <Probe day={day} />
    </QueryClientProvider>
  )
  const view = render(wrapper('2026-01-01'))
  expect(screen.getByText(/skeleton/)).toBeInTheDocument()
  pending.get('2026-01-01')?.({ date: '2026-01-01' })
  await screen.findByText('2026-01-01')
  view.rerender(wrapper('2026-01-02'))
  expect(screen.getByText(/2026-01-01 Updating/)).toBeInTheDocument()
  pending.get('2026-01-02')?.({ date: '2026-01-02' })
  await waitFor(() =>
    expect(screen.getByText('2026-01-02')).toBeInTheDocument(),
  )
})
