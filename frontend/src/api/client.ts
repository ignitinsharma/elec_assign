import type {
  AccuracyResponse,
  DecisionResponse,
  DiagnosticsResponse,
  HorizonResponse,
  MetaResponse,
  PointsResponse,
  VintageResponse,
} from '../types/analytics'

async function getJson<T>(
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const query = params
    ? `?${new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]))}`
    : ''
  const response = await fetch(`/api/${path}${query}`)
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      detail?: string
    } | null
    throw new Error(body?.detail || `Request failed (${response.status})`)
  }
  return (await response.json()) as T
}

export const windApi = {
  meta: () => getJson<MetaResponse>('meta'),
  decision: (date: string, cutoff_hour: number) =>
    getJson<DecisionResponse>('decision-forecast', { date, cutoff_hour }),
  vintages: (date: string, cutoff_hour: number) =>
    getJson<VintageResponse>('forecast-vintages', { date, cutoff_hour }),
  accuracy: (start: string, end: string, cutoff_hour: number) =>
    getJson<AccuracyResponse>('accuracy', { start, end, cutoff_hour }),
  points: (start: string, end: string, cutoff_hour: number) =>
    getJson<PointsResponse>('accuracy/points', { start, end, cutoff_hour }),
  horizon: () => getJson<HorizonResponse>('accuracy/horizon'),
  diagnostics: () => getJson<DiagnosticsResponse>('diagnostics'),
}
