import { Shape } from '../types/common'

/**
 * Debug logging utility
 */
const DEBUG_ENABLED = typeof import.meta !== 'undefined' &&
  import.meta.env &&
  (import.meta.env.DEV || import.meta.env.MODE === 'development')

export const debugLog = (category: string, message: string, ...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log(`[${category}] ${message}`, ...args)
  }
}

export const debugError = (category: string, message: string, error?: any) => {
  if (DEBUG_ENABLED) {
    console.error(`[${category}] ${message}`, error)
  }
}

export const debugWarn = (category: string, message: string, ...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.warn(`[${category}] ${message}`, ...args)
  }
}

/**
 * Traces a shape path on the canvas context
 */
export const traceShapePath = (
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  startX: number,
  startY: number,
  endX: number,
  endY: number
) => {
  // debugLog('CanvasUtils', `Tracing shape: ${shape}`, { startX, startY, endX, endY })

  const width = endX - startX
  const height = endY - startY
  const centerX = (startX + endX) / 2
  const centerY = (startY + endY) / 2
  const radiusX = Math.abs(width) / 2
  const radiusY = Math.abs(height) / 2

  ctx.beginPath()
  switch (shape) {
    case 'rectangle':
      ctx.rect(startX, startY, width, height)
      break
    case 'circle':
      ctx.ellipse(centerX, centerY, Math.min(radiusX, radiusY), Math.min(radiusX, radiusY), 0, 0, 2 * Math.PI)
      break
    case 'triangle':
      ctx.moveTo(centerX, startY)
      ctx.lineTo(startX, endY)
      ctx.lineTo(endX, endY)
      ctx.closePath()
      break
    case 'star': {
      const spikes = 5
      const outerRadius = Math.min(radiusX, radiusY)
      const innerRadius = outerRadius * 0.5
      for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius
        const angle = (i * Math.PI) / spikes - Math.PI / 2
        const x = centerX + radius * Math.cos(angle)
        const y = centerY + radius * Math.sin(angle)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      break
    }
    case 'heart': {
      const heartSize = Math.min(radiusX, radiusY)
      ctx.moveTo(centerX, centerY)
      ctx.bezierCurveTo(centerX, centerY - heartSize * 0.25, centerX - heartSize * 0.25, centerY - heartSize * 0.5, centerX - heartSize * 0.5, centerY - heartSize * 0.5)
      ctx.bezierCurveTo(centerX - heartSize * 0.75, centerY - heartSize * 0.5, centerX - heartSize * 0.75, centerY, centerX - heartSize * 0.5, centerY + heartSize * 0.25)
      ctx.bezierCurveTo(centerX - heartSize * 0.25, centerY + heartSize * 0.5, centerX, centerY + heartSize * 0.6, centerX, centerY + heartSize * 0.6)
      ctx.bezierCurveTo(centerX, centerY + heartSize * 0.6, centerX + heartSize * 0.25, centerY + heartSize * 0.5, centerX + heartSize * 0.5, centerY + heartSize * 0.25)
      ctx.bezierCurveTo(centerX + heartSize * 0.75, centerY, centerX + heartSize * 0.75, centerY - heartSize * 0.5, centerX + heartSize * 0.5, centerY - heartSize * 0.5)
      ctx.bezierCurveTo(centerX + heartSize * 0.25, centerY - heartSize * 0.5, centerX, centerY - heartSize * 0.25, centerX, centerY)
      ctx.closePath()
      break
    }
    case 'diamond':
      ctx.moveTo(centerX, startY)
      ctx.lineTo(endX, centerY)
      ctx.lineTo(centerX, endY)
      ctx.lineTo(startX, centerY)
      ctx.closePath()
      break
    case 'hexagon':
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3
        const x = centerX + radiusX * Math.cos(angle)
        const y = centerY + radiusY * Math.sin(angle)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      break
    case 'pentagon':
      for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2
        const x = centerX + radiusX * Math.cos(angle)
        const y = centerY + radiusY * Math.sin(angle)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      break
    case 'arrow':
      ctx.moveTo(startX, centerY)
      ctx.lineTo(endX - radiusX * 0.3, centerY)
      ctx.lineTo(endX - radiusX * 0.3, startY)
      ctx.lineTo(endX, centerY)
      ctx.lineTo(endX - radiusX * 0.3, endY)
      ctx.lineTo(endX - radiusX * 0.3, centerY)
      ctx.closePath()
      break
    case 'cross': {
      const armWidth = Math.min(radiusX, radiusY) * 0.2
      ctx.moveTo(centerX - armWidth, startY)
      ctx.lineTo(centerX + armWidth, startY)
      ctx.lineTo(centerX + armWidth, centerY - armWidth)
      ctx.lineTo(endX, centerY - armWidth)
      ctx.lineTo(endX, centerY + armWidth)
      ctx.lineTo(centerX + armWidth, centerY + armWidth)
      ctx.lineTo(endX, centerY + armWidth)
      ctx.lineTo(centerX + armWidth, endY)
      ctx.lineTo(centerX - armWidth, endY)
      ctx.lineTo(centerX - armWidth, centerY + armWidth)
      ctx.lineTo(startX, centerY + armWidth)
      ctx.lineTo(startX, centerY - armWidth)
      ctx.lineTo(centerX - armWidth, centerY - armWidth)
      ctx.closePath()
      break
    }
    case 'heptagon':
      for (let i = 0; i < 7; i++) {
        const angle = (i * 2 * Math.PI) / 7 - Math.PI / 2
        const x = centerX + radiusX * Math.cos(angle)
        const y = centerY + radiusY * Math.sin(angle)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      break
    case 'octagon':
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4
        const x = centerX + radiusX * Math.cos(angle)
        const y = centerY + radiusY * Math.sin(angle)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      break
  }
}

/**
 * Draws a grid on the canvas based on the layout
 */
export const drawGrid = (
  ctx: CanvasRenderingContext2D,
  layout: { rows: number; columns: number[] },
  canvasWidth: number = 1200,
  canvasHeight: number = 800
) => {
  debugLog('CanvasUtils', 'Drawing grid', { rows: layout.rows, columns: layout.columns })

  ctx.save()
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 3

  const totalRows = layout.rows
  const gutter = 12 // Space between panels (and around edges)

  for (let row = 0; row < totalRows; row++) {
    const columnsInRow = layout.columns[row] || 1

    // Calculate spacing: gutter on each side + gutters between cells
    const totalVerticalGutters = gutter * 2 + (totalRows - 1) * gutter
    const totalHorizontalGutters = gutter * 2 + (columnsInRow - 1) * gutter
    const panelHeight = (canvasHeight - totalVerticalGutters) / totalRows
    const panelWidth = (canvasWidth - totalHorizontalGutters) / columnsInRow

    let currentX = gutter
    const currentY = gutter + (row * (panelHeight + gutter))

    // Draw rectangle for each cell in the row
    for (let col = 0; col < columnsInRow; col++) {
      ctx.beginPath()
      ctx.rect(currentX, currentY, panelWidth, panelHeight)
      ctx.stroke()
      currentX += panelWidth + gutter
    }
  }

  ctx.restore()
}

/**
 * Clones ImageData to create a deep copy
 * This is useful for history/undo-redo functionality
 */
export const cloneImageData = (imageData: ImageData): ImageData => {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context for cloning ImageData')
  }
  ctx.putImageData(imageData, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/**
 * Creates a blank white ImageData
 */
export const createBlankImageData = (width: number = 1200, height: number = 800): ImageData => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context for creating blank ImageData')
  }
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

// Helper types
interface Point { x: number; y: number; }

/**
 * Calculates squared distance from a point p to a line segment p1-p2
 */
const getSqSegDist = (p: Point, p1: Point, p2: Point): number => {
  let x = p1.x, y = p1.y, dx = p2.x - x, dy = p2.y - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = p2.x;
      y = p2.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p.x - x;
  dy = p.y - y;
  return dx * dx + dy * dy;
}

/**
 * Simplifies a path using Ramer-Douglas-Peucker algorithm
 */
export const simplifyPath = (points: Point[], tolerance: number): Point[] => {
  if (points.length <= 2) return points;
  const sqTolerance = tolerance * tolerance;
  return simplifyDPStep(points, 0, points.length - 1, sqTolerance);
}

const simplifyDPStep = (points: Point[], first: number, last: number, sqTolerance: number): Point[] => {
  let maxSqDist = sqTolerance;
  let index = -1;
  const p1 = points[first];
  const p2 = points[last];

  if (!p1 || !p2) return [];

  for (let i = first + 1; i < last; i++) {
    const p = points[i]
    if (p) {
      const sqDist = getSqSegDist(p, p1, p2);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }
  }

  if (index > -1) {
    const recResults1 = simplifyDPStep(points, first, index, sqTolerance);
    const recResults2 = simplifyDPStep(points, index, last, sqTolerance);
    return [...recResults1.slice(0, -1), ...recResults2];
  } else {
    return [p1, p2];
  }
}

/**
 * Checks if a point is near a polyline within a given threshold
 */
export const isPointNearPolyline = (point: Point, polyline: Point[], threshold: number): boolean => {
  const sqThreshold = threshold * threshold;
  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = polyline[i];
    const p2 = polyline[i + 1];
    if (p1 && p2 && getSqSegDist(point, p1, p2) < sqThreshold) {
      return true;
    }
  }
  return false;
}

/**
 * Helper function to convert ImageData to base64
 */
export const imageDataToBase64 = (imageData: ImageData): string => {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

/**
 * Helper function to convert base64 to ImageData
 */
export const base64ToImageData = async (base64: string): Promise<ImageData | null> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 800
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      resolve(null)
      return
    }

    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0)
      resolve(ctx.getImageData(0, 0, 1200, 800))
    }
    img.onerror = () => resolve(null)
    img.src = base64
  })
}
