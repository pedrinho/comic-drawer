import { useEffect, useRef, useState, useCallback } from 'react'
import { Tool, Shape, PenType } from '../App'
import { ShapeLayer } from '../types/layers'
import { traceShapePath, drawGrid as drawGridUtil, debugLog, debugError, debugWarn } from '../utils/canvasUtils'
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
  shapeLayers?: ShapeLayer[]
  onShapeLayersChange?: (layers: ShapeLayer[]) => void
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

// Unused function - kept for potential future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

const getRotationHandlePos = (rect: SelectionRect): { x: number; y: number } => {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y - 30, // Position above the rectangle
  }
}

const isRotationHandle = (point: { x: number; y: number }, rect: SelectionRect, handleSize = 10): boolean => {
  const handlePos = getRotationHandlePos(rect)
  const distance = Math.sqrt(
    Math.pow(point.x - handlePos.x, 2) + Math.pow(point.y - handlePos.y, 2)
  )
  return distance <= handleSize / 2
}

const calculateRotationAngle = (center: { x: number; y: number }, point: { x: number; y: number }): number => {
  const dx = point.x - center.x
  const dy = point.y - center.y
  return Math.atan2(dy, dx)
}

const calculateResizedRect = (
  handle: SelectionHandle,
  startRect: SelectionRect,
  currentPos: { x: number; y: number },
  startPos: { x: number; y: number }
): SelectionRect => {
  const deltaX = currentPos.x - startPos.x
  const deltaY = currentPos.y - startPos.y
  let newRect = { ...startRect }

  switch (handle) {
    case 'top-left':
      newRect.x = startRect.x + deltaX
      newRect.y = startRect.y + deltaY
      newRect.width = startRect.width - deltaX
      newRect.height = startRect.height - deltaY
      break
    case 'top-center':
      newRect.y = startRect.y + deltaY
      newRect.height = startRect.height - deltaY
      break
    case 'top-right':
      newRect.y = startRect.y + deltaY
      newRect.width = startRect.width + deltaX
      newRect.height = startRect.height - deltaY
      break
    case 'middle-left':
      newRect.x = startRect.x + deltaX
      newRect.width = startRect.width - deltaX
      break
    case 'middle-right':
      newRect.width = startRect.width + deltaX
      break
    case 'bottom-left':
      newRect.x = startRect.x + deltaX
      newRect.width = startRect.width - deltaX
      newRect.height = startRect.height + deltaY
      break
    case 'bottom-center':
      newRect.height = startRect.height + deltaY
      break
    case 'bottom-right':
      newRect.width = startRect.width + deltaX
      newRect.height = startRect.height + deltaY
      break
  }

  // Ensure minimum size
  if (newRect.width < 1) {
    if (handle.includes('left')) {
      newRect.x = startRect.x + startRect.width - 1
    }
    newRect.width = 1
  }
  if (newRect.height < 1) {
    if (handle.includes('top')) {
      newRect.y = startRect.y + startRect.height - 1
    }
    newRect.height = 1
  }

  return newRect
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
  
  // Draw rotation handle (circle above the rectangle)
  const rotationHandlePos = getRotationHandlePos(rect)
  ctx.fillStyle = '#4c6ef5'
  ctx.beginPath()
  ctx.arc(rotationHandlePos.x, rotationHandlePos.y, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.stroke()
  
  // Draw line from center to rotation handle
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2
  ctx.strokeStyle = '#4c6ef5'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(centerX, centerY)
  ctx.lineTo(rotationHandlePos.x, rotationHandlePos.y)
  ctx.stroke()
  
  ctx.restore()
}

export default function Canvas({
  tool,
  shape,
  penType,
  color,
  panelData,
  layout,
  onCanvasChange,
  shapeLayers = [],
  onShapeLayersChange,
}: CanvasProps) {
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
  const isResizingRef = useRef(false)
  const isRotatingRef = useRef(false)
  const rotationAngleRef = useRef(0)
  const cumulativeRotationAngleRef = useRef(0) // Total accumulated rotation angle
  const initialRotationAngleRef = useRef(0)
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 })
  const resizeClickStartRef = useRef({ x: 0, y: 0 })
  const rotationCenterRef = useRef({ x: 0, y: 0 })
  const originalImageSizeRef = useRef<{ width: number; height: number } | null>(null)
  const shapeLayersRef = useRef<ShapeLayer[]>(shapeLayers)
  const activeShapeLayerIdRef = useRef<string | null>(null)
  const isDraggingShapeLayerRef = useRef(false)
  const isResizingShapeLayerRef = useRef(false)
  const isRotatingShapeLayerRef = useRef(false)
  const shapeDragOffsetRef = useRef({ x: 0, y: 0 })
  const shapeResizeHandleRef = useRef<SelectionHandle | null>(null)
  const shapeResizeStartRectRef = useRef<SelectionRect | null>(null)
  const shapeResizeStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const shapeRotationStartAngleRef = useRef(0)
  const shapeRotationBaseAngleRef = useRef(0)
  const isDrawingObjectShapeRef = useRef(false)
  const pendingShapeLayerIdRef = useRef<string | null>(null)
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
    drawGridUtil(ctx, layout)
  }, [layout])

  // Unused function - kept for potential future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const findShapeIndexAtPoint = useCallback(() => -1, [])

  // Unused function - kept for potential future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const prepareShapeSelection = useCallback(
    (shapeIndex: number, clickPos: { x: number; y: number }): boolean => {
      debugLog('Canvas', 'Preparing shape selection', { shapeIndex, clickPos })
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
      originalImageSizeRef.current = { width: region.rect.width, height: region.rect.height }
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
      isDraggingSelectionRef.current = false
      isResizingRef.current = false
      isRotatingRef.current = false
      rotationAngleRef.current = 0
      cumulativeRotationAngleRef.current = 0 // Reset cumulative angle for new selection
      
      // Check if clicking on rotation handle
      if (isRotationHandle(clickPos, region.rect)) {
        isRotatingRef.current = true
        const centerX = region.rect.x + region.rect.width / 2
        const centerY = region.rect.y + region.rect.height / 2
        rotationCenterRef.current = { x: centerX, y: centerY }
        // Calculate initial angle relative to current cumulative rotation (which is 0 for new selection)
        const clickAngle = calculateRotationAngle(rotationCenterRef.current, clickPos)
        initialRotationAngleRef.current = clickAngle - cumulativeRotationAngleRef.current
        rotationAngleRef.current = 0
        resizeHandleRef.current = null
      } else {
        // Check if clicking on resize handle
        resizeHandleRef.current = getHandleAtPoint(clickPos, region.rect)
        if (resizeHandleRef.current) {
          isResizingRef.current = true
          isDraggingSelectionRef.current = false
          resizeStartRef.current = { ...region.rect }
          resizeClickStartRef.current = { x: clickPos.x, y: clickPos.y }
        } else {
          // Otherwise, start dragging
          isDraggingSelectionRef.current = true
          dragOffsetRef.current = {
            x: clickPos.x - region.rect.x,
            y: clickPos.y - region.rect.y,
          }
          resizeHandleRef.current = null
        }
      }
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
    debugLog('Canvas', 'Committing selection')
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      debugWarn('Canvas', 'Cannot commit selection: canvas or context not available')
      return
    }

    if (!selectionImageRef.current || !selectionRectRef.current || !selectionBaseImageRef.current) {
      debugLog('Canvas', 'No selection to commit, clearing state')
      selectionImageRef.current = null
      selectionBaseImageRef.current = null
      selectionOriginalImageRef.current = null
      selectionRectRef.current = null
      isSelectingRef.current = false
      isDraggingSelectionRef.current = false
      isResizingRef.current = false
      isRotatingRef.current = false
      isDraggingShapeLayerRef.current = false
      activeShapeLayerIdRef.current = null
      activeShapeIndexRef.current = null
      resizeHandleRef.current = null
      rotationAngleRef.current = 0
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
    isResizingRef.current = false
    isRotatingRef.current = false
    isDraggingShapeLayerRef.current = false
    activeShapeIndexRef.current = null
    resizeHandleRef.current = null
    rotationAngleRef.current = 0
    cumulativeRotationAngleRef.current = 0
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
    drawShapeLayers(ctx)
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
    if (!canvas || !ctx) {
      debugWarn('Canvas', 'Cannot start drawing: canvas or context not available')
      return
    }

    const pos = getMousePos(e)
    debugLog('Canvas', 'Start drawing', { tool, pos })

    if (tool === 'objectShapes') {
      if (beginShapeLayerInteraction(pos)) {
        setIsDrawing(true)
        return
      }

      if (!shape) return

      setIsDrawing(true)
      setStartPos(pos)
      const layerId = generateLayerId()
      const newLayer: ShapeLayer = {
        id: layerId,
        shape,
        x: pos.x,
        y: pos.y,
        width: 1,
        height: 1,
        rotation: 0,
        strokeColor: '#000000',
        strokeWidth: 2,
        fillColor: null,
      }
      pendingShapeLayerIdRef.current = layerId
      isDrawingObjectShapeRef.current = true
      updateShapeLayers([...shapeLayersRef.current, newLayer])
      repaintCanvas()
      return
    }

    if (tool === 'fill') {
      const hitLayer = hitTestShapeLayers(pos)
      if (hitLayer) {
        const updatedLayers = shapeLayersRef.current.map((layer) =>
          layer.id === hitLayer.id ? { ...layer, fillColor: color } : layer
        )
        updateShapeLayers(updatedLayers)
        repaintCanvas()
        setIsDrawing(false)
        return
      }
    }

    if (tool === 'select') {
      if (beginShapeLayerInteraction(pos)) {
        setIsDrawing(true)
        return
      }
      // No object shape was hit: clear selection/highlight
      activeShapeLayerIdRef.current = null
      isDraggingShapeLayerRef.current = false
      isResizingShapeLayerRef.current = false
      isRotatingShapeLayerRef.current = false
      shapeResizeHandleRef.current = null
      shapeResizeStartRectRef.current = null
      repaintCanvas()
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
    traceShapePath(ctx, shape, startX, startY, endX, endY)
    ctx.stroke()
  }

  const renderShapeLayer = (ctx: CanvasRenderingContext2D, layer: ShapeLayer) => {
    const { x, y, width, height, rotation, strokeColor, strokeWidth, fillColor, shape: layerShape } = layer
    const centerX = x + width / 2
    const centerY = y + height / 2
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(rotation)
    traceShapePath(ctx, layerShape, -width / 2, -height / 2, width / 2, height / 2)
    if (fillColor) {
      ctx.fillStyle = fillColor
      ctx.fill()
    }
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = strokeWidth
    ctx.stroke()
    ctx.restore()
  }

  const drawShapeLayers = useCallback((ctx: CanvasRenderingContext2D) => {
    shapeLayersRef.current.forEach((layer) => {
      renderShapeLayer(ctx, layer)
    })
  }, [])

  const repaintCanvas = useCallback(() => {
    debugLog('Canvas', 'Repainting canvas', { 
      hasPanelData: !!panelData, 
      shapeLayerCount: shapeLayersRef.current.length,
      activeShapeLayerId: activeShapeLayerIdRef.current 
    })
    const canvas = canvasRef.current
    if (!canvas) {
      debugWarn('Canvas', 'Cannot repaint: canvas not available')
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      debugWarn('Canvas', 'Cannot repaint: context not available')
      return
    }
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (panelData) {
      ctx.putImageData(panelData, 0, 0)
    }
    drawGrid(ctx)
    drawShapeLayers(ctx)

    if (activeShapeLayerIdRef.current) {
      const layer = shapeLayersRef.current.find((l) => l.id === activeShapeLayerIdRef.current)
      if (layer) {
        drawSelectionOutline(ctx, layer)
        drawSelectionHandles(ctx, layer)
      }
    }
  }, [panelData, drawGrid, drawShapeLayers])

  const updateShapeLayers = useCallback((layers: ShapeLayer[]) => {
    debugLog('Canvas', 'Updating shape layers', { layerCount: layers.length })
    shapeLayersRef.current = layers
    if (onShapeLayersChange) {
      onShapeLayersChange(layers)
    }
  }, [onShapeLayersChange])

  const generateLayerId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  const hitTestShapeLayers = useCallback((point: { x: number; y: number }): ShapeLayer | null => {
    const layers = shapeLayersRef.current
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i]
      if (
        point.x >= layer.x &&
        point.x <= layer.x + layer.width &&
        point.y >= layer.y &&
        point.y <= layer.y + layer.height
      ) {
        return layer
      }
    }
    return null
  }, [])

  const beginShapeLayerInteraction = useCallback(
    (point: { x: number; y: number }, allowResizeHandles = true): boolean => {
      const hitLayer = hitTestShapeLayers(point)
      if (!hitLayer) {
        return false
      }

      activeShapeLayerIdRef.current = hitLayer.id
      const layerRect: SelectionRect = {
        x: hitLayer.x,
        y: hitLayer.y,
        width: hitLayer.width,
        height: hitLayer.height,
      }

      // Rotation handle has priority
      if (allowResizeHandles && isRotationHandle(point, layerRect)) {
        isRotatingShapeLayerRef.current = true
        isDraggingShapeLayerRef.current = false
        isResizingShapeLayerRef.current = false
        const centerX = layerRect.x + layerRect.width / 2
        const centerY = layerRect.y + layerRect.height / 2
        rotationCenterRef.current = { x: centerX, y: centerY }
        const clickAngle = calculateRotationAngle(rotationCenterRef.current, point)
        shapeRotationStartAngleRef.current = clickAngle
        shapeRotationBaseAngleRef.current = hitLayer.rotation
      } else {
        const handle = allowResizeHandles ? getHandleAtPoint(point, layerRect) : null
        if (handle) {
          // Resize
          isResizingShapeLayerRef.current = true
          isDraggingShapeLayerRef.current = false
          isRotatingShapeLayerRef.current = false
          shapeResizeHandleRef.current = handle
          shapeResizeStartRectRef.current = { ...layerRect }
          shapeResizeStartPosRef.current = { x: point.x, y: point.y }
        } else {
          // Drag
          isDraggingShapeLayerRef.current = true
          isResizingShapeLayerRef.current = false
          isRotatingShapeLayerRef.current = false
          shapeResizeHandleRef.current = null
          shapeResizeStartRectRef.current = null
          shapeDragOffsetRef.current = {
            x: point.x - hitLayer.x,
            y: point.y - hitLayer.y,
          }
        }
      }
      repaintCanvas()
      return true
    },
    [hitTestShapeLayers, repaintCanvas]
  )

  useEffect(() => {
    shapeLayersRef.current = shapeLayers
    repaintCanvas()
  }, [shapeLayers, repaintCanvas])

  useEffect(() => {
    repaintCanvas()
  }, [panelData, repaintCanvas])

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const pos = getMousePos(e)

    if (tool === 'objectShapes' && isDrawingObjectShapeRef.current && pendingShapeLayerIdRef.current) {
    const layerId = pendingShapeLayerIdRef.current
    const width = Math.max(1, Math.abs(pos.x - startPos.x))
    const height = Math.max(1, Math.abs(pos.y - startPos.y))
    const layerX = Math.min(startPos.x, pos.x)
    const layerY = Math.min(startPos.y, pos.y)
    const updatedLayers = shapeLayersRef.current.map((layer) =>
      layer.id === layerId
        ? { ...layer, x: layerX, y: layerY, width, height }
        : layer
    )
    updateShapeLayers(updatedLayers)
    repaintCanvas()
      return
    }

    if (tool === 'select') {
    if (isRotatingShapeLayerRef.current && activeShapeLayerIdRef.current) {
      const layerId = activeShapeLayerIdRef.current
      const currentAngle = calculateRotationAngle(rotationCenterRef.current, pos)
      const delta = currentAngle - shapeRotationStartAngleRef.current
      const updatedLayers = shapeLayersRef.current.map((layer) =>
        layer.id === layerId
          ? { ...layer, rotation: shapeRotationBaseAngleRef.current + delta }
          : layer
      )
      updateShapeLayers(updatedLayers)
      repaintCanvas()
      return
    }

    if (isResizingShapeLayerRef.current && activeShapeLayerIdRef.current && shapeResizeHandleRef.current && shapeResizeStartRectRef.current) {
      const startRect = shapeResizeStartRectRef.current
      const newRect = calculateResizedRect(shapeResizeHandleRef.current, startRect, pos, shapeResizeStartPosRef.current)
      const updatedLayers = shapeLayersRef.current.map((layer) =>
        layer.id === activeShapeLayerIdRef.current
          ? {
              ...layer,
              x: newRect.x,
              y: newRect.y,
              width: newRect.width,
              height: newRect.height,
            }
          : layer
      )
      updateShapeLayers(updatedLayers)
      repaintCanvas()
      return
    }

    if (isDraggingShapeLayerRef.current && activeShapeLayerIdRef.current) {
      const updatedLayers = shapeLayersRef.current.map((layer) =>
        layer.id === activeShapeLayerIdRef.current
          ? {
              ...layer,
              x: clamp(pos.x - shapeDragOffsetRef.current.x, 0, canvas.width - layer.width),
              y: clamp(pos.y - shapeDragOffsetRef.current.y, 0, canvas.height - layer.height),
            }
          : layer
      )
      updateShapeLayers(updatedLayers)
      repaintCanvas()
      return
    }

      if (isSelectingRef.current && selectionOriginalImageRef.current) {
        ctx.putImageData(selectionOriginalImageRef.current, 0, 0)
        const rect = normalizeRect(selectionStartRef.current, pos)
        selectionRectRef.current = rect
        drawSelectionOutline(ctx, rect)
        drawSelectionHandles(ctx, rect)
      } else if (isRotatingRef.current && selectionBaseImageRef.current && selectionImageRef.current && selectionRectRef.current) {
        // Handle rotation
        ctx.putImageData(selectionBaseImageRef.current, 0, 0)
        const rect = selectionRectRef.current
        const centerX = rect.x + rect.width / 2
        const centerY = rect.y + rect.height / 2
        
        const currentAngle = calculateRotationAngle(rotationCenterRef.current, pos)
        rotationAngleRef.current = currentAngle - initialRotationAngleRef.current
        
        // Total rotation angle = accumulated angle + new relative angle
        const totalAngle = cumulativeRotationAngleRef.current + rotationAngleRef.current
        
        // Create temporary canvas for rotation using original image size
        const origWidth = originalImageSizeRef.current?.width || rect.width
        const origHeight = originalImageSizeRef.current?.height || rect.height
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = origWidth
        tempCanvas.height = origHeight
        const tempCtx = tempCanvas.getContext('2d')
        if (tempCtx && selectionImageRef.current && originalImageSizeRef.current) {
          // Use original unrotated image
          tempCtx.putImageData(selectionImageRef.current, 0, 0)
          
          // Calculate bounding box for rotated rectangle using original image size and total angle
          const angle = totalAngle
          const corners = [
            { x: -origWidth / 2, y: -origHeight / 2 },
            { x: origWidth / 2, y: -origHeight / 2 },
            { x: origWidth / 2, y: origHeight / 2 },
            { x: -origWidth / 2, y: origHeight / 2 },
          ]
          
          const rotatedCorners = corners.map(corner => ({
            x: corner.x * Math.cos(angle) - corner.y * Math.sin(angle),
            y: corner.x * Math.sin(angle) + corner.y * Math.cos(angle),
          }))
          
          const minX = Math.min(...rotatedCorners.map(c => c.x))
          const maxX = Math.max(...rotatedCorners.map(c => c.x))
          const minY = Math.min(...rotatedCorners.map(c => c.y))
          const maxY = Math.max(...rotatedCorners.map(c => c.y))
          
          const rotatedWidth = maxX - minX
          const rotatedHeight = maxY - minY
          
          // Draw rotated image
          ctx.save()
          ctx.translate(centerX, centerY)
          ctx.rotate(angle)
          ctx.drawImage(tempCanvas, -origWidth / 2, -origHeight / 2)
          ctx.restore()
          
          drawSelectionOutline(ctx, {
            x: centerX + minX,
            y: centerY + minY,
            width: rotatedWidth,
            height: rotatedHeight,
          })
          drawSelectionHandles(ctx, {
            x: centerX + minX,
            y: centerY + minY,
            width: rotatedWidth,
            height: rotatedHeight,
          })
        }
      } else if (isResizingRef.current && selectionBaseImageRef.current && selectionImageRef.current && selectionRectRef.current && resizeHandleRef.current) {
        // Handle resize
        ctx.putImageData(selectionBaseImageRef.current, 0, 0)
        const startRect = resizeStartRef.current
        const clickStartPos = resizeClickStartRef.current
        const newRect = calculateResizedRect(resizeHandleRef.current, startRect, pos, clickStartPos)
        
        // Clamp to canvas bounds
        newRect.x = clamp(newRect.x, 0, canvas.width)
        newRect.y = clamp(newRect.y, 0, canvas.height)
        newRect.width = Math.min(newRect.width, canvas.width - newRect.x)
        newRect.height = Math.min(newRect.height, canvas.height - newRect.y)
        
        if (newRect.width > 0 && newRect.height > 0) {
          // Scale the image to new size
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = selectionImageRef.current.width
          tempCanvas.height = selectionImageRef.current.height
          const tempCtx = tempCanvas.getContext('2d')
          if (tempCtx) {
            tempCtx.putImageData(selectionImageRef.current, 0, 0)
            
            ctx.save()
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(
              tempCanvas,
              newRect.x,
              newRect.y,
              newRect.width,
              newRect.height
            )
            ctx.restore()
          }
          
          selectionRectRef.current = newRect
          drawSelectionOutline(ctx, newRect)
          drawSelectionHandles(ctx, newRect)
        }
      } else if (
        isDraggingSelectionRef.current &&
        selectionBaseImageRef.current &&
        selectionImageRef.current &&
        selectionRectRef.current
      ) {
        ctx.putImageData(selectionBaseImageRef.current, 0, 0)
        const rect = selectionRectRef.current
        
        // If there's accumulated rotation, apply it when rendering
        if (cumulativeRotationAngleRef.current !== 0 && originalImageSizeRef.current) {
          const origWidth = originalImageSizeRef.current.width
          const origHeight = originalImageSizeRef.current.height
          
          // Calculate new center position based on drag
          const newRect: SelectionRect = {
            ...rect,
            x: clamp(pos.x - dragOffsetRef.current.x, 0, canvas.width - rect.width),
            y: clamp(pos.y - dragOffsetRef.current.y, 0, canvas.height - rect.height),
          }
          const centerX = newRect.x + newRect.width / 2
          const centerY = newRect.y + newRect.height / 2
          
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = origWidth
          tempCanvas.height = origHeight
          const tempCtx = tempCanvas.getContext('2d')
          if (tempCtx) {
            tempCtx.putImageData(selectionImageRef.current, 0, 0)
            
            ctx.save()
            ctx.translate(centerX, centerY)
            ctx.rotate(cumulativeRotationAngleRef.current)
            ctx.drawImage(tempCanvas, -origWidth / 2, -origHeight / 2)
            ctx.restore()
            
            // Calculate bounding box for rotated rectangle
            const angle = cumulativeRotationAngleRef.current
            const corners = [
              { x: -origWidth / 2, y: -origHeight / 2 },
              { x: origWidth / 2, y: -origHeight / 2 },
              { x: origWidth / 2, y: origHeight / 2 },
              { x: -origWidth / 2, y: origHeight / 2 },
            ]
            
            const rotatedCorners = corners.map(corner => ({
              x: corner.x * Math.cos(angle) - corner.y * Math.sin(angle),
              y: corner.x * Math.sin(angle) + corner.y * Math.cos(angle),
            }))
            
            const minX = Math.min(...rotatedCorners.map(c => c.x))
            const maxX = Math.max(...rotatedCorners.map(c => c.x))
            const minY = Math.min(...rotatedCorners.map(c => c.y))
            const maxY = Math.max(...rotatedCorners.map(c => c.y))
            
            const rotatedRect = {
              x: centerX + minX,
              y: centerY + minY,
              width: maxX - minX,
              height: maxY - minY,
            }
            
            selectionRectRef.current = rotatedRect
            drawSelectionOutline(ctx, rotatedRect)
            drawSelectionHandles(ctx, rotatedRect)
          }
        } else {
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

    if (tool === 'objectShapes' && isDrawingObjectShapeRef.current) {
      isDrawingObjectShapeRef.current = false
      pendingShapeLayerIdRef.current = null
      setIsDrawing(false)
      repaintCanvas()
      return
    }

    if (tool === 'select') {
      if (!isDrawing) {
        return
      }

      const pos = getMousePos(e)

      if (isDraggingShapeLayerRef.current || isResizingShapeLayerRef.current || isRotatingShapeLayerRef.current) {
        isDraggingShapeLayerRef.current = false
        isResizingShapeLayerRef.current = false
        isRotatingShapeLayerRef.current = false
        shapeResizeHandleRef.current = null
        shapeResizeStartRectRef.current = null
        setIsDrawing(false)
        repaintCanvas()
        return
      }

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

      if (isRotatingRef.current) {
        isRotatingRef.current = false
        setIsDrawing(false)

        if (selectionBaseImageRef.current && selectionImageRef.current && selectionRectRef.current) {
          ctx.putImageData(selectionBaseImageRef.current, 0, 0)
          const rect = selectionRectRef.current
          const centerX = rect.x + rect.width / 2
          const centerY = rect.y + rect.height / 2
          
          // Apply final rotation
          const origWidth = originalImageSizeRef.current?.width || rect.width
          const origHeight = originalImageSizeRef.current?.height || rect.height
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = origWidth
          tempCanvas.height = origHeight
          const tempCtx = tempCanvas.getContext('2d')
          if (tempCtx && selectionImageRef.current && originalImageSizeRef.current) {
            // Use original unrotated image
            tempCtx.putImageData(selectionImageRef.current, 0, 0)
            
            // Use total angle (accumulated + new)
            const totalAngle = cumulativeRotationAngleRef.current + rotationAngleRef.current
            
            ctx.save()
            ctx.translate(centerX, centerY)
            ctx.rotate(totalAngle)
            ctx.drawImage(tempCanvas, -origWidth / 2, -origHeight / 2)
            ctx.restore()
            
            // Calculate new bounding box using original image size and total angle
            const angle = totalAngle
            const corners = [
              { x: -origWidth / 2, y: -origHeight / 2 },
              { x: origWidth / 2, y: -origHeight / 2 },
              { x: origWidth / 2, y: origHeight / 2 },
              { x: -origWidth / 2, y: origHeight / 2 },
            ]
            
            const rotatedCorners = corners.map(corner => ({
              x: corner.x * Math.cos(angle) - corner.y * Math.sin(angle),
              y: corner.x * Math.sin(angle) + corner.y * Math.cos(angle),
            }))
            
            const minX = Math.min(...rotatedCorners.map(c => c.x))
            const maxX = Math.max(...rotatedCorners.map(c => c.x))
            const minY = Math.min(...rotatedCorners.map(c => c.y))
            const maxY = Math.max(...rotatedCorners.map(c => c.y))
            
            const rotatedRect = {
              x: centerX + minX,
              y: centerY + minY,
              width: maxX - minX,
              height: maxY - minY,
            }
            
            // Extract the rotated image from the canvas to display
            const rotatedImage = ctx.getImageData(rotatedRect.x, rotatedRect.y, rotatedRect.width, rotatedRect.height)
            
            drawGrid(ctx)
            ctx.putImageData(rotatedImage, rotatedRect.x, rotatedRect.y)
            drawSelectionOutline(ctx, rotatedRect)
            drawSelectionHandles(ctx, rotatedRect)
            
            // After committing rotation, update the cumulative angle
            // Keep the original unrotated image in selectionImageRef
            // This way, future rotations will always use the original image with the accumulated angle
            // which prevents the bounding box from growing
            cumulativeRotationAngleRef.current = totalAngle
            rotationAngleRef.current = 0
            selectionRectRef.current = rotatedRect
            // Keep selectionImageRef as the original unrotated image - don't update it!
            
            updateActiveShapeRegion(canvas, ctx, rotatedRect, rotatedImage)
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            onCanvasChange(imageData)
          }
        }
        rotationAngleRef.current = 0
        return
      }

      if (isResizingRef.current) {
        isResizingRef.current = false
        setIsDrawing(false)

        if (selectionBaseImageRef.current && selectionImageRef.current && selectionRectRef.current && resizeHandleRef.current) {
          const newRect = selectionRectRef.current
          
          // Update selection image to new size
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = selectionImageRef.current.width
          tempCanvas.height = selectionImageRef.current.height
          const tempCtx = tempCanvas.getContext('2d')
          if (tempCtx) {
            tempCtx.putImageData(selectionImageRef.current, 0, 0)
            
            ctx.putImageData(selectionBaseImageRef.current, 0, 0)
            ctx.save()
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(
              tempCanvas,
              newRect.x,
              newRect.y,
              newRect.width,
              newRect.height
            )
            ctx.restore()
          }
          
          // Extract resized image
          const resizedImage = ctx.getImageData(newRect.x, newRect.y, newRect.width, newRect.height)
          selectionImageRef.current = resizedImage
          
          drawGrid(ctx)
          ctx.putImageData(resizedImage, newRect.x, newRect.y)
          drawSelectionOutline(ctx, newRect)
          drawSelectionHandles(ctx, newRect)
          updateActiveShapeRegion(canvas, ctx, newRect, resizedImage)
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          onCanvasChange(imageData)
        }
        resizeHandleRef.current = null
        return
      }

      if (isDraggingSelectionRef.current) {
        isDraggingSelectionRef.current = false
        setIsDrawing(false)

        if (selectionBaseImageRef.current && selectionImageRef.current && selectionRectRef.current) {
          ctx.putImageData(selectionBaseImageRef.current, 0, 0)
          const rect = selectionRectRef.current
          
          // If there's accumulated rotation, apply it when committing drag
          if (cumulativeRotationAngleRef.current !== 0 && originalImageSizeRef.current) {
            const origWidth = originalImageSizeRef.current.width
            const origHeight = originalImageSizeRef.current.height
            const centerX = rect.x + rect.width / 2
            const centerY = rect.y + rect.height / 2
            
            const tempCanvas = document.createElement('canvas')
            tempCanvas.width = origWidth
            tempCanvas.height = origHeight
            const tempCtx = tempCanvas.getContext('2d')
            if (tempCtx) {
              tempCtx.putImageData(selectionImageRef.current, 0, 0)
              
              ctx.save()
              ctx.translate(centerX, centerY)
              ctx.rotate(cumulativeRotationAngleRef.current)
              ctx.drawImage(tempCanvas, -origWidth / 2, -origHeight / 2)
              ctx.restore()
              
              // Calculate bounding box
              const angle = cumulativeRotationAngleRef.current
              const corners = [
                { x: -origWidth / 2, y: -origHeight / 2 },
                { x: origWidth / 2, y: -origHeight / 2 },
                { x: origWidth / 2, y: origHeight / 2 },
                { x: -origWidth / 2, y: origHeight / 2 },
              ]
              
              const rotatedCorners = corners.map(corner => ({
                x: corner.x * Math.cos(angle) - corner.y * Math.sin(angle),
                y: corner.x * Math.sin(angle) + corner.y * Math.cos(angle),
              }))
              
              const minX = Math.min(...rotatedCorners.map(c => c.x))
              const maxX = Math.max(...rotatedCorners.map(c => c.x))
              const minY = Math.min(...rotatedCorners.map(c => c.y))
              const maxY = Math.max(...rotatedCorners.map(c => c.y))
              
              const rotatedRect = {
                x: centerX + minX,
                y: centerY + minY,
                width: maxX - minX,
                height: maxY - minY,
              }
              
              const rotatedImage = ctx.getImageData(rotatedRect.x, rotatedRect.y, rotatedRect.width, rotatedRect.height)
              selectionRectRef.current = rotatedRect
              drawSelectionOutline(ctx, rotatedRect)
              drawSelectionHandles(ctx, rotatedRect)
              updateActiveShapeRegion(canvas, ctx, rotatedRect, rotatedImage)
            }
          } else {
            ctx.putImageData(selectionImageRef.current, rect.x, rect.y)
            drawSelectionOutline(ctx, rect)
            drawSelectionHandles(ctx, rect)
            updateActiveShapeRegion(canvas, ctx, rect, selectionImageRef.current)
          }
          
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
      debugLog('Canvas', 'Text submitted', { text: textInput, isBalloon: !!balloonOval })
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) {
        debugError('Canvas', 'Cannot submit text: canvas or context not available')
        return
      }

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
      debugLog('Canvas', 'Text input cancelled')
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

