/** Round chart domains to readable MW ticks, always including zero. */
export function niceAxis(
  values: number[],
  targetIntervals = 4,
): { ticks: number[]; domain: [number, number] } {
  const finite = values.filter(Number.isFinite)
  const low = Math.min(0, ...finite)
  const high = Math.max(0, ...finite)
  const span = Math.max(high - low, 1)
  const rough = span / targetIntervals
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const candidates = [magnitude / 10, magnitude, magnitude * 10]
    .flatMap((scale) => [1, 2, 2.5, 5, 10].map((factor) => factor * scale))
    .sort((a, b) => a - b)
  const step =
    candidates.find(
      (candidate) =>
        Math.ceil(high / candidate) - Math.floor(low / candidate) <=
        targetIntervals + 2,
    ) ?? 10 * magnitude
  const min = Math.floor(low / step) * step
  const max = Math.max(step, Math.ceil(high / step) * step)
  const ticks = Array.from(
    { length: Math.round((max - min) / step) + 1 },
    (_, index) => min + index * step,
  )
  return { ticks, domain: [min, max] }
}

export function formatAxisTick(value: number): string {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(
    value === 0 ? 0 : value,
  )
}
