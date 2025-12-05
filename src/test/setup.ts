import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Store canvas sizes
const canvasSizes = new WeakMap<HTMLCanvasElement, { width: number; height: number }>()

// Mock getter/setter for width and height
Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
  get() {
    return canvasSizes.get(this)?.width ?? 1200
  },
  set(val) {
    const size = canvasSizes.get(this) || { width: 1200, height: 800 }
    size.width = Number(val)
    canvasSizes.set(this, size)
  },
  configurable: true,
})

Object.defineProperty(HTMLCanvasElement.prototype, 'height', {
  get() {
    return canvasSizes.get(this)?.height ?? 800
  },
  set(val) {
    const size = canvasSizes.get(this) || { width: 1200, height: 800 }
    size.height = Number(val)
    canvasSizes.set(this, size)
  },
  configurable: true,
})

// Mock HTMLCanvasElement for jsdom
HTMLCanvasElement.prototype.getContext = vi.fn(function (this: HTMLCanvasElement) {
  let storedData: Uint8ClampedArray | null = null;

  return {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn((_x, _y, w, h) => {
      if (storedData && storedData.length === 4 * w * h) {
        return {
          data: new Uint8ClampedArray(storedData),
          width: w,
          height: h,
        }
      }
      return {
        data: new Uint8ClampedArray(4 * w * h),
        width: w,
        height: h,
      }
    }),
    putImageData: vi.fn((imageData) => {
      storedData = new Uint8ClampedArray(imageData.data)
    }),
    createImageData: vi.fn((w, h) => {
      return {
        data: new Uint8ClampedArray(4 * w * h),
        width: w,
        height: h,
      }
    }),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    transform: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    setLineDash: vi.fn(),
    strokeRect: vi.fn(),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: '' as CanvasLineCap,
    lineJoin: '' as CanvasLineJoin,
    globalCompositeOperation: '' as GlobalCompositeOperation,
    isPointInPath: vi.fn(() => true), // Mock hit detection to always return true if needed, but we use manual bounds checking in Canvas.tsx
    canvas: this,
  }
}) as any

HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,')

// Mock getBoundingClientRect for Canvas to ensure correct coordinate calculations
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
  if (this instanceof HTMLCanvasElement) {
    return {
      width: 1200,
      height: 800,
      top: 0,
      left: 0,
      bottom: 800,
      right: 1200,
      x: 0,
      y: 0,
      toJSON: () => { },
    }
  }
  return originalGetBoundingClientRect.apply(this);
});
