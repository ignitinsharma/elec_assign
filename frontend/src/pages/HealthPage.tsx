import { useEffect, useState } from 'react'
import { getHealth } from '../api/health'

export function HealthPage() {
  const [status, setStatus] = useState('Checking API…')

  useEffect(() => {
    let active = true
    getHealth()
      .then(({ status }) => {
        if (active) setStatus(status === 'ok' ? 'Connected' : 'Unavailable')
      })
      .catch(() => {
        if (active) setStatus('Unavailable')
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <main>
      <h1>Day-ahead wind review</h1>
      <p>January 2026 · National wind generation</p>
      <p role="status">Backend status: {status}</p>
    </main>
  )
}
