import { useEffect, useRef, useState, useCallback } from 'react'
import { Tool, Shape, PenType } from '../App'
import './Canvas.css'

interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}

type SelectionHandle =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

interface ShapeRegion {
  id: number
  rect: SelectionRect
  contentPixelCount: number
}

interface CanvasProps {
  tool: Tool
  shape?: Shape
  penType?: PenType
  color: string
  panelData: ImageData | null
  layout: { rows: number; columns: number[] }
  onCanvasChange: (data: ImageData) => void
}

const getPenWidth = (penType?: PenType): number => {
  if (!penType) return 2
  switch (penType) {
    case 'fine': return 1
    case 'small': return 2
    case 'medium': return 4
    case 'large': return 6
    case 'thick': return 8
    case 'verythick': return 12
    default: return 2
  }
}

const normalizeRect = (start: { x: number; y: number }, end: { x: number; y: number }): SelectionRect => {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  const width = Math.abs(start.x - end.x)
  const height = Math.abs(start.y - end.y)
  return { x, y, width, height }
}

const pointInRect = (point: { x: number; y: number }, rect: SelectionRect) => {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max)
}

const MIN_CONTENT_PIXELS = 12
const CONTENT_RETAIN_RATIO = 0.4

const clampRectToCanvas = (rect: SelectionRect, canvasWidth: number, canvasHeight: number): SelectionRect => {
  const clampedWidth = Math.min(rect.width, canvasWidth)
  const clampedHeight = Math.min(rect.height, canvasHeight)

  return {
    x: clamp(rect.x, 0, Math.max(0, canvasWidth - clampedWidth)),
    y: clamp(rect.y, 0, Math.max(0, canvasHeight - clampedHeight)),
    width: clampedWidth,
    height: clampedHeight,
  }
}

const expandRect = (rect: SelectionRect, padding: number, canvasWidth: number, canvasHeight: number): SelectionRect => {
  const expanded = {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }

  return clampRectToCanvas(expanded, canvasWidth, canvasHeight)
}

const countContentPixels = (imageData: ImageData) => {
  const data = imageData.data
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (a !== 0 && (r < 250 || g < 250 || b < 250)) {
      count++
    }
  }
  return count
}

const getHandleAtPoint = (point: { x: number; y: number }, rect: SelectionRect, handleSize = 8): SelectionHandle | null => {
  const half = handleSize / 2
  const handles: Array<{ handle: SelectionHandle; x: number; y: number }> = [
    { handle: 'top-left', x: rect.x, y: rect.y },
    { handle: 'top-center', x: rect.x + rect.width / 2, y: rect.y },
    { handle: 'top-right', x: rect.x + rect.width, y: rect.y },
    { handle: 'middle-left', x: rect.x, y: rect.y + rect.height / 2 },
    { handle: 'middle-right', x: rect.x + rect.width, y: rect.y + rect.height / 2 },
    { handle: 'bottom-left', x: rect.x, y: rect.y + rect.height },
    { handle: 'bottom-center', x: rect.x + rect.width / 2, y: rect.y + rect.height },
    { handle: 'bottom-right', x: rect.x + rect.width, y: rect.y + rect.height },
  ]

  for (const handle of handles) {
    if (
      point.x >= handle.x - half &&
      point.x <= handle.x + half &&
      point.y >= handle.y - half &&
      point.y <= handle.y + half
    ) {
      return handle.handle
    }
  }

  return null
}

const drawSelectionOutline = (ctx: CanvasRenderingContext2D, rect: SelectionRect) => {
  ctx.save()
  ctx.strokeStyle = '#4c6ef5'
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 4])
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width, rect.height)
  ctx.restore()
}

const drawSelectionHandles = (ctx: CanvasRenderingContext2D, rect: SelectionRect) => {
  const handleSize = 8
  const half = handleSize / 2
  const positions = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width / 2, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height / 2 },
    { x: rect.x + rect.width, y: rect.y + rect.height / 2 },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width / 2, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ]

  ctx.save()
  ctx.setLineDash([])
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#4c6ef5'
  ctx.lineWidth = 1
  positions.forEach((pos) => {
    ctx.beginPath()
    ctx.rect(pos.x - half, pos.y - half, handleSize, handleSize)
    ctx.fill()
    ctx.stroke()
  })
  ctx.restore()
}

export default function Canvas({ tool, shape, penType, color, panelData, layout, onCanvasChange }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const savedImageRef = useRef<ImageData | null>(null)
  const shapeRegionsRef = useRef<ShapeRegion[]>([])
  const shapeIdCounterRef = useRef(0)
  const activeShapeIndexRef = useRef<number | null>(null)
  const selectionRectRef = useRef<SelectionRect | null>(null)
  const selectionOriginalImageRef = useRef<ImageData | null>(null)
  const selectionBaseImageRef = useRef<ImageData | null>(null)
  const selectionImageRef = useRef<ImageData | null>(null)
  const isSelectingRef = useRef(false)
  const isDraggingSelectionRef = useRef(false)
  const selectionStartRef = useRef({ x: 0, y: 0 })
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const resizeHandleRef = useRef<SelectionHandle | null>(null)
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number } | null>(null)
  const [textInputScreenPos, setTextInputScreenPos] = useState<{ x: number; y: number } | null>(null)
  const [textInput, setTextInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [balloonOval, setBalloonOval] = useState<{ 
    centerX: number; 
    centerY: number; 
    radiusX: number; 
    radiusY: number;
    screenPos: { x: number; y: number };
  } | null>(null)

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.save()
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 3

    const totalRows = layout.rows
    const gutter = 12 // Space between panels (and around edges)
    const canvasWidth = 1200
    const canvasHeight = 800

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
  }, [layout])

  const findShapeIndexAtPoint = useCallback((point: { x: number; y: number }) => {
    for (let i = shapeRegionsRef.current.length - 1; i >= 0; i--) {
      const region = shapeRegionsRef.current[i]
      if (pointInRect(point, region.rect)) {
        return i
      }
    }
    return -1
  }, [])

  const prepareShapeSelection = useCallback(
    (shapeIndex: number, clickPos: { x: number; y: number }): boolean => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return false

      const region = shapeRegionsRef.current[shapeIndex]
      if (!region) return false

      const imageData = ctx.getImageData(region.rect.x, region.rect.y, region.rect.width, region.rect.height)
      const contentPixels = countContentPixels(imageData)
      if (
        contentPixels < MIN_CONTENT_PIXELS ||
        (region.contentPixelCount > 0 && contentPixels < region.contentPixelCount * CONTENT_RETAIN_RATIO)
      ) {
        shapeRegionsRef.current.splice(shapeIndex, 1)
        selectionRectRef.current = null
        selectionImageRef.current = null
        activeShapeIndexRef.current = null
        selectionBaseImageRef.current = null
        selectionOriginalImageRef.current = null
        resizeHandleRef.current = null
        return false
      }

      selectionRectRef.current = { ...region.rect }
      selectionImageRef.current = imageData
      shapeRegionsRef.current[shapeIndex] = {
        ...region,
        contentPixelCount: contentPixels,
      }
      selectionOriginalImageRef.current = null

      ctx.save()
      ctx.fillStyle = 'white'
      ctx.fillRect(region.rect.x, region.rect.y, region.rect.width, region.rect.height)
      ctx.restore()
      drawGrid(ctx)

      selectionBaseImageRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)

      if (selectionImageRef.current) {
        ctx.putImageData(selectionImageRef.current, region.rect.x, region.rect.y)
        drawSelectionOutline(ctx, region.rect)
        drawSelectionHandles(ctx, region.rect)
      }

      activeShapeIndexRef.current = shapeIndex
      isSelectingRef.current = false
      isDraggingSelectionRef.current = true
      dragOffsetRef.current = {
        x: clickPos.x - region.rect.x,
        y: clickPos.y - region.rect.y,
      }
      resizeHandleRef.current = getHandleAtPoint(clickPos, region.rect)
      return true
    },
    [drawGrid]
  )

  const updateActiveShapeRegion = useCallback(
    (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, rect: SelectionRect, selectionImage?: ImageData | null) => {
      const activeIndex = activeShapeIndexRef.current
      if (typeof activeIndex !== 'number') return

      const region = shapeRegionsRef.current[activeIndex]
      if (!region) {
        activeShapeIndexRef.current = null
        return
      }

      const clampedRect = clampRectToCanvas(rect, canvas.width, canvas.height)
      let contentPixels = 0

      if (selectionImage) {
        contentPixels = countContentPixels(selectionImage)
      } else {
        const snapshot = ctx.getImageData(clampedRect.x, clampedRect.y, clampedRect.width, clampedRect.height)
        contentPixels = countContentPixels(snapshot)
      }

      shapeRegionsRef.current[activeIndex] = {
        ...region,
        rect: clampedRect,
        contentPixelCount: Math.max(contentPixels, MIN_CONTENT_PIXELS),
      }
    },
    []
  )

  const commitSelection = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    if (!selectionImageRef.current || !selectionRectRef.current || !selectionBaseImageRef.current) {
      selectionImageRef.current = null
      selectionBaseImageRef.current = null
      selectionOriginalImageRef.current = null
      selectionRectRef.current = null
      isSelectingRef.current = false
      isDraggingSelectionRef.current = false
      activeShapeIndexRef.current = null
      resizeHandleRef.current = null
      return
    }

    ctx.putImageData(selectionBaseImageRef.current, 0, 0)
    const rect = selectionRectRef.current
    ctx.putImageData(selectionImageRef.current, rect.x, rect.y)
    drawGrid(ctx)

    updateActiveShapeRegion(canvas, ctx, rect, selectionImageRef.current)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    onCanvasChange(imageData)

    selectionImageRef.current = null
    selectionBaseImageRef.current = null
    selectionOriginalImageRef.current = null
    selectionRectRef.current = null
    isSelectingRef.current = false
    isDraggingSelectionRef.current = false
    activeShapeIndexRef.current = null
    resizeHandleRef.current = null
  }, [drawGrid, onCanvasChange, updateActiveShapeRegion])

  useEffect(() => {
    if (tool !== 'select') {
      commitSelection()
    }
  }, [tool, commitSelection])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = 1200
    canvas.height = 800

    // Set drawing styles
    ctx.globalCompositeOperation = 'source-over'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = getPenWidth(penType)

    // Restore saved data if available
    if (panelData) {
      ctx.putImageData(panelData, 0, 0)
    } else {
      // Clear canvas with white if no saved data
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    // Draw grid on top (always visible)
    drawGrid(ctx)
  }, [panelData, layout, drawGrid, color, penType])

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const floodFill = (ctx: CanvasRenderingContext2D, x: number, y: number, fillColor: string) => {
    // Ensure we're using source-over for fill
    ctx.globalCompositeOperation = 'source-over'
    
    const canvas = ctx.canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    const width = canvas.width
    const height = canvas.height

    // Get target color at the clicked point
    const clickedIndex = (Math.floor(y) * width + Math.floor(x)) * 4
    const targetR = data[clickedIndex]
    const targetG = data[clickedIndex + 1]
    const targetB = data[clickedIndex + 2]
    const targetA = data[clickedIndex + 3]

    // Parse fill color
    const fillR = parseInt(fillColor.slice(1, 3), 16)
    const fillG = parseInt(fillColor.slice(3, 5), 16)
    const fillB = parseInt(fillColor.slice(5, 7), 16)

    // Helper function to check if a pixel matches the target color (including alpha for erased areas)
    const matchesTargetColor = (r: number, g: number, b: number, a: number) => {
      const tolerance = 10 // Allow small differences for antialiasing
      const alphaTolerance = 5 // Tolerance for alpha channel
      
      // If target is transparent (erased), match transparent pixels
      if (targetA < alphaTolerance) {
        return a < alphaTolerance
      }
      
      // If target is opaque, match RGB values and ensure alpha is similar
      return Math.abs(r - targetR) <= tolerance && 
             Math.abs(g - targetG) <= tolerance && 
             Math.abs(b - targetB) <= tolerance &&
             Math.abs(a - targetA) <= alphaTolerance
    }

    // Stack-based flood fill
    const stack: Array<[number, number]> = [[Math.floor(x), Math.floor(y)]]
    const visited = new Set<string>()

    while (stack.length > 0) {
      const [px, py] = stack.pop()!
      const key = `${px},${py}`

      if (visited.has(key) || px < 0 || px >= width || py < 0 || py >= height) {
        continue
      }

      visited.add(key)

      const index = (py * width + px) * 4
      const r = data[index]
      const g = data[index + 1]
      const b = data[index + 2]
      const a = data[index + 3]

      // Fill pixels that match the target color (where we clicked)
      if (matchesTargetColor(r, g, b, a)) {
        // Fill this pixel
        data[index] = fillR
        data[index + 1] = fillG
        data[index + 2] = fillB
        data[index + 3] = 255 // Set alpha to opaque

        // Add neighbors to stack
        stack.push([px + 1, py])
        stack.push([px - 1, py])
        stack.push([px, py + 1])
        stack.push([px, py - 1])
      }
    }

    // Put the modified image data back
    ctx.putImageData(imageData, 0, 0)
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const pos = getMousePos(e)

    if (tool === 'select') {
      setIsDrawing(true)

      if (
        selectionRectRef.current &&
        selectionImageRef.current &&
        selectionBaseImageRef.current &&
        pointInRect(pos, selectionRectRef.current)
      ) {
        isDraggingSelectionRef.current = true
        dragOffsetRef.current = {
          x: pos.x - selectionRectRef.current.x,
          y: pos.y - selectionRectRef.current.y,
        }
        resizeHandleRef.current = getHandleAtPoint(pos, selectionRectRef.current)
        return
      }

      const shapeIndex = findShapeIndexAtPoint(pos)
      if (shapeIndex !== -1) {
        commitSelection()
        if (prepareShapeSelection(shapeIndex, pos)) {
          return
        }
      }

      commitSelection()
      selectionRectRef.current = null
      selectionImageRef.current = null
      selectionBaseImageRef.current = null
      selectionOriginalImageRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
      selectionStartRef.current = pos
      isSelectingRef.current = true
      activeShapeIndexRef.current = null
      resizeHandleRef.current = null
      return
    }

    commitSelection()

    setStartPos(pos)
    setIsDrawing(true)

    if (tool === 'pen') {
      // Ensure we can draw over erased areas
      ctx.globalCompositeOperation = 'source-over'
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    } else if (tool === 'fill') {
      floodFill(ctx, pos.x, pos.y, color)
      drawGrid(ctx)
      setIsDrawing(false)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      onCanvasChange(imageData)
    } else if (tool === 'text') {
      setTextInputPos({ x: pos.x, y: pos.y })
      const rect = canvas.getBoundingClientRect()
      setTextInputScreenPos({
        x: rect.left + (pos.x * rect.width) / canvas.width,
        y: rect.top + (pos.y * rect.height) / canvas.height,
      })
      setTextInput('')
      setIsDrawing(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    } else if (tool === 'shapes' || tool === 'balloon') {
      savedImageRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
    } else if (tool === 'eraser') {
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    }
  }

  const drawShape = (ctx: CanvasRenderingContext2D, shape: Shape, startX: number, startY: number, endX: number, endY: number) => {
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
      case 'star':
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
      case 'heart':
        const heartSize = Math.min(radiusX, radiusY)
        // Start at top center
        ctx.moveTo(centerX, centerY)
        // Left lobe
        ctx.bezierCurveTo(
          centerX, centerY - heartSize * 0.25,
          centerX - heartSize * 0.25, centerY - heartSize * 0.5,
          centerX - heartSize * 0.5, centerY - heartSize * 0.5
        )
        ctx.bezierCurveTo(
          centerX - heartSize * 0.75, centerY - heartSize * 0.5,
          centerX - heartSize * 0.75, centerY,
          centerX - heartSize * 0.5, centerY + heartSize * 0.25
        )
        // Bottom point
        ctx.bezierCurveTo(
          centerX - heartSize * 0.25, centerY + heartSize * 0.5,
          centerX, centerY + heartSize * 0.6,
          centerX, centerY + heartSize * 0.6
        )
        // Right lobe
        ctx.bezierCurveTo(
          centerX, centerY + heartSize * 0.6,
          centerX + heartSize * 0.25, centerY + heartSize * 0.5,
          centerX + heartSize * 0.5, centerY + heartSize * 0.25
        )
        ctx.bezierCurveTo(
          centerX + heartSize * 0.75, centerY,
          centerX + heartSize * 0.75, centerY - heartSize * 0.5,
          centerX + heartSize * 0.5, centerY - heartSize * 0.5
        )
        ctx.bezierCurveTo(
          centerX + heartSize * 0.25, centerY - heartSize * 0.5,
          centerX, centerY - heartSize * 0.25,
          centerX, centerY
        )
        ctx.closePath()
        break
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
      case 'cross':
        const armWidth = Math.min(radiusX, radiusY) * 0.2
        ctx.moveTo(centerX - armWidth, startY)
        ctx.lineTo(centerX + armWidth, startY)
        ctx.lineTo(centerX + armWidth, centerY - armWidth)
        ctx.lineTo(endX, centerY - armWidth)
        ctx.lineTo(endX, centerY + armWidth)
        ctx.lineTo(centerX + armWidth, centerY + armWidth)
        ctx.lineTo(centerX + armWidth, endY)
        ctx.lineTo(centerX - armWidth, endY)
        ctx.lineTo(centerX - armWidth, centerY + armWidth)
        ctx.lineTo(startX, centerY + armWidth)
        ctx.lineTo(startX, centerY - armWidth)
        ctx.lineTo(centerX - armWidth, centerY - armWidth)
        ctx.closePath()
        break
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
    ctx.stroke()
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const pos = getMousePos(e)

    if (tool === 'select') {
      if (isSelectingRef.current && selectionOriginalImageRef.current) {
        ctx.putImageData(selectionOriginalImageRef.current, 0, 0)
        const rect = normalizeRect(selectionStartRef.current, pos)
        selectionRectRef.current = rect
        drawSelectionOutline(ctx, rect)
        drawSelectionHandles(ctx, rect)
      } else if (
        isDraggingSelectionRef.current &&
        selectionBaseImageRef.current &&
        selectionImageRef.current &&
        selectionRectRef.current
      ) {
        ctx.putImageData(selectionBaseImageRef.current, 0, 0)
        const rect = selectionRectRef.current
        const newRect: SelectionRect = {
          ...rect,
          x: clamp(pos.x - dragOffsetRef.current.x, 0, canvas.width - rect.width),
          y: clamp(pos.y - dragOffsetRef.current.y, 0, canvas.height - rect.height),
        }
        selectionRectRef.current = newRect
        ctx.putImageData(selectionImageRef.current, newRect.x, newRect.y)
        drawSelectionOutline(ctx, newRect)
        drawSelectionHandles(ctx, newRect)
      }
      return
    }

    if (tool === 'pen') {
      // Ensure we can draw over erased areas
      ctx.globalCompositeOperation = 'source-over'
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    } else if (tool === 'eraser') {
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = 20
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      ctx.restore()
      // Explicitly reset composite operation for next drawing
      ctx.globalCompositeOperation = 'source-over'
    } else if (tool === 'shapes' || tool === 'balloon') {
      if (savedImageRef.current) {
        ctx.putImageData(savedImageRef.current, 0, 0)
      }
      drawGrid(ctx)

      if (tool === 'shapes' && shape) {
        drawShape(ctx, shape, startPos.x, startPos.y, pos.x, pos.y)
      } else if (tool === 'balloon') {
        ctx.beginPath()
        const radiusX = Math.abs(pos.x - startPos.x) / 2
        const radiusY = Math.abs(pos.y - startPos.y) / 2
        const centerX = (startPos.x + pos.x) / 2
        const centerY = (startPos.y + pos.y) / 2
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI)
        ctx.stroke()

        const tailY = centerY + radiusY
        ctx.beginPath()
        ctx.moveTo(centerX, tailY)
        ctx.lineTo(centerX - 15, tailY + 20)
        ctx.lineTo(centerX + 15, tailY + 20)
        ctx.closePath()
        ctx.fillStyle = color
        ctx.fill()
        ctx.stroke()
      }
    }
  }

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      setIsDrawing(false)
      return
    }

    if (tool === 'select') {
      if (!isDrawing) {
        return
      }

      const pos = getMousePos(e)

      if (isSelectingRef.current && selectionOriginalImageRef.current) {
        const rect = normalizeRect(selectionStartRef.current, pos)
        isSelectingRef.current = false
        setIsDrawing(false)

        if (rect.width < 3 || rect.height < 3) {
          ctx.putImageData(selectionOriginalImageRef.current, 0, 0)
          drawGrid(ctx)
          selectionOriginalImageRef.current = null
          selectionRectRef.current = null
          return
        }

        selectionRectRef.current = rect

        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = canvas.width
        tempCanvas.height = canvas.height
        const tempCtx = tempCanvas.getContext('2d')
        if (tempCtx) {
          tempCtx.putImageData(selectionOriginalImageRef.current, 0, 0)
          selectionImageRef.current = tempCtx.getImageData(rect.x, rect.y, rect.width, rect.height)
        }

        ctx.putImageData(selectionOriginalImageRef.current, 0, 0)
        ctx.save()
        ctx.fillStyle = 'white'
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
        ctx.restore()
        drawGrid(ctx)

        selectionBaseImageRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)

        if (selectionImageRef.current) {
          ctx.putImageData(selectionImageRef.current, rect.x, rect.y)
          drawSelectionOutline(ctx, rect)
          drawSelectionHandles(ctx, rect)
        }

        selectionOriginalImageRef.current = null
        return
      }

      if (isDraggingSelectionRef.current) {
        isDraggingSelectionRef.current = false
        setIsDrawing(false)

        if (selectionBaseImageRef.current && selectionImageRef.current && selectionRectRef.current) {
          ctx.putImageData(selectionBaseImageRef.current, 0, 0)
          const rect = selectionRectRef.current
          ctx.putImageData(selectionImageRef.current, rect.x, rect.y)
          drawSelectionOutline(ctx, rect)
          drawSelectionHandles(ctx, rect)
          updateActiveShapeRegion(canvas, ctx, rect, selectionImageRef.current)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          onCanvasChange(imageData)
        }
        return
      }

      setIsDrawing(false)
      return
    }

    if (!isDrawing) {
      return
    }

    const pos = getMousePos(e)

    if (tool === 'shapes' && shape) {
      drawShape(ctx, shape, startPos.x, startPos.y, pos.x, pos.y)
      const rawRect = normalizeRect(startPos, pos)
      const paddedRect = expandRect(rawRect, 6, canvas.width, canvas.height)
      if (paddedRect.width > 0 && paddedRect.height > 0) {
        const snapshot = ctx.getImageData(paddedRect.x, paddedRect.y, paddedRect.width, paddedRect.height)
        const contentPixels = countContentPixels(snapshot)
        if (contentPixels >= MIN_CONTENT_PIXELS) {
          shapeRegionsRef.current.push({
            id: shapeIdCounterRef.current++,
            rect: paddedRect,
            contentPixelCount: contentPixels,
          })
        }
      }
    } else if (tool === 'balloon') {
      ctx.beginPath()
      const radiusX = Math.abs(pos.x - startPos.x) / 2
      const radiusY = Math.abs(pos.y - startPos.y) / 2
      const centerX = (startPos.x + pos.x) / 2
      const centerY = (startPos.y + pos.y) / 2
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI)
      ctx.stroke()

      const tailY = centerY + radiusY
      ctx.beginPath()
      ctx.moveTo(centerX, tailY)
      ctx.lineTo(centerX - 15, tailY + 20)
      ctx.lineTo(centerX + 15, tailY + 20)
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
      ctx.stroke()

      const rect = canvas.getBoundingClientRect()
      const screenPos = {
        x: rect.left + (centerX * rect.width) / canvas.width,
        y: rect.top + (centerY * rect.height) / canvas.height - 12,
      }
      setBalloonOval({
        centerX,
        centerY,
        radiusX,
        radiusY,
        screenPos,
      })
      setTextInputPos({ x: centerX, y: centerY })
      setTextInputScreenPos(screenPos)
      setTimeout(() => inputRef.current?.focus(), 0)
    }

    setIsDrawing(false)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    onCanvasChange(imageData)
  }

  const handleTextSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && textInput && textInputPos) {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return

      // Draw the text on canvas
      ctx.fillStyle = color
      ctx.font = '24px Arial'
      
      // If this is balloon text, center it in the oval
      if (balloonOval) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(textInput, balloonOval.centerX, balloonOval.centerY)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      } else {
        ctx.fillText(textInput, textInputPos.x, textInputPos.y)
      }

      // Redraw grid on top
      drawGrid(ctx)

      // Save the canvas
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      onCanvasChange(imageData)

      // Hide input
      setTextInputPos(null)
      setTextInputScreenPos(null)
      setTextInput('')
      setBalloonOval(null)
    } else if (e.key === 'Escape') {
      setTextInputPos(null)
      setTextInputScreenPos(null)
      setTextInput('')
      setBalloonOval(null)
    }
  }

  return (
    <div className="canvas-container">
      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />
      {textInputPos && textInputScreenPos && (
        <input
          ref={inputRef}
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={handleTextSubmit}
          style={{
            position: 'fixed',
            left: `${textInputScreenPos.x}px`,
            top: `${textInputScreenPos.y}px`,
            border: '1px solid #667eea',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '24px',
            fontFamily: 'Arial',
            outline: 'none',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            zIndex: 1000,
          }}
        />
      )}
    </div>
  )
}

