import { describe, it, expect } from 'vitest'
import {
  migrateLayer,
  migrateLayers,
  isShapeObjectLayer,
  isTextObjectLayer,
  isPathObjectLayer,
  isGroupObjectLayer,
  ObjectLayer,
} from './layers'

// Old .cd files (pre-discriminated-union) stored layers WITHOUT a `type` field. migrateLayer
// must backfill the correct `type` by sniffing the layer's properties, so loading an old file
// produces a valid model. These tests pin that inference — the load path in App.tsx depends on it.

const base = { id: 'l1', x: 10, y: 20, width: 100, height: 50, rotation: 0 }

describe('migrateLayer type inference (legacy files without `type`)', () => {
  it('infers a path layer from `points`', () => {
    const migrated = migrateLayer({ ...base, points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] } as any)
    expect(migrated.type).toBe('path')
    expect(isPathObjectLayer(migrated)).toBe(true)
    if (isPathObjectLayer(migrated)) {
      expect(migrated.points).toHaveLength(2)
      expect(migrated.strokeColor).toBe('#000000') // default backfilled
      expect(migrated.strokeWidth).toBe(2)
    }
  })

  it('infers a shape layer from `shape`/stroke properties', () => {
    const migrated = migrateLayer({ ...base, shape: 'star', strokeColor: '#ff0000' } as any)
    expect(migrated.type).toBe('shape')
    if (isShapeObjectLayer(migrated)) {
      expect(migrated.shape).toBe('star')
      expect(migrated.strokeColor).toBe('#ff0000')
      expect(migrated.fillColor).toBeNull() // backfilled default
    }
  })

  it('infers a text layer from text properties', () => {
    const migrated = migrateLayer({ ...base, text: 'Hi', font: 'Comic Sans' } as any)
    expect(migrated.type).toBe('text')
    if (isTextObjectLayer(migrated)) {
      expect(migrated.text).toBe('Hi')
      expect(migrated.font).toBe('Comic Sans')
      expect(migrated.fontSize).toBe(24) // backfilled default
    }
  })

  it('defaults to a rectangle shape when the type cannot be inferred', () => {
    const migrated = migrateLayer({ ...base } as any)
    expect(migrated.type).toBe('shape')
    if (isShapeObjectLayer(migrated)) {
      expect(migrated.shape).toBe('rectangle')
    }
  })
})

describe('migrateLayer with an explicit `type` (already-migrated files)', () => {
  it('passes a typed shape layer through unchanged', () => {
    const layer: ObjectLayer = {
      ...base,
      type: 'shape',
      shape: 'circle',
      strokeColor: '#123456',
      strokeWidth: 4,
      fillColor: '#eeeeee',
    }
    expect(migrateLayer(layer as any)).toBe(layer) // returned as-is, not re-wrapped
  })

  it('recursively migrates children of a group', () => {
    const group = {
      ...base,
      type: 'group',
      children: [
        { ...base, id: 'c1', points: [{ x: 0, y: 0 }] }, // legacy path, no type
        { ...base, id: 'c2', shape: 'triangle' }, // legacy shape, no type
      ],
    }
    const migrated = migrateLayer(group as any)
    expect(isGroupObjectLayer(migrated)).toBe(true)
    if (isGroupObjectLayer(migrated)) {
      expect(migrated.children).toHaveLength(2)
      expect(migrated.children[0]!.type).toBe('path')
      expect(migrated.children[1]!.type).toBe('shape')
    }
  })
})

describe('migrateLayers', () => {
  it('migrates every layer in an array', () => {
    const migrated = migrateLayers([
      { ...base, id: 'a', shape: 'rectangle' },
      { ...base, id: 'b', text: 'x' },
      { ...base, id: 'c', points: [] },
    ] as any)
    expect(migrated.map((l) => l.type)).toEqual(['shape', 'text', 'path'])
  })

  it('returns an empty array for empty input', () => {
    expect(migrateLayers([])).toEqual([])
  })
})
