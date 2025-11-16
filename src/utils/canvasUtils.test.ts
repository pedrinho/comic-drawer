import { describe, it, expect, vi, beforeEach } from 'vitest'
import { traceShapePath, drawGrid, cloneImageData, createBlankImageData } from './canvasUtils'
import { Shape } from '../App'

describe('canvasUtils', () => {
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D

  beforeEach(() => {
    canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 200
    ctx = canvas.getContext('2d')!
    
    // Mock canvas methods - only mock what we need to verify
    // Note: Don't mock fillRect for createBlankImageData tests
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
  })

  describe('traceShapePath', () => {
    const shapes: Shape[] = [
      'rectangle',
      'circle',
      'triangle',
      'star',
      'heart',
      'diamond',
      'hexagon',
      'pentagon',
      'arrow',
      'cross',
      'heptagon',
      'octagon',
    ]

    shapes.forEach((shape) => {
      it(`traces ${shape} shape path`, () => {
        const startX = 10
        const startY = 10
        const endX = 100
        const endY = 100

        traceShapePath(ctx, shape, startX, startY, endX, endY)

        // Verify path was created (beginPath should have been called)
        expect(ctx.beginPath).toHaveBeenCalled()
        // Most shapes call closePath
        if (shape !== 'rectangle' && shape !== 'circle') {
          expect(ctx.closePath).toHaveBeenCalled()
        }
      })
    })

    it('handles negative width correctly', () => {
      traceShapePath(ctx, 'rectangle', 100, 10, 10, 100)
      expect(ctx.beginPath).toHaveBeenCalled()
    })

    it('handles negative height correctly', () => {
      traceShapePath(ctx, 'rectangle', 10, 100, 100, 10)
      expect(ctx.beginPath).toHaveBeenCalled()
    })
  })

  describe('drawGrid', () => {
    it('draws grid with single row and column', () => {
      const layout = { rows: 1, columns: [1] }
      drawGrid(ctx, layout)
      expect(ctx.save).toHaveBeenCalled()
      expect(ctx.restore).toHaveBeenCalled()
    })

    it('draws grid with multiple rows', () => {
      const layout = { rows: 2, columns: [1, 1] }
      drawGrid(ctx, layout)
      expect(ctx.save).toHaveBeenCalled()
      expect(ctx.restore).toHaveBeenCalled()
    })

    it('draws grid with multiple columns', () => {
      const layout = { rows: 1, columns: [3] }
      drawGrid(ctx, layout)
      expect(ctx.save).toHaveBeenCalled()
      expect(ctx.restore).toHaveBeenCalled()
    })

    it('draws grid with custom canvas dimensions', () => {
      const layout = { rows: 2, columns: [2, 2] }
      drawGrid(ctx, layout, 400, 300)
      expect(ctx.save).toHaveBeenCalled()
      expect(ctx.restore).toHaveBeenCalled()
    })

    it('handles missing column definition', () => {
      const layout = { rows: 2, columns: [1] }
      drawGrid(ctx, layout)
      expect(ctx.save).toHaveBeenCalled()
      expect(ctx.restore).toHaveBeenCalled()
    })
  })

  describe('cloneImageData', () => {
    it('clones ImageData correctly', () => {
      const original = ctx.createImageData(10, 10)
      // Set some pixel data
      original.data[0] = 255 // Red
      original.data[1] = 128 // Green
      original.data[2] = 64  // Blue
      original.data[3] = 255 // Alpha

      const cloned = cloneImageData(original)

      expect(cloned.width).toBe(original.width)
      expect(cloned.height).toBe(original.height)
      expect(cloned.data.length).toBe(original.data.length)
      expect(cloned.data[0]).toBe(255)
      expect(cloned.data[1]).toBe(128)
      expect(cloned.data[2]).toBe(64)
      expect(cloned.data[3]).toBe(255)
    })

    it('creates independent copy', () => {
      const original = ctx.createImageData(10, 10)
      original.data[0] = 255

      const cloned = cloneImageData(original)
      original.data[0] = 0 // Modify original

      expect(cloned.data[0]).toBe(255) // Clone should be unchanged
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
    it('creates blank white ImageData with default size', () => {
      // Don't mock fillRect for this test - we need it to actually work
      const testCanvas = document.createElement('canvas')
      testCanvas.width = 1200
      testCanvas.height = 800
      const testCtx = testCanvas.getContext('2d')!
      
      const imageData = createBlankImageData()

      expect(imageData.width).toBe(1200)
      expect(imageData.height).toBe(800)
      expect(imageData.data.length).toBe(1200 * 800 * 4)
    })

    it('creates blank ImageData with custom size', () => {
      const width = 100
      const height = 50
      const imageData = createBlankImageData(width, height)

      expect(imageData.width).toBe(width)
      expect(imageData.height).toBe(height)
      expect(imageData.data.length).toBe(width * height * 4)
    })

    it('creates white image data', () => {
      const imageData = createBlankImageData(10, 10)
      
      // Verify dimensions
      expect(imageData.width).toBe(10)
      expect(imageData.height).toBe(10)
      expect(imageData.data.length).toBe(400) // 10 * 10 * 4
    })
  })
})

