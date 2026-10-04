import { describe, it, expect } from 'vitest'
import { Shape } from '../types/common'
import { ShapeObjectLayer } from '../types/layers'
import {
  shapeLayerToFabricObject,
  fabricObjectToShapeLayer,
  computeShapePoints,
  SHAPE_ID_KEY,
  SHAPE_KIND_KEY,
  regularPolygonPoints,
  clampSides,
} from './fabricShapes'

const ALL_SHAPES: Shape[] = [
  'rectangle', 'circle', 'triangle', 'star', 'heart', 'diamond',
  'hexagon', 'pentagon', 'arrow', 'cross', 'heptagon', 'octagon', 'polygon',
]

const makeLayer = (overrides: Partial<ShapeObjectLayer> = {}): ShapeObjectLayer => ({
  type: 'shape',
  id: 'shape-1',
  shape: 'rectangle',
  x: 100,
  y: 80,
  width: 200,
  height: 120,
  rotation: 0,
  strokeColor: '#123456',
  strokeWidth: 3,
  fillColor: null,
  ...overrides,
})

describe('fabricShapes conversion', () => {
  it('creates a Fabric object for every shape kind carrying id + kind metadata', () => {
    for (const shape of ALL_SHAPES) {
      const layer = makeLayer({ shape, id: `id-${shape}` })
      const obj = shapeLayerToFabricObject(layer)
      expect(obj).toBeTruthy()
      expect((obj as any)[SHAPE_ID_KEY]).toBe(`id-${shape}`)
      expect((obj as any)[SHAPE_KIND_KEY]).toBe(shape)
    }
  })

  it('round-trips bounding box, rotation, and style for every shape kind', () => {
    for (const shape of ALL_SHAPES) {
      const layer = makeLayer({
        shape,
        id: `id-${shape}`,
        x: 100,
        y: 80,
        width: 200,
        height: 120,
        rotation: Math.PI / 6,
        strokeColor: '#abcdef',
        strokeWidth: 4,
        fillColor: shape === 'star' ? '#ff0000' : null,
      })
      const obj = shapeLayerToFabricObject(layer)
      const back = fabricObjectToShapeLayer(obj)

      expect(back.shape).toBe(shape)
      expect(back.id).toBe(`id-${shape}`)
      expect(back.x).toBeCloseTo(layer.x, 4)
      expect(back.y).toBeCloseTo(layer.y, 4)
      expect(back.width).toBeCloseTo(layer.width, 4)
      expect(back.height).toBeCloseTo(layer.height, 4)
      expect(back.rotation).toBeCloseTo(layer.rotation, 6)
      expect(back.strokeColor).toBe('#abcdef')
      expect(back.strokeWidth).toBe(4)
      expect(back.fillColor).toBe(shape === 'star' ? '#ff0000' : null)
    }
  })

  it('reflects a Fabric resize (scale) back into the layer dimensions', () => {
    const layer = makeLayer({ shape: 'hexagon', width: 100, height: 100 })
    const obj = shapeLayerToFabricObject(layer)
    // Simulate the user dragging a resize handle to 1.5x / 2x.
    obj.set({ scaleX: 1.5, scaleY: 2 })
    const back = fabricObjectToShapeLayer(obj)
    expect(back.width).toBeCloseTo(150, 4)
    expect(back.height).toBeCloseTo(200, 4)
  })

  it('computeShapePoints returns polygon points only for polygonal shapes', () => {
    expect(computeShapePoints('rectangle', 100, 100)).toBeNull()
    expect(computeShapePoints('circle', 100, 100)).toBeNull()
    expect(computeShapePoints('heart', 100, 100)).toBeNull()
    expect(computeShapePoints('triangle', 100, 100)).toHaveLength(3)
    expect(computeShapePoints('diamond', 100, 100)).toHaveLength(4)
    expect(computeShapePoints('star', 100, 100)).toHaveLength(10)
    expect(computeShapePoints('octagon', 100, 100)).toHaveLength(8)
  })
})

describe('polygon (any number of sides)', () => {
  it.each([3, 4, 5, 7, 8, 1000])('builds a %i-sided polygon that exactly fills its box', (n) => {
    const pts = computeShapePoints('polygon', 200, 100, n)!
    expect(pts).toHaveLength(n)
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    expect(Math.min(...xs)).toBeCloseTo(0)
    expect(Math.max(...xs)).toBeCloseTo(200)
    expect(Math.min(...ys)).toBeCloseTo(0)
    expect(Math.max(...ys)).toBeCloseTo(100)
  })

  it.each([3, 4, 5, 6, 9, 12])('a %i-sided polygon sits on a flat base', (n) => {
    const pts = computeShapePoints('polygon', 200, 100, n)!
    expect(pts.filter((p) => Math.abs(p.y - 100) < 1e-9)).toHaveLength(2)
  })

  it('3 sides is the classic triangle and 4 sides is the box rectangle', () => {
    const sortPts = (ps: { x: number; y: number }[]) =>
      ps.map((p) => [Math.round(p.x * 1e6) / 1e6, Math.round(p.y * 1e6) / 1e6]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
    expect(sortPts(computeShapePoints('polygon', 200, 100, 3)!)).toEqual(sortPts(computeShapePoints('triangle', 200, 100)!))
    expect(sortPts(computeShapePoints('polygon', 200, 100, 4)!)).toEqual([[0, 0], [0, 100], [200, 0], [200, 100]])
  })

  it('clampSides rounds and clamps to 3..1000, NaN → default', () => {
    expect(clampSides(2)).toBe(3)
    expect(clampSides(1001)).toBe(1000)
    expect(clampSides(4.6)).toBe(5)
    expect(clampSides(NaN)).toBe(3)
    expect(regularPolygonPoints(0, 10, 10)).toHaveLength(3)
  })

  it('round-trips the side count through Fabric', () => {
    const layer = makeLayer({ shape: 'polygon', sides: 11 })
    const obj = shapeLayerToFabricObject(layer)
    expect((obj as any).points).toHaveLength(11)
    const back = fabricObjectToShapeLayer(obj)
    expect(back.shape).toBe('polygon')
    expect(back.sides).toBe(11)
    expect(back.width).toBeCloseTo(layer.width)
    expect(back.height).toBeCloseTo(layer.height)
  })

  it('non-polygon shapes carry no sides', () => {
    expect(fabricObjectToShapeLayer(shapeLayerToFabricObject(makeLayer({ shape: 'hexagon' }))).sides).toBeUndefined()
  })

  it('legacy hexagon geometry is unchanged (old comics keep their orientation)', () => {
    const pts = computeShapePoints('hexagon', 200, 100)!
    expect(pts[0]).toEqual({ x: 200, y: 50 })
  })
})
