import { describe, it, expect } from 'vitest'
import { Shape } from '../types/common'
import { ShapeObjectLayer } from '../types/layers'
import {
  shapeLayerToFabricObject,
  fabricObjectToShapeLayer,
  computeShapePoints,
  SHAPE_ID_KEY,
  SHAPE_KIND_KEY,
} from './fabricShapes'

const ALL_SHAPES: Shape[] = [
  'rectangle', 'circle', 'triangle', 'star', 'heart', 'diamond',
  'hexagon', 'pentagon', 'arrow', 'cross', 'heptagon', 'octagon',
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
