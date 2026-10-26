import { renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useReducedMotion } from './useReducedMotion'

it('reads the reduced-motion media preference', () => {
  const previous = window.matchMedia
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  try {
    expect(renderHook(useReducedMotion).result.current).toBe(true)
  } finally {
    window.matchMedia = previous
  }
})
