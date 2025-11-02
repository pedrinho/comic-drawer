import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock HTMLCanvasElement for jsdom
HTMLCanvasElement.prototype.getContext = vi.fn(() => {
  return {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => {
      return {
        data: new Uint8ClampedArray(4 * 1200 * 800),
        width: 1200,
        height: 800,
      }
    }),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => {
      return {
        data: new Uint8ClampedArray(4 * 1200 * 800),
        width: 1200,
        height: 800,
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
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: '' as CanvasLineCap,
    lineJoin: '' as CanvasLineJoin,
    globalCompositeOperation: '' as GlobalCompositeOperation,
  }
}) as any

HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,')

// Mock getter/setter for width and height
Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
  get: () => 1200,
  set: vi.fn(),
  configurable: true,
})

Object.defineProperty(HTMLCanvasElement.prototype, 'height', {
  get: () => 800,
  set: vi.fn(),
  configurable: true,
})
