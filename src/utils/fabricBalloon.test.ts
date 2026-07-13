import { describe, it, expect } from 'vitest'
import * as fabric from 'fabric'
import { BalloonObjectLayer } from '../types/layers'
import {
  balloonLayerToFabricObject,
  fabricBalloonToLayer,
  isFabricBalloon,
  BALLOON_ID_KEY,
} from './fabricBalloon'

const makeLayer = (overrides: Partial<BalloonObjectLayer> = {}): BalloonObjectLayer => ({
  type: 'balloon',
  id: 'balloon-1',
  x: 200,
  y: 150,
  width: 180,
  height: 120,
  rotation: 0,
  text: 'Hello!',
  font: 'Comic Sans MS',
  fontSize: 28,
  color: '#111111',
  ...overrides,
})

describe('fabricBalloon conversion', () => {
  it('builds a group (outline + caption) tagged as a balloon', () => {
    const group = balloonLayerToFabricObject(makeLayer(), 1)
    expect(group).toBeInstanceOf(fabric.Group)
    expect(group.getObjects().length).toBe(2)
    expect((group as any)[BALLOON_ID_KEY]).toBe('balloon-1')
    expect(isFabricBalloon(group)).toBe(true)
    expect(isFabricBalloon(new fabric.Rect())).toBe(false)
  })

  it('round-trips id, bbox and text (no transform)', () => {
    const layer = makeLayer()
    const back = fabricBalloonToLayer(balloonLayerToFabricObject(layer, 1))
    expect(back.id).toBe(layer.id)
    expect(back.text).toBe('Hello!')
    expect(back.font).toBe('Comic Sans MS')
    expect(back.fontSize).toBe(28)
    expect(back.color).toBe('#111111')
    expect(back.x).toBeCloseTo(layer.x, 2)
    expect(back.y).toBeCloseTo(layer.y, 2)
    expect(back.width).toBeCloseTo(layer.width, 2)
    expect(back.height).toBeCloseTo(layer.height, 2)
  })

  it('reflects a move back into the layer position', () => {
    const layer = makeLayer()
    const group = balloonLayerToFabricObject(layer, 1)
    group.set({ left: (group.left ?? 0) + 40, top: (group.top ?? 0) - 25 })
    group.setCoords()
    const back = fabricBalloonToLayer(group)
    expect(back.x).toBeCloseTo(layer.x + 40, 2)
    expect(back.y).toBeCloseTo(layer.y - 25, 2)
  })

  it('reflects a resize (scale) back into the layer dimensions', () => {
    const layer = makeLayer({ width: 100, height: 80 })
    const group = balloonLayerToFabricObject(layer, 1)
    group.set({ scaleX: 2, scaleY: 1.5 })
    group.setCoords()
    const back = fabricBalloonToLayer(group)
    expect(back.width).toBeCloseTo(200, 1)
    expect(back.height).toBeCloseTo(120, 1)
  })
})
