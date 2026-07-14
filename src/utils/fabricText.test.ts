import { describe, it, expect } from 'vitest'
import { TextObjectLayer } from '../types/layers'
import { textLayerToFabricIText, fabricITextToTextLayer, TEXT_ID_KEY } from './fabricText'

const makeLayer = (overrides: Partial<TextObjectLayer> = {}): TextObjectLayer => ({
  type: 'text',
  id: 'text-1',
  text: 'Hello',
  x: 120,
  y: 90,
  width: 80,
  height: 24,
  rotation: 0,
  font: 'Arial',
  fontSize: 24,
  color: '#334455',
  ...overrides,
})

describe('fabricText conversion', () => {
  it('creates a fabric.IText carrying id + text and round-trips content/rotation/style', () => {
    const layer = makeLayer({ rotation: Math.PI / 4, text: 'Comic!' })
    const obj = textLayerToFabricIText(layer, 1)
    expect((obj as any)[TEXT_ID_KEY]).toBe('text-1')
    expect(obj.text).toBe('Comic!')

    const back = fabricITextToTextLayer(obj, 1)
    expect(back.type).toBe('text')
    expect(back.id).toBe('text-1')
    expect(back.text).toBe('Comic!')
    expect(back.rotation).toBeCloseTo(Math.PI / 4, 6)
    expect(back.font).toBe('Arial')
    expect(back.color).toBe('#334455')
    expect(back.fontSize).toBeCloseTo(24, 4)
  })

  it('applies the display scale to fontSize both ways (constant on-screen size)', () => {
    const layer = makeLayer({ fontSize: 24 })
    // At scale 0.5, the on-canvas font is larger (24 / 0.5 = 48 internal units)...
    const obj = textLayerToFabricIText(layer, 0.5)
    expect(obj.fontSize).toBeCloseTo(48, 4)
    // ...and converting back with the same scale recovers the CSS size.
    const back = fabricITextToTextLayer(obj, 0.5)
    expect(back.fontSize).toBeCloseTo(24, 4)
  })

  it('falls back to scale 1 when the display scale is 0 (no Infinity font)', () => {
    // Regression: during PDF export / off-screen render the container measures 0, so scale
    // arrives as 0. `fontSize / 0` would be Infinity; the `scale || 1` guard must keep it finite.
    const layer = makeLayer({ fontSize: 24 })
    const obj = textLayerToFabricIText(layer, 0)
    expect(obj.fontSize).toBe(24)
    expect(Number.isFinite(obj.fontSize)).toBe(true)
  })

  it('folds a Fabric resize (scaleY) back into fontSize', () => {
    const layer = makeLayer({ fontSize: 20 })
    const obj = textLayerToFabricIText(layer, 1)
    obj.set({ scaleX: 2, scaleY: 2 })
    const back = fabricITextToTextLayer(obj, 1)
    expect(back.fontSize).toBeCloseTo(40, 4)
  })
})
