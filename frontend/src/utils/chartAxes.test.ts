import { describe, expect, it } from 'vitest'
import { formatAxisTick, niceAxis } from './chartAxes'

describe('MW axes', () => {
  it('starts generation at zero with distinct, round ticks', () => {
    const axis = niceAxis([1695, 17805])
    expect(axis).toEqual({
      domain: [0, 20000],
      ticks: [0, 5000, 10000, 15000, 20000],
    })
    expect(axis.ticks.map(formatAxisTick)).toEqual([
      '0',
      '5,000',
      '10,000',
      '15,000',
      '20,000',
    ])
    expect(niceAxis([20_100]).domain).toEqual([0, 25_000])
  })

  it('keeps negative error ticks distinct and signed', () => {
    const axis = niceAxis([-2730, 1510])
    expect(axis.ticks).toContain(0)
    expect(axis.domain[0]).toBeLessThan(0)
    expect(formatAxisTick(-2000)).toBe('-2,000')
    expect(formatAxisTick(-0)).toBe('0')
  })
})
