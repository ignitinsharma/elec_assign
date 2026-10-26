import type { MetaResponse } from '../types/analytics'
import { deliveryDecisionLabel } from '../utils/format'

export function DayCutoffControls({
  meta,
  day,
  onDay,
  cutoff,
  onCutoff,
}: {
  meta: MetaResponse
  day: string
  onDay: (value: string) => void
  cutoff: number
  onCutoff: (value: number) => void
}) {
  return (
    <div className="controls">
      <label>
        Delivery day{' '}
        <select value={day} onChange={(event) => onDay(event.target.value)}>
          {meta.available_delivery_decisions.map(
            ({ delivery_date: date, decision_date: decisionDate }) => (
              <option key={date} value={date}>
                {deliveryDecisionLabel(date, decisionDate, cutoff)}
              </option>
            ),
          )}
        </select>
      </label>
      <CutoffControl value={cutoff} onChange={onCutoff} />
    </div>
  )
}

export function CutoffControl({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label>
      Decision cutoff{' '}
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {Array.from({ length: 24 }, (_, hour) => (
          <option key={hour} value={hour}>
            {String(hour).padStart(2, '0')}:00 London
          </option>
        ))}
      </select>
    </label>
  )
}

export function RangeControls({
  meta,
  start,
  end,
  onStart,
  onEnd,
  cutoff,
  onCutoff,
}: {
  meta: MetaResponse
  start: string
  end: string
  onStart: (value: string) => void
  onEnd: (value: string) => void
  cutoff: number
  onCutoff: (value: number) => void
}) {
  const options = meta.available_delivery_decisions.map(
    ({ delivery_date: day, decision_date: decisionDate }) => (
      <option key={day} value={day}>
        {deliveryDecisionLabel(day, decisionDate, cutoff)}
      </option>
    ),
  )
  return (
    <div className="controls">
      <label>
        From{' '}
        <select value={start} onChange={(event) => onStart(event.target.value)}>
          {options}
        </select>
      </label>
      <label>
        To{' '}
        <select value={end} onChange={(event) => onEnd(event.target.value)}>
          {options}
        </select>
      </label>
      <CutoffControl value={cutoff} onChange={onCutoff} />
    </div>
  )
}
