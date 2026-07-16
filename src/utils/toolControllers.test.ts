import { describe, it, expect, vi } from 'vitest'
import * as fabric from 'fabric'
import { createToolController, findEraserConvertible, ToolContext } from './toolControllers'
import { shapeLayerToFabricObject } from './fabricShapes'
import { balloonLayerToFabricObject } from './fabricBalloon'
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

describe('eraserController', () => {
  it('commits the raster once per stroke on release (one history entry)', () => {
    const ctx = makeCtx()
    const c = createToolController('eraser', ctx)!
    c.onDown!({ pt: { x: 100, y: 100 } })
    c.onMove!({ pt: { x: 200, y: 100 } })
    c.onMove!({ pt: { x: 300, y: 100 } })
    expect(ctx.commitRaster).not.toHaveBeenCalled() // not mid-stroke
    c.onUp!()
    expect(ctx.commitRaster).toHaveBeenCalledTimes(1)
  })

  it('onUp without a prior onDown does nothing', () => {
    const ctx = makeCtx()
    const c = createToolController('eraser', ctx)!
    c.onUp!()
    expect(ctx.commitRaster).not.toHaveBeenCalled()
  })

  it('a pure raster erase (no shape touched) commits once and does NOT sync layers', () => {
    const ctx = makeCtx()
    const c = createToolController('eraser', ctx)!
    c.onDown!({ pt: { x: 100, y: 100 } })
    c.onMove!({ pt: { x: 200, y: 100 } })
    c.onUp!()
    expect(ctx.commitRaster).toHaveBeenCalledTimes(1)
    expect(ctx.syncToLayers).not.toHaveBeenCalled()
  })

  it('bakes a touched vector shape into the raster, removes it, and syncs once on release', () => {
    const ctx = makeCtx()
    const shapeObj = shapeLayerToFabricObject({
      type: 'shape', id: 's1', shape: 'triangle', x: 100, y: 100, width: 100, height: 100,
      rotation: 0, strokeColor: '#000000', strokeWidth: 2, fillColor: null,
    })
    ctx.canvas.add(shapeObj)
    const c = createToolController('eraser', ctx)!
    c.onDown!({ pt: { x: 150, y: 150 } }) // inside the triangle's bbox
    c.onMove!({ pt: { x: 160, y: 150 } }) // rubs onto it → convert
    expect(ctx.canvas.getObjects()).not.toContain(shapeObj) // stamped to raster + removed from overlay
    c.onUp!()
    expect(ctx.commitRaster).toHaveBeenCalledTimes(1) // one history entry for the whole gesture
    expect(ctx.syncToLayers).toHaveBeenCalledWith(true) // skipHistory: model reconciled without a 2nd entry
  })
})

describe('findEraserConvertible', () => {
  const { image } = buildRasterImage(null)
  const mkShape = (over: Record<string, unknown> = {}) =>
    shapeLayerToFabricObject({
      type: 'shape', id: 's', shape: 'rectangle', x: 100, y: 100, width: 80, height: 80,
      rotation: 0, strokeColor: '#000000', strokeWidth: 2, fillColor: null, ...over,
    })

  it('returns a shape whose inflated bbox contains the point', () => {
    const s = mkShape()
    expect(findEraserConvertible([s], { x: 140, y: 140 }, 10, image)).toBe(s)
  })

  it('returns null when the point is well outside every object', () => {
    const s = mkShape()
    expect(findEraserConvertible([s], { x: 600, y: 600 }, 10, image)).toBeNull()
  })

  it('honours the pad tolerance just outside the bbox', () => {
    const s = mkShape() // bbox right edge ≈ 182 (x 100 + width 80 + stroke)
    expect(findEraserConvertible([s], { x: 188, y: 140 }, 10, image)).toBe(s) // within pad
    expect(findEraserConvertible([s], { x: 188, y: 140 }, 2, image)).toBeNull() // outside a small pad
  })

  it('excludes the raster substrate, text, and balloons', () => {
    const text = new fabric.IText('hi', { left: 100, top: 100 })
    const balloon = balloonLayerToFabricObject({
      type: 'balloon', id: 'b', kind: 'speech', x: 100, y: 100, width: 80, height: 80,
      rotation: 0, text: '', font: 'Arial', fontSize: 20, color: '#000000',
    })
    expect(findEraserConvertible([image, text, balloon], { x: 140, y: 140 }, 10, image)).toBeNull()
  })

  it('returns the top-most (last-drawn) matching object', () => {
    const under = mkShape()
    const over = mkShape()
    expect(findEraserConvertible([under, over], { x: 140, y: 140 }, 10, image)).toBe(over)
  })
})

describe('scissorController', () => {
  it('adds a marquee rect on down and lifts the cut into an image, then switches to select', () => {
    const ctx = makeCtx()
    const c = createToolController('scissor', ctx)!
    c.onDown!({ pt: { x: 100, y: 100 } })
    expect(ctx.canvas.getObjects().length).toBe(1) // the marquee rect
    c.onMove!({ pt: { x: 340, y: 260 } })
    c.onUp!()
    // Marquee removed; a Fabric image (the cut-out) added in its place.
    expect(ctx.canvas.getObjects().some((o) => o instanceof fabric.FabricImage)).toBe(true)
    expect(ctx.commitRaster).toHaveBeenCalled()
    expect(ctx.syncToLayers).toHaveBeenCalledWith(true)
    expect(ctx.onToolChange).toHaveBeenCalledWith('select')
  })

  it('discards a too-small cut without switching tools', () => {
    const ctx = makeCtx()
    const c = createToolController('scissor', ctx)!
    c.onDown!({ pt: { x: 100, y: 100 } })
    c.onMove!({ pt: { x: 102, y: 102 } }) // < 5px → discarded
    c.onUp!()
    expect(ctx.onToolChange).not.toHaveBeenCalled()
    expect(ctx.canvas.getObjects().some((o) => o instanceof fabric.FabricImage)).toBe(false)
  })
})
