import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  traceShapePath,
  drawGrid,
  cloneImageData,
  createBlankImageData,
  simplifyPath,
  isPointNearPolyline,
  makeWhiteTransparent,
} from './canvasUtils'
import { Shape } from '../types/common'

describe('canvasUtils', () => {
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D

  beforeEach(() => {
    canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 200
    ctx = canvas.getContext('2d')!

    vi.spyOn(ctx, 'beginPath')
    vi.spyOn(ctx, 'save')
    vi.spyOn(ctx, 'restore')
    vi.spyOn(ctx, 'rect')
    vi.spyOn(ctx, 'ellipse')
    vi.spyOn(ctx, 'moveTo')
    vi.spyOn(ctx, 'lineTo')
    vi.spyOn(ctx, 'closePath')
    vi.spyOn(ctx, 'arc')
    vi.spyOn(ctx, 'stroke')
    vi.spyOn(ctx, 'bezierCurveTo')
  })

  describe('traceShapePath', () => {
    // Each polygonal shape must emit exactly the right number of vertices: one moveTo for the
    // first vertex, then (N-1) lineTo for the rest. Asserting the counts catches a shape that
    // degenerates (e.g. a star traced as a dot) — which the old "was beginPath called" test
    // could not. rectangle/circle use dedicated primitives instead of a vertex list.
    const vertexShapes: Array<{ shape: Shape; lineTos: number }> = [
      { shape: 'triangle', lineTos: 2 },
      { shape: 'diamond', lineTos: 3 },
      { shape: 'pentagon', lineTos: 4 },
      { shape: 'arrow', lineTos: 5 },
      { shape: 'hexagon', lineTos: 5 },
      { shape: 'heptagon', lineTos: 6 },
      { shape: 'octagon', lineTos: 7 },
      { shape: 'star', lineTos: 9 },
      { shape: 'cross', lineTos: 12 },
    ]

    vertexShapes.forEach(({ shape, lineTos }) => {
      it(`traces ${shape} with ${lineTos + 1} vertices and closes the path`, () => {
        traceShapePath(ctx, shape, 10, 10, 100, 100)
        expect(ctx.beginPath).toHaveBeenCalledTimes(1)
        expect(ctx.moveTo).toHaveBeenCalledTimes(1)
        expect(ctx.lineTo).toHaveBeenCalledTimes(lineTos)
        expect(ctx.closePath).toHaveBeenCalledTimes(1)
      })
    })

    it('traces a rectangle as a single rect() with the drag bounds, no vertices', () => {
      traceShapePath(ctx, 'rectangle', 10, 20, 110, 220)
      expect(ctx.rect).toHaveBeenCalledWith(10, 20, 100, 200)
      expect(ctx.lineTo).not.toHaveBeenCalled()
      expect(ctx.closePath).not.toHaveBeenCalled()
    })

    it('traces a circle as a single ellipse() centered in the bounds', () => {
      traceShapePath(ctx, 'circle', 10, 10, 110, 110)
      expect(ctx.ellipse).toHaveBeenCalledTimes(1)
      // center (60,60), radius = min(50,50) = 50
      expect(ctx.ellipse).toHaveBeenCalledWith(60, 60, 50, 50, 0, 0, 2 * Math.PI)
      expect(ctx.lineTo).not.toHaveBeenCalled()
    })

    it('traces a heart as bezier curves, not straight segments', () => {
      traceShapePath(ctx, 'heart', 10, 10, 100, 100)
      expect(ctx.bezierCurveTo).toHaveBeenCalledTimes(6)
      expect(ctx.lineTo).not.toHaveBeenCalled()
      expect(ctx.closePath).toHaveBeenCalledTimes(1)
    })

    it('puts the triangle apex at the top-center of the drag bounds', () => {
      traceShapePath(ctx, 'triangle', 10, 10, 100, 100)
      // apex is (centerX, startY) = (55, 10); base corners at (10,100) and (100,100)
      expect(ctx.moveTo).toHaveBeenCalledWith(55, 10)
      expect(ctx.lineTo).toHaveBeenNthCalledWith(1, 10, 100)
      expect(ctx.lineTo).toHaveBeenNthCalledWith(2, 100, 100)
    })

    it('traces the same vertex count regardless of drag direction (negative width/height)', () => {
      traceShapePath(ctx, 'pentagon', 100, 100, 10, 10)
      expect(ctx.moveTo).toHaveBeenCalledTimes(1)
      expect(ctx.lineTo).toHaveBeenCalledTimes(4)
    })
  })

  describe('drawGrid', () => {
    it('strokes exactly one rect per cell across all rows', () => {
      // rows:2, columns:[3,1] -> 4 cells total
      drawGrid(ctx, { rows: 2, columns: [3, 1] })
      expect(ctx.rect).toHaveBeenCalledTimes(4)
      expect(ctx.stroke).toHaveBeenCalledTimes(4)
      expect(ctx.save).toHaveBeenCalledTimes(1)
      expect(ctx.restore).toHaveBeenCalledTimes(1)
    })

    it('draws a single full-bleed cell (minus gutter) for a 1x1 layout', () => {
      drawGrid(ctx, { rows: 1, columns: [1] }, 1200, 800)
      // gutter = 12 on each side
      expect(ctx.rect).toHaveBeenCalledTimes(1)
      expect(ctx.rect).toHaveBeenCalledWith(12, 12, 1200 - 24, 800 - 24)
    })

    it('splits width evenly across columns (accounting for gutters)', () => {
      drawGrid(ctx, { rows: 1, columns: [2] }, 1200, 800)
      expect(ctx.rect).toHaveBeenCalledTimes(2)
      // gutter=12, one inner gutter: panelWidth = (1200 - 36) / 2 = 582
      const firstCall = (ctx.rect as any).mock.calls[0]
      expect(firstCall[2]).toBeCloseTo(582, 5) // width
    })

    it('treats a missing column entry as a single column', () => {
      drawGrid(ctx, { rows: 2, columns: [1] }) // row 1 has no entry -> defaults to 1
      expect(ctx.rect).toHaveBeenCalledTimes(2)
    })
  })

  describe('cloneImageData', () => {
    it('clones ImageData correctly', () => {
      const original = ctx.createImageData(10, 10)
      original.data[0] = 255
      original.data[1] = 128
      original.data[2] = 64
      original.data[3] = 255

      const cloned = cloneImageData(original)

      expect(cloned.width).toBe(original.width)
      expect(cloned.height).toBe(original.height)
      expect(cloned.data.length).toBe(original.data.length)
      expect(cloned.data[0]).toBe(255)
      expect(cloned.data[1]).toBe(128)
      expect(cloned.data[2]).toBe(64)
      expect(cloned.data[3]).toBe(255)
    })

    it('creates an independent copy (mutating the original does not affect the clone)', () => {
      const original = ctx.createImageData(10, 10)
      original.data[0] = 255

      const cloned = cloneImageData(original)
      original.data[0] = 0

      expect(cloned.data[0]).toBe(255)
    })

    it('handles different sizes', () => {
      const sizes = [
        { width: 1, height: 1 },
        { width: 100, height: 100 },
        { width: 1200, height: 800 },
      ]
      sizes.forEach(({ width, height }) => {
        const original = ctx.createImageData(width, height)
        const cloned = cloneImageData(original)
        expect(cloned.width).toBe(width)
        expect(cloned.height).toBe(height)
      })
    })
  })

  describe('createBlankImageData', () => {
    it('creates ImageData of the default 1200x800 size', () => {
      const imageData = createBlankImageData()
      expect(imageData.width).toBe(1200)
      expect(imageData.height).toBe(800)
      expect(imageData.data.length).toBe(1200 * 800 * 4)
    })

    it('creates ImageData of a custom size', () => {
      const imageData = createBlankImageData(100, 50)
      expect(imageData.width).toBe(100)
      expect(imageData.height).toBe(50)
      expect(imageData.data.length).toBe(100 * 50 * 4)
    })
  })

  describe('simplifyPath (Ramer-Douglas-Peucker)', () => {
    it('returns the input unchanged when there are 2 or fewer points', () => {
      const pts = [{ x: 0, y: 0 }, { x: 10, y: 10 }]
      expect(simplifyPath(pts, 1)).toEqual(pts)
    })

    it('drops points that are collinear within tolerance', () => {
      // Three collinear points: the middle one adds no shape and should be removed.
      const pts = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }]
      const simplified = simplifyPath(pts, 1)
      expect(simplified).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }])
    })

    it('keeps a corner that deviates beyond the tolerance', () => {
      // The middle point is 10px off the 0,0 -> 20,0 line: a real corner, must be kept.
      const pts = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }]
      const simplified = simplifyPath(pts, 1)
      expect(simplified).toHaveLength(3)
      expect(simplified).toContainEqual({ x: 10, y: 10 })
    })

    it('collapses a nearly-straight run to its endpoints', () => {
      const pts = [
        { x: 0, y: 0 },
        { x: 5, y: 0.1 },
        { x: 10, y: -0.1 },
        { x: 15, y: 0.05 },
        { x: 20, y: 0 },
      ]
      const simplified = simplifyPath(pts, 1)
      expect(simplified).toEqual([{ x: 0, y: 0 }, { x: 20, y: 0 }])
    })
  })

  describe('isPointNearPolyline', () => {
    const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }]

    it('returns true for a point within the threshold of a segment', () => {
      expect(isPointNearPolyline({ x: 50, y: 3 }, line, 5)).toBe(true)
    })

    it('returns false for a point beyond the threshold', () => {
      expect(isPointNearPolyline({ x: 50, y: 40 }, line, 5)).toBe(false)
    })

    it('measures distance to the nearest segment of a multi-segment polyline', () => {
      const poly = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]
      // near the vertical second segment
      expect(isPointNearPolyline({ x: 98, y: 50 }, poly, 5)).toBe(true)
      // in open space away from both segments
      expect(isPointNearPolyline({ x: 50, y: 50 }, poly, 5)).toBe(false)
    })
  })

  describe('makeWhiteTransparent', () => {
    const px = (r: number, g: number, b: number, a: number) =>
      new Uint8ClampedArray([r, g, b, a])

    const imageDataFrom = (data: Uint8ClampedArray): ImageData =>
      ({ data, width: 1, height: 1, colorSpace: 'srgb' } as ImageData)

    it('sets near-white pixels fully transparent', () => {
      const img = imageDataFrom(px(255, 255, 255, 255))
      makeWhiteTransparent(img)
      expect(img.data[3]).toBe(0)
    })

    it('leaves non-white pixels opaque', () => {
      const img = imageDataFrom(px(10, 20, 30, 255))
      makeWhiteTransparent(img)
      expect(img.data[3]).toBe(255)
    })

    it('respects a custom whiteness threshold', () => {
      // A pale-grey pixel (200) is "white" at threshold 150 but not at the default 250.
      const pale = imageDataFrom(px(200, 200, 200, 255))
      makeWhiteTransparent(pale, 150)
      expect(pale.data[3]).toBe(0)

      const paleDefault = imageDataFrom(px(200, 200, 200, 255))
      makeWhiteTransparent(paleDefault)
      expect(paleDefault.data[3]).toBe(255)
    })
  })
})
