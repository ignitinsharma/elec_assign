import type { HealthResponse } from '../types/health'

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health')
  if (!response.ok) throw new Error(`Health check failed: ${response.status}`)
  return (await response.json()) as HealthResponse
}
