import { describe, it, expect } from 'vitest'
import * as fabric from 'fabric'
import {
  computeGridCells,
  buildGridObjects,
  buildRasterImage,
  backingToImageData,
  isChromeObject,
  RASTER_KEY,
  GRID_KEY,
} from './fabricRaster'

describe('fabricRaster', () => {
  it('computeGridCells returns one cell per column across all rows', () => {
    expect(computeGridCells({ rows: 1, columns: [1] })).toHaveLength(1)
    expect(computeGridCells({ rows: 2, columns: [2, 3] })).toHaveLength(5)
    // Cells stay within the canvas bounds.
    for (const c of computeGridCells({ rows: 2, columns: [2, 3] })) {
      expect(c.x).toBeGreaterThanOrEqual(0)
      expect(c.y).toBeGreaterThanOrEqual(0)
      expect(c.x + c.w).toBeLessThanOrEqual(1200 + 0.001)
      expect(c.y + c.h).toBeLessThanOrEqual(800 + 0.001)
    }
  })

  it('buildGridObjects makes non-interactive grid rects tagged as chrome', () => {
    const objs = buildGridObjects({ rows: 2, columns: [1, 2] })
    expect(objs).toHaveLength(3)
    for (const o of objs) {
      expect(o).toBeInstanceOf(fabric.Rect)
      expect(o.selectable).toBe(false)
      expect(o.evented).toBe(false)
      expect((o as any)[GRID_KEY]).toBe(true)
      expect(isChromeObject(o)).toBe(true)
    }
  })

  it('buildRasterImage returns a 1200x800 backing canvas and a chrome image', () => {
    const { image, backing } = buildRasterImage(null)
    expect(backing.width).toBe(1200)
    expect(backing.height).toBe(800)
    expect(image).toBeInstanceOf(fabric.FabricImage)
    expect(image.selectable).toBe(false)
    expect(image.evented).toBe(false)
    expect((image as any)[RASTER_KEY]).toBe(true)
    expect(isChromeObject(image)).toBe(true)
  })

  it('backingToImageData reads the backing pixels back out', () => {
    const { backing } = buildRasterImage(null)
    const out = backingToImageData(backing)
    expect(out.width).toBe(1200)
    expect(out.height).toBe(800)
  })

  it('isChromeObject is false for a plain object', () => {
    expect(isChromeObject(new fabric.Rect({ width: 10, height: 10 }))).toBe(false)
  })
})
