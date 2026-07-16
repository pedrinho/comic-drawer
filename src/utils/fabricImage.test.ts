import { describe, it, expect } from 'vitest'
import * as fabric from 'fabric'
import {
  fabricImageToLayer,
  fabricObjectKind,
  fitPasteScale,
  IMAGE_ID_KEY,
  IMAGE_DATA_KEY,
} from './fabricImage'

// Note: imageLayerToFabricImage uses fabric.FabricImage.fromURL, which decodes the data URL
// in the browser — jsdom can't decode, so the async load path is verified manually in the
// browser. Here we cover the pure read-back + discrimination logic.

describe('fabricImage conversion', () => {
  it('reads a Fabric image back into an ImageObjectLayer using the intended box', () => {
    const fakeImage = {
      width: 100,
      height: 50,
      scaleX: 2,
      scaleY: 2,
      left: 200, // centered origin
      top: 100,
      angle: 0,
      [IMAGE_ID_KEY]: 'img-1',
      [IMAGE_DATA_KEY]: 'data:image/png;base64,AAAA',
    } as any

    const layer = fabricImageToLayer(fakeImage)
    expect(layer.type).toBe('image')
    expect(layer.id).toBe('img-1')
    expect(layer.data).toBe('data:image/png;base64,AAAA')
    expect(layer.width).toBeCloseTo(200, 4) // 100 * scaleX
    expect(layer.height).toBeCloseTo(100, 4) // 50 * scaleY
    expect(layer.x).toBeCloseTo(100, 4) // left - width/2
    expect(layer.y).toBeCloseTo(50, 4) // top - height/2
  })

  it('fits a pasted image to the canvas without upscaling', () => {
    // Small image: kept at natural size (never upscaled).
    expect(fitPasteScale(100, 80, 1200, 800)).toBe(1)
    // Wide image wider than 66% of the canvas: scaled down by the width constraint.
    expect(fitPasteScale(2400, 100, 1200, 800)).toBeCloseTo((1200 * 0.66) / 2400, 6)
    // Tall image: scaled down by the height constraint.
    expect(fitPasteScale(100, 1600, 1200, 800)).toBeCloseTo((800 * 0.66) / 1600, 6)
    // Zero/degenerate dimensions don't divide by zero.
    expect(fitPasteScale(0, 0, 1200, 800)).toBe(1)
  })

  it('discriminates object kinds for select-mode sync-back', () => {
    expect(fabricObjectKind(new fabric.IText('hi'))).toBe('text')
    expect(fabricObjectKind(new fabric.Rect({ width: 10, height: 10 }))).toBe('shape')
    expect(fabricObjectKind(new fabric.Polygon([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }]))).toBe('shape')
    expect(fabricObjectKind({ type: 'image', [IMAGE_ID_KEY]: 'x' } as any)).toBe('image')
  })
})
