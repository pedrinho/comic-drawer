import { describe, it, expect, vi } from 'vitest'
import * as fabric from 'fabric'
import { createToolController, ToolContext } from './toolControllers'
import { shapeLayerToFabricObject } from './fabricShapes'
import { buildRasterImage } from './fabricRaster'
import { Mode } from '../types/common'

/**
 * Unit tests for the per-tool pointer controllers (Phase 3 of the Canvas refactor).
 *
 * Fabric's pointer pipeline can't be driven faithfully in jsdom, so we call the controller methods
 * directly with a stubbed `getPoint` (the one bit that reads a real DOM event), on a real
 * `fabric.Canvas`, and assert the canvas + service-callback effects.
 */

const makeCtx = (over: Partial<ToolContext> = {}): ToolContext => {
  const { image, backing } = buildRasterImage(null)
  return {
    canvas: new fabric.Canvas(document.createElement('canvas'), { width: 1200, height: 800 }),
    scale: 1,
    shape: 'rectangle',
    balloonKind: 'speech',
    color: '#123456',
    font: 'Arial',
    fontSize: 20,
    placeEmoji: null,
    rasterImage: image,
    rasterBacking: backing,
    syncToLayers: vi.fn(),
    applyObjectControls: vi.fn(),
    showSizeLabel: vi.fn(),
    hideSizeLabel: vi.fn(),
    commitRaster: vi.fn(),
    getPoint: (opt: any) => opt.pt ?? { x: 0, y: 0 },
    onToolChange: vi.fn(),
    ...over,
  }
}

describe('createToolController', () => {
  it('returns null for modes with no bespoke pointer behaviour', () => {
    const ctx = makeCtx()
    expect(createToolController('select', ctx)).toBeNull()
    expect(createToolController('pen', ctx)).toBeNull()
    expect(createToolController(null, ctx)).toBeNull()
  })

  it('returns a pointer controller for each interactive mode', () => {
    const ctx = makeCtx()
    for (const mode of ['shape', 'balloon', 'text', 'fill', 'eraser', 'scissor'] as Mode[]) {
      const c = createToolController(mode, ctx)
      expect(c, mode ?? 'null').not.toBeNull()
      expect(typeof c?.onDown).toBe('function')
    }
  })
})

describe('dragCreateController (shape)', () => {
  it('onDown seeds a shape; onMove scales it; onUp on a large drag activates + syncs', () => {
    const ctx = makeCtx()
    const c = createToolController('shape', ctx)!
    c.onDown!({ pt: { x: 100, y: 100 } })
    expect(ctx.applyObjectControls).toHaveBeenCalledTimes(1)
    expect(ctx.canvas.getObjects().length).toBe(1)

    c.onMove!({ pt: { x: 250, y: 240 } })
    expect(ctx.showSizeLabel).toHaveBeenCalled()

    c.onUp!()
    expect(ctx.syncToLayers).toHaveBeenCalledWith(false)
    expect(ctx.canvas.getActiveObject()).toBe(ctx.canvas.getObjects()[0])
    expect(ctx.canvas.getObjects().length).toBe(1)
  })

  it('onUp discards a too-small drag without syncing', () => {
    const ctx = makeCtx()
    const c = createToolController('shape', ctx)!
    c.onDown!({ pt: { x: 100, y: 100 } }) // seeded at 0.001 scale, never grown
    c.onUp!()
    expect(ctx.canvas.getObjects().length).toBe(0)
    expect(ctx.syncToLayers).not.toHaveBeenCalled()
  })

  it('onDown over an existing object is a no-op (Fabric handles select/move)', () => {
    const ctx = makeCtx()
    const c = createToolController('shape', ctx)!
    c.onDown!({ pt: { x: 100, y: 100 }, target: {} })
    expect(ctx.canvas.getObjects().length).toBe(0)
    expect(ctx.applyObjectControls).not.toHaveBeenCalled()
  })
})

describe('fillController', () => {
  it('colours a clicked shape target by its own fill and syncs', () => {
    const ctx = makeCtx({ color: '#ff0000' })
    const c = createToolController('fill', ctx)!
    const shapeObj = shapeLayerToFabricObject({
      type: 'shape', id: 's1', shape: 'rectangle', x: 10, y: 10, width: 50, height: 50,
      rotation: 0, strokeColor: '#000000', strokeWidth: 2, fillColor: null,
    })
    c.onDown!({ pt: { x: 20, y: 20 }, target: shapeObj })
    expect(shapeObj.fill).toBe('#ff0000')
    expect(ctx.syncToLayers).toHaveBeenCalledWith(false)
  })
})

describe('textController', () => {
  it('places an emoji glyph and syncs without entering editing', () => {
    const ctx = makeCtx({ placeEmoji: '😀' })
    const c = createToolController('text', ctx)!
    c.onDown!({ pt: { x: 40, y: 40 } })
    expect(ctx.canvas.getObjects().length).toBe(1)
    expect(ctx.canvas.getObjects()[0]).toBeInstanceOf(fabric.IText)
    expect(ctx.syncToLayers).toHaveBeenCalledWith(false)
  })
})
