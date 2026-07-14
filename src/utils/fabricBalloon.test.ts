import { describe, it, expect } from 'vitest'
import * as fabric from 'fabric'
import { BalloonObjectLayer } from '../types/layers'
import {
  balloonLayerToFabricObject,
  fabricBalloonToLayer,
  isFabricBalloon,
  BALLOON_ID_KEY,
  BALLOON_KIND_KEY,
  BALLOON_KINDS,
} from './fabricBalloon'

const makeLayer = (overrides: Partial<BalloonObjectLayer> = {}): BalloonObjectLayer => ({
  type: 'balloon',
  id: 'balloon-1',
  kind: 'speech',
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
  it('builds a fabric.Path bubble tagged with id + kind', () => {
    const obj = balloonLayerToFabricObject(makeLayer())
    expect(obj).toBeInstanceOf(fabric.Path)
    expect((obj as any)[BALLOON_ID_KEY]).toBe('balloon-1')
    expect((obj as any)[BALLOON_KIND_KEY]).toBe('speech')
    expect(obj.stroke).toBe('#111111')
    expect(obj.fill).toBe('white')
    expect(isFabricBalloon(obj)).toBe(true)
    expect(isFabricBalloon(new fabric.Rect())).toBe(false)
  })

  it('exposes a kind registry so the tool can expand to more types', () => {
    expect(BALLOON_KINDS.speech).toBeDefined()
    expect(typeof BALLOON_KINDS.speech.pathData(100, 100)).toBe('string')
    // The generated outline is a closed path (ends with Z).
    expect(BALLOON_KINDS.speech.pathData(100, 100).trim().endsWith('Z')).toBe(true)
  })

  it('round-trips id, kind, bbox and caption fields (no transform)', () => {
    const layer = makeLayer()
    const back = fabricBalloonToLayer(balloonLayerToFabricObject(layer))
    expect(back.id).toBe(layer.id)
    expect(back.kind).toBe('speech')
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
    const obj = balloonLayerToFabricObject(layer)
    obj.set({ left: (obj.left ?? 0) + 40, top: (obj.top ?? 0) - 25 })
    obj.setCoords()
    const back = fabricBalloonToLayer(obj)
    expect(back.x).toBeCloseTo(layer.x + 40, 2)
    expect(back.y).toBeCloseTo(layer.y - 25, 2)
  })

  it('reflects a resize (scale) back into the layer dimensions', () => {
    const layer = makeLayer({ width: 100, height: 80 })
    const obj = balloonLayerToFabricObject(layer)
    obj.set({ scaleX: 2, scaleY: 1.5 })
    obj.setCoords()
    const back = fabricBalloonToLayer(obj)
    expect(back.width).toBeCloseTo(200, 1)
    expect(back.height).toBeCloseTo(120, 1)
  })
})
