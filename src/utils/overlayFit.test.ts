import { describe, it, expect } from 'vitest'
import { fitOverlay } from './overlayFit'

describe('fitOverlay', () => {
  it('falls back to full 1200x800 @ 1:1 when the container is null or unmeasurable', () => {
    expect(fitOverlay(null)).toEqual({ width: 1200, height: 800, scale: 1 })
    expect(fitOverlay({ clientWidth: 0, clientHeight: 0 })).toEqual({ width: 1200, height: 800, scale: 1 })
    expect(fitOverlay({ clientWidth: 800, clientHeight: 0 })).toEqual({ width: 1200, height: 800, scale: 1 })
  })

  it('scales uniformly to the tighter of width/height (letterboxing)', () => {
    // Both dims allow 2x.
    expect(fitOverlay({ clientWidth: 2400, clientHeight: 1600 })).toEqual({ width: 2400, height: 1600, scale: 2 })
    // Height is the limit: 1600/800 = 2 but 1200/1200 = 1 → scale 1.
    expect(fitOverlay({ clientWidth: 1200, clientHeight: 1600 })).toEqual({ width: 1200, height: 800, scale: 1 })
    // Width is the limit: 600/1200 = 0.5.
    expect(fitOverlay({ clientWidth: 600, clientHeight: 800 })).toEqual({ width: 600, height: 400, scale: 0.5 })
  })
})
