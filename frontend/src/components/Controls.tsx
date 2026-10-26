import type { MetaResponse } from '../types/analytics'

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
          {meta.available_delivery_dates.map((date) => (
            <option key={date} value={date}>
              {new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'Europe/London',
              })}
            </option>
          ))}
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
  const options = meta.available_delivery_dates.map((day) => (
    <option key={day} value={day}>
      {day}
    </option>
  ))
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
