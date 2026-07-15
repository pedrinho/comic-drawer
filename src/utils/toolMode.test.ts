import { describe, it, expect } from 'vitest'
import { Tool, Mode } from '../types/common'
import { toolToMode } from './toolMode'

describe('toolToMode', () => {
  const cases: Array<[Tool, Mode]> = [
    ['objectShapes', 'shape'],
    ['balloon', 'balloon'],
    ['text', 'text'],
    ['emoji', 'text'], // emoji collapses into text mode
    ['select', 'select'],
    ['fill', 'fill'],
    ['pen', 'pen'],
    ['eraser', 'eraser'],
    ['scissor', 'scissor'],
  ]

  it.each(cases)('maps %s → %s', (tool, mode) => {
    expect(toolToMode(tool)).toBe(mode)
  })

  it('covers every Tool value', () => {
    const tools: Tool[] = ['select', 'scissor', 'pen', 'eraser', 'objectShapes', 'text', 'fill', 'balloon', 'emoji']
    expect(cases.map(([t]) => t).sort()).toEqual([...tools].sort())
  })
})
