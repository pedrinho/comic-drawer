import { describe, it, expect } from 'vitest'
import * as fabric from 'fabric'
import { PathObjectLayer } from '../types/layers'
import { pathLayerToFabricPath, fabricPathToLayer, PATH_ID_KEY } from './fabricPath'
import { fabricObjectKind } from './fabricImage'
import { shapeLayerToFabricObject } from './fabricShapes'

const makeLayer = (overrides: Partial<PathObjectLayer> = {}): PathObjectLayer => ({
  type: 'path',
  id: 'path-1',
  x: 100,
  y: 80,
  width: 60,
  height: 40,
  rotation: 0,
  strokeColor: '#123456',
  strokeWidth: 5,
  points: [
    { x: 0, y: 0 },
    { x: 60, y: 0 },
    { x: 60, y: 40 },
    { x: 30, y: 40 },
    { x: 0, y: 20 },
  ],
  ...overrides,
})

describe('fabricPath conversion', () => {
  it('builds a fabric.Path carrying the path id', () => {
    const layer = makeLayer({ id: 'pen-abc' })
    const obj = pathLayerToFabricPath(layer)
    expect(obj).toBeInstanceOf(fabric.Path)
    expect((obj as any)[PATH_ID_KEY]).toBe('pen-abc')
  })

  it('round-trips bbox, points, and style', () => {
    const layer = makeLayer()
    const back = fabricPathToLayer(pathLayerToFabricPath(layer))
    expect(back.id).toBe(layer.id)
    expect(back.x).toBeCloseTo(layer.x, 3)
    expect(back.y).toBeCloseTo(layer.y, 3)
    expect(back.width).toBeCloseTo(layer.width, 3)
    expect(back.height).toBeCloseTo(layer.height, 3)
    expect(back.rotation).toBeCloseTo(0, 6)
    expect(back.strokeColor).toBe('#123456')
    expect(back.strokeWidth).toBe(5)
    expect(back.points).toHaveLength(layer.points.length)
    layer.points.forEach((p, i) => {
      expect(back.points[i].x).toBeCloseTo(p.x, 3)
      expect(back.points[i].y).toBeCloseTo(p.y, 3)
    })
  })

  it('round-trips rotation (about the bbox centre)', () => {
    const layer = makeLayer({ rotation: Math.PI / 5 })
    const back = fabricPathToLayer(pathLayerToFabricPath(layer))
    expect(back.rotation).toBeCloseTo(Math.PI / 5, 6)
    // Centre is invariant under rotation, so bbox top-left still round-trips.
    expect(back.x).toBeCloseTo(layer.x, 3)
    expect(back.y).toBeCloseTo(layer.y, 3)
    expect(back.width).toBeCloseTo(layer.width, 3)
    expect(back.height).toBeCloseTo(layer.height, 3)
  })

  it('reflects a Fabric resize (scale) back into the layer dimensions', () => {
    const layer = makeLayer({ width: 60, height: 40 })
    const obj = pathLayerToFabricPath(layer)
    obj.set({ scaleX: 1.5, scaleY: 2 })
    const back = fabricPathToLayer(obj)
    expect(back.width).toBeCloseTo(90, 3)
    expect(back.height).toBeCloseTo(80, 3)
  })

  it('extracts anchor points from a curved (brush-style) path', () => {
    // PencilBrush emits quadratic (Q) commands; the anchor is the final coord pair.
    const obj = new fabric.Path('M 0 0 Q 10 20 20 0 Q 30 -20 40 0', {
      [PATH_ID_KEY]: 'brush-1',
    } as any)
    const back = fabricPathToLayer(obj)
    // 3 anchors: (0,0), (20,0), (40,0).
    expect(back.points).toHaveLength(3)
    expect(back.width).toBeCloseTo(40, 3)
  })

  it('fabricObjectKind distinguishes a pen path from a heart shape (both fabric.Path)', () => {
    const penPath = pathLayerToFabricPath(makeLayer())
    expect(fabricObjectKind(penPath)).toBe('path')

    const heart = shapeLayerToFabricObject({
      type: 'shape',
      id: 'h1',
      shape: 'heart',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      strokeColor: '#000',
      strokeWidth: 2,
      fillColor: null,
    })
    expect(heart).toBeInstanceOf(fabric.Path)
    expect(fabricObjectKind(heart)).toBe('shape')
  })
})
