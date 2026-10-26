import type { DecisionResponse, DecisionRow } from '../types/analytics'

const london = 'Europe/London'
const integer = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })

export function londonZoneLabel(iso: string): 'GMT' | 'BST' {
  const part = new Intl.DateTimeFormat('en-GB', {
    timeZone: london,
    timeZoneName: 'shortOffset',
  })
    .formatToParts(new Date(iso))
    .find((item) => item.type === 'timeZoneName')?.value
  return part === 'GMT+1' || part === 'GMT+01:00' ? 'BST' : 'GMT'
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: london,
  }).format(new Date(`${date}T12:00:00Z`))
}

export function deliveryDecisionLabel(
  deliveryDate: string,
  decisionDate: string,
  cutoff: number,
): string {
  const cutoffIso = `${decisionDate}T${String(cutoff).padStart(2, '0')}:00:00Z`
  return `Delivery ${formatDate(deliveryDate)}, decision made ${formatDate(decisionDate)} ${String(cutoff).padStart(2, '0')}:00 ${londonZoneLabel(cutoffIso)}`
}

export function formatMw(
  value: number | null | undefined,
  signed = false,
): string {
  if (value == null) return '—'
  return `${signed && value > 0 ? '+' : ''}${integer.format(value)} MW`
}

export function formatMwh(value: number | null | undefined): string {
  return value == null ? '—' : `${integer.format(value)} MWh`
}

export function formatPercent(value: number | null | undefined): string {
  return value == null ? '—' : `${decimal.format(value * 100)}%`
}

export function formatLondon(iso: string, includeDate = true): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: london,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (part: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === part)?.value ?? ''
  return `${includeDate ? `${get('day')} ${get('month')} ` : ''}${get('hour')}:${get('minute')} ${londonZoneLabel(iso)}`
}

export function formatHour(iso: string): string {
  return formatLondon(iso, false)
}

export function decisionBanner(data: DecisionResponse): string {
  const publications = [
    ...new Set(data.rows.map((row) => row.publishTime)),
  ].sort()
  const published =
    publications.length === 1
      ? `published ${formatLondon(publications[0])}`
      : `published ${formatLondon(publications[0])} to ${formatLondon(publications[publications.length - 1])}`
  const horizons = data.rows.map((row) => row.horizon_hours)
  const min = Math.min(...horizons)
  const max = Math.max(...horizons)
  return `Decision cutoff: ${formatLondon(data.cutoff_utc)}. Forecast used: ${published}, ${decimal.format(min)}–${decimal.format(max)} h before delivery.`
}

export function peakShortfall(rows: DecisionRow[]): DecisionRow | undefined {
  return rows.reduce<DecisionRow | undefined>(
    (peak, row) =>
      row.error_mw > 0 && (!peak || row.error_mw > peak.error_mw) ? row : peak,
    undefined,
  )
}

export const SIGN_CONVENTION =
  'Positive error = forecast above actual = extra power to buy.'

export function downloadRows(rows: DecisionRow[], day: string): void {
  const header = [
    'startTime_utc',
    'startTime_london',
    'forecast_mw',
    'actual_mw',
    'error_mw',
    'publishTime_utc',
    'horizon_hours',
  ]
  const csv = [
    header.join(','),
    ...rows.map((row) =>
      [
        row.startTime,
        `"${formatLondon(row.startTime)}"`,
        row.forecast_mw,
        row.actual_mw,
        row.error_mw,
        row.publishTime,
        row.horizon_hours,
      ].join(','),
    ),
  ].join('\n')
  const url = URL.createObjectURL(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `wind-decision-${day}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
