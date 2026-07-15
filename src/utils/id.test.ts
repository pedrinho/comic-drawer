import { describe, it, expect } from 'vitest'
import { generateLayerId } from './id'

describe('generateLayerId', () => {
  it('returns a non-empty string', () => {
    const id = generateLayerId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('returns distinct ids across calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateLayerId()))
    expect(ids.size).toBe(100)
  })
})
