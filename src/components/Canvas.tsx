import { useEffect, useRef, useState, useCallback } from 'react'
import { Tool, Shape, PenType } from '../App'
import { ShapeLayer, TextLayer } from '../types/layers'
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
  font: string
  fontSize: number
  panelData: ImageData | null
  layout: { rows: number; columns: number[] }
  onCanvasChange: (data: ImageData) => void
  shapeLayers?: ShapeLayer[]
  onShapeLayersChange?: (layers: ShapeLayer[], skipHistory?: boolean) => void
  textLayers?: TextLayer[]
  onTextLayersChange?: (layers: TextLayer[], skipHistory?: boolean) => void
  onTextEditingChange?: (isEditing: boolean) => void
  emoji?: string
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

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max)
}

const MIN_CONTENT_PIXELS = 12

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
    if (r !== undefined && g !== undefined && b !== undefined && a !== undefined && a !== 0 && (r < 250 || g < 250 || b < 250)) {
      count++
    }
  }
  return count
}

const getHandleAtPoint = (point: { x: number; y: number }, rect: SelectionRect, handleSize = 12, rotation: number = 0): SelectionHandle | null => {
  // Use larger hit area than visual handle for easier clicking
  const hitAreaSize = handleSize + 4 // 16 pixels hit area for 12px visual handle
  const half = hitAreaSize / 2
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2

  // Base positions relative to center (same order as drawSelectionHandles)
  const basePositions = [
    { x: -rect.width / 2, y: -rect.height / 2 },      // top-left
    { x: 0, y: -rect.height / 2 },                    // top-center
    { x: rect.width / 2, y: -rect.height / 2 },       // top-right
    { x: -rect.width / 2, y: 0 },                     // middle-left
    { x: rect.width / 2, y: 0 },                      // middle-right
    { x: -rect.width / 2, y: rect.height / 2 },       // bottom-left
    { x: 0, y: rect.height / 2 },                      // bottom-center
    { x: rect.width / 2, y: rect.height / 2 },        // bottom-right
  ]

  const handleTypes: SelectionHandle[] = [
    'top-left',
    'top-center',
    'top-right',
    'middle-left',
    'middle-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ]

  // Rotate positions if needed (same logic as drawSelectionHandles)
  const positions = rotation === 0
    ? basePositions.map(p => ({ x: centerX + p.x, y: centerY + p.y }))
    : basePositions.map(p => {
      const rotatedX = p.x * Math.cos(rotation) - p.y * Math.sin(rotation)
      const rotatedY = p.x * Math.sin(rotation) + p.y * Math.cos(rotation)
      return { x: centerX + rotatedX, y: centerY + rotatedY }
    })

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i]
    const handleType = handleTypes[i]
    if (pos && handleType) {
      if (
        point.x >= pos.x - half &&
        point.x <= pos.x + half &&
        point.y >= pos.y - half &&
        point.y <= pos.y + half
      ) {
        return handleType
      }
    }
  }

  return null
}

const getRotationHandlePos = (rect: SelectionRect, rotation: number = 0): { x: number; y: number } => {
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2
  const offsetX = 0
  const offsetY = -30 // Position above the rectangle

  if (rotation === 0) {
    return {
      x: centerX + offsetX,
      y: centerY + offsetY,
    }
  }

  // Rotate the offset around the center
  const rotatedX = offsetX * Math.cos(rotation) - offsetY * Math.sin(rotation)
  const rotatedY = offsetX * Math.sin(rotation) + offsetY * Math.cos(rotation)

  return {
    x: centerX + rotatedX,
    y: centerY + rotatedY,
  }
}

const isRotationHandle = (point: { x: number; y: number }, rect: SelectionRect, handleSize = 10, rotation: number = 0): boolean => {
  const handlePos = getRotationHandlePos(rect, rotation)
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

const drawSelectionOutline = (ctx: CanvasRenderingContext2D, rect: SelectionRect, rotation: number = 0) => {
  ctx.save()
  ctx.strokeStyle = '#4c6ef5'
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 4])

  if (rotation === 0) {
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width, rect.height)
  } else {
    const centerX = rect.x + rect.width / 2
    const centerY = rect.y + rect.height / 2
    ctx.translate(centerX, centerY)
    ctx.rotate(rotation)
    ctx.strokeRect(-rect.width / 2 + 0.5, -rect.height / 2 + 0.5, rect.width, rect.height)
  }

  ctx.restore()
}

const drawSelectionHandles = (ctx: CanvasRenderingContext2D, rect: SelectionRect, rotation: number = 0) => {
  const handleSize = 12
  const half = handleSize / 2
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2

  // Base positions relative to center
  const basePositions = [
    { x: -rect.width / 2, y: -rect.height / 2 },
    { x: 0, y: -rect.height / 2 },
    { x: rect.width / 2, y: -rect.height / 2 },
    { x: -rect.width / 2, y: 0 },
    { x: rect.width / 2, y: 0 },
    { x: -rect.width / 2, y: rect.height / 2 },
    { x: 0, y: rect.height / 2 },
    { x: rect.width / 2, y: rect.height / 2 },
  ]

  // Rotate positions if needed
  const positions = rotation === 0
    ? basePositions.map(p => ({ x: centerX + p.x, y: centerY + p.y }))
    : basePositions.map(p => {
      const rotatedX = p.x * Math.cos(rotation) - p.y * Math.sin(rotation)
      const rotatedY = p.x * Math.sin(rotation) + p.y * Math.cos(rotation)
      return { x: centerX + rotatedX, y: centerY + rotatedY }
    })

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
  const rotationHandlePos = getRotationHandlePos(rect, rotation)
  ctx.fillStyle = '#4c6ef5'
  ctx.beginPath()
  ctx.arc(rotationHandlePos.x, rotationHandlePos.y, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.stroke()

  // Draw line from center to rotation handle
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
  font,
  fontSize,
  panelData,
  layout,
  onCanvasChange,
  shapeLayers = [],
  onShapeLayersChange,
  textLayers = [],
  onTextLayersChange,
  onTextEditingChange,
  emoji = '😀',
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
  const textLayersRef = useRef<TextLayer[]>(textLayers)
  const activeTextLayerIdRef = useRef<string | null>(null)
  const isDraggingTextLayerRef = useRef(false)
  const isResizingTextLayerRef = useRef(false)
  const isRotatingTextLayerRef = useRef(false)
  const textDragOffsetRef = useRef({ x: 0, y: 0 })
  const textResizeHandleRef = useRef<SelectionHandle | null>(null)
  const textResizeStartRectRef = useRef<SelectionRect | null>(null)
  const textResizeStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const textResizeStartFontSizeRef = useRef<number>(0)
  const textRotationStartAngleRef = useRef(0)
  const textRotationBaseAngleRef = useRef(0)
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number } | null>(null)
  const [textInputScreenPos, setTextInputScreenPos] = useState<{ x: number; y: number } | null>(null)
  const [textInput, setTextInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const editingTextLayerIdRef = useRef<string | null>(null)
  const lastClickTimeRef = useRef(0)
  const lastClickPosRef = useRef<{ x: number; y: number } | null>(null)
  const [balloonOval, setBalloonOval] = useState<{
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
    screenPos: { x: number; y: number };
  } | null>(null)
  const [deleteButtonPos, setDeleteButtonPos] = useState<{ x: number; y: number } | null>(null)
  const [duplicateButtonPos, setDuplicateButtonPos] = useState<{ x: number; y: number } | null>(null)

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    drawGridUtil(ctx, layout)
  }, [layout])

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

  const renderTextLayer = (ctx: CanvasRenderingContext2D, layer: TextLayer) => {
    const canvas = ctx.canvas
    const { x, y, width, height, rotation, text, font: layerFont, fontSize: layerFontSize, color: layerColor } = layer
    const centerX = x + width / 2
    const centerY = y + height / 2

    // Calculate current scale factor for consistent rendering
    // In test environment, getBoundingClientRect may not be available
    let scale = 1
    try {
      const rect = canvas.getBoundingClientRect()
      if (rect && rect.width && rect.height) {
        const scaleX = rect.width / canvas.width
        const scaleY = rect.height / canvas.height
        scale = (scaleX + scaleY) / 2
      }
    } catch {
      // In test environment, use default scale
      scale = 1
    }

    // Scale fontSize to match visual size (layerFontSize is stored in CSS pixels, need to scale up for canvas)
    const scaledFontSize = layerFontSize / scale

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(rotation)
    ctx.fillStyle = layerColor
    ctx.font = `${scaledFontSize}px ${layerFont}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }

  const drawShapeLayers = useCallback((ctx: CanvasRenderingContext2D) => {
    shapeLayersRef.current.forEach((layer) => {
      renderShapeLayer(ctx, layer)
    })
  }, [])

  const drawTextLayers = useCallback((ctx: CanvasRenderingContext2D) => {
    textLayersRef.current.forEach((layer) => {
      renderTextLayer(ctx, layer)
    })
  }, [])

  // Helper function to get background ImageData without layers
  // This ensures we don't save layers into the ImageData
  const getBackgroundImageData = useCallback((): ImageData => {
    const canvas = canvasRef.current
    if (!canvas) {
      throw new Error('Canvas not available')
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas context not available')
    }

    // Create a temporary canvas to render just the background
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) {
      throw new Error('Failed to get temp canvas context')
    }

    // Draw background
    tempCtx.fillStyle = 'white'
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
    if (panelData) {
      tempCtx.putImageData(panelData, 0, 0)
    }
    drawGrid(tempCtx)

    // Return the ImageData without layers
    return tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
  }, [panelData, drawGrid])

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

    // Capture background without layers, then add the selection
    const background = getBackgroundImageData()
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height
    const tempCtx = tempCanvas.getContext('2d')
    if (tempCtx && selectionImageRef.current) {
      tempCtx.putImageData(background, 0, 0)
      tempCtx.putImageData(selectionImageRef.current, rect.x, rect.y)
      const finalImageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height)
      onCanvasChange(finalImageData)
    } else {
      onCanvasChange(background)
    }

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
      // Clear text layer selection when switching away from select tool
      activeTextLayerIdRef.current = null
      activeShapeLayerIdRef.current = null
      repaintCanvas()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    drawTextLayers(ctx)
  }, [panelData, layout, drawGrid, color, penType, drawShapeLayers, drawTextLayers])

  // Track text editing state for parent notification
  // Notify parent when text editing state changes
  useEffect(() => {
    const isEditing = editingTextLayerIdRef.current !== null
    if (onTextEditingChange) {
      onTextEditingChange(isEditing)
    }
  }, [textInputPos, onTextEditingChange])

  // Update editing layer font/fontSize/color in real-time
  useEffect(() => {
    if (editingTextLayerIdRef.current) {
      const canvas = canvasRef.current
      if (!canvas) return

      const editingLayer = textLayersRef.current.find(l => l.id === editingTextLayerIdRef.current)
      if (!editingLayer) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Calculate scale factor for measurement
      const rect = canvas.getBoundingClientRect()
      const scaleX = rect.width / canvas.width
      const scaleY = rect.height / canvas.height
      const scale = (scaleX + scaleY) / 2

      // Scale fontSize for measurement (to get correct dimensions)
      const scaledFontSize = fontSize / scale

      // Measure text with new font/size
      ctx.font = `${scaledFontSize}px ${font}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      const metrics = ctx.measureText(textInput)
      const textWidth = metrics.width
      const textHeight = scaledFontSize * 1.2

      // Update the editing layer
      // Store fontSize in CSS pixels (original, unscaled) for consistency
      const updatedLayers = textLayersRef.current.map((layer) =>
        layer.id === editingTextLayerIdRef.current
          ? {
            ...layer,
            font: font,
            fontSize: fontSize, // Store original CSS pixel size, not scaled
            color: color,
            width: textWidth,
            height: textHeight,
          }
          : layer
      )

      updateTextLayers(updatedLayers, true)
      repaintCanvas()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [font, fontSize, color])

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

    // Check if target color is valid
    if (targetR === undefined || targetG === undefined || targetB === undefined || targetA === undefined) {
      return
    }

    // Parse fill color
    const fillR = parseInt(fillColor.slice(1, 3), 16)
    const fillG = parseInt(fillColor.slice(3, 5), 16)
    const fillB = parseInt(fillColor.slice(5, 7), 16)

    // Helper function to check if a pixel matches the target color (including alpha for erased areas)
    const matchesTargetColor = (r: number | undefined, g: number | undefined, b: number | undefined, a: number | undefined) => {
      if (r === undefined || g === undefined || b === undefined || a === undefined) {
        return false
      }
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
      if (r !== undefined && g !== undefined && b !== undefined && a !== undefined && matchesTargetColor(r, g, b, a)) {
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
        type: 'shape',
        id: layerId,
        shape,
        x: pos.x,
        y: pos.y,
        width: 1,
        height: 1,
        rotation: 0,
        strokeColor: color,
        strokeWidth: 2,
        fillColor: null,
      }
      pendingShapeLayerIdRef.current = layerId
      isDrawingObjectShapeRef.current = true
      // Save history BEFORE creating the new shape
      const currentLayers = [...shapeLayersRef.current]
      if (onShapeLayersChange) {
        onShapeLayersChange(currentLayers, false) // Save current state to history
      }
      // Now add the new layer without saving to history (skipHistory = true)
      updateShapeLayers([...shapeLayersRef.current, newLayer], true)
      repaintCanvas()
      return
    }

    if (tool === 'fill') {
      const hitLayer = hitTestShapeLayers(pos)
      if (hitLayer) {
        const updatedLayers = shapeLayersRef.current.map((layer) =>
          layer.id === hitLayer.id ? { ...layer, fillColor: color } : layer
        )
        // Save history when filling a shape
        updateShapeLayers(updatedLayers, false)
        repaintCanvas()
        setIsDrawing(false)
        return
      }
    }

    if (tool === 'select') {
      // Check for double-click on text layer
      const currentTime = Date.now()
      const isDoubleClick =
        currentTime - lastClickTimeRef.current < 300 &&
        lastClickPosRef.current &&
        Math.abs(pos.x - lastClickPosRef.current.x) < 5 &&
        Math.abs(pos.y - lastClickPosRef.current.y) < 5

      // Try text layers first (they're on top)
      // BUT: If a text layer is already selected, check handles FIRST before checking if we hit a text layer
      // This ensures handles are detected even when clicking on the text itself
      if (activeTextLayerIdRef.current) {
        if (beginTextLayerInteraction(pos)) {
          setIsDrawing(true)
          return
        }
      }

      const hitTextLayer = hitTestTextLayers(pos)
      if (hitTextLayer) {
        if (isDoubleClick && activeTextLayerIdRef.current === hitTextLayer.id) {
          // Double-clicked on selected text layer - start editing
          editingTextLayerIdRef.current = hitTextLayer.id
          setTextInput(hitTextLayer.text)
          setTextInputPos({ x: hitTextLayer.x, y: hitTextLayer.y })
          const rect = canvas.getBoundingClientRect()
          setTextInputScreenPos({
            x: rect.left + (hitTextLayer.x * rect.width) / canvas.width,
            y: rect.top + (hitTextLayer.y * rect.height) / canvas.height,
          })
          setTimeout(() => inputRef.current?.focus(), 0)
          setIsDrawing(false)
          lastClickTimeRef.current = 0
          lastClickPosRef.current = null
          return
        } else {
          // Single click - select the text layer
          lastClickTimeRef.current = currentTime
          lastClickPosRef.current = pos
          if (beginTextLayerInteraction(pos)) {
            setIsDrawing(true)
            return
          }
        }
      } else {
        // No text layer hit, try shape layers
        if (beginShapeLayerInteraction(pos)) {
          setIsDrawing(true)
          return
        }
        // No object was hit: clear selection/highlight
        activeShapeLayerIdRef.current = null
        activeTextLayerIdRef.current = null
        isDraggingShapeLayerRef.current = false
        isResizingShapeLayerRef.current = false
        isRotatingShapeLayerRef.current = false
        isDraggingTextLayerRef.current = false
        isResizingTextLayerRef.current = false
        isRotatingTextLayerRef.current = false
        shapeResizeHandleRef.current = null
        shapeResizeStartRectRef.current = null
        textResizeHandleRef.current = null
        textResizeStartRectRef.current = null
        textResizeStartFontSizeRef.current = 0
        repaintCanvas()
        return
      }
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
      // Capture canvas state after floodFill (which modifies canvas directly)
      // But exclude layers by using getBackgroundImageData and then applying the fill result
      // Get current canvas state (has fill applied, but also has layers)
      const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height)
      // Merge: start with background, then apply only the fill changes
      // We'll use the current state but ensure layers aren't included
      // Since floodFill modifies pixels directly, we can use currentState
      // but we need to exclude layers - layers are drawn on top, so we can't easily separate them
      // For now, use currentState but this might include layers
      // TODO: Better approach would be to track what pixels were filled and only save those
      const imageData = currentState
      onCanvasChange(imageData)
    } else if (tool === 'text') {
      // Check if clicking on existing text layer
      const hitTextLayer = hitTestTextLayers(pos)
      if (hitTextLayer) {
        // If clicking on existing text, allow editing (for now just select it)
        activeTextLayerIdRef.current = hitTextLayer.id
        activeShapeLayerIdRef.current = null
        repaintCanvas()
        setIsDrawing(false)
        return
      }

      // Otherwise, create new text input
      setTextInputPos({ x: pos.x, y: pos.y })
      const rect = canvas.getBoundingClientRect()
      setTextInputScreenPos({
        x: rect.left + (pos.x * rect.width) / canvas.width,
        y: rect.top + (pos.y * rect.height) / canvas.height,
      })
      setTextInput('')
      setIsDrawing(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    } else if (tool === 'emoji') {
      // Create a new text layer with the selected emoji
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx || !onTextLayersChange) {
        setIsDrawing(false)
        return
      }

      // Calculate scale factor for measurement
      const rect = canvas.getBoundingClientRect()
      const scaleX = rect.width / canvas.width
      const scaleY = rect.height / canvas.height
      const scale = (scaleX + scaleY) / 2

      // Scale fontSize for measurement (to get correct dimensions)
      const scaledFontSize = fontSize / scale

      // Measure emoji to determine width and height
      ctx.font = `${scaledFontSize}px ${font}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const metrics = ctx.measureText(emoji)
      const textWidth = Math.max(metrics.width, scaledFontSize)
      const textHeight = scaledFontSize

      // Center emoji at click position
      const textX = pos.x - textWidth / 2
      const textY = pos.y - textHeight / 2

      // Create text layer with emoji
      const layerId = generateLayerId()
      const newLayer: TextLayer = {
        type: 'text',
        id: layerId,
        text: emoji,
        x: textX,
        y: textY,
        width: textWidth,
        height: textHeight,
        rotation: 0,
        font: font,
        fontSize: fontSize, // Store original CSS pixel size, not scaled
        color: color,
      }

      // Save history before creating new emoji layer
      const currentLayers = [...textLayersRef.current]
      if (onTextLayersChange) {
        onTextLayersChange(currentLayers, false)
      }

      // Add the new layer
      updateTextLayers([...textLayersRef.current, newLayer], true)
      repaintCanvas()
      setIsDrawing(false)
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
    drawTextLayers(ctx)

    // Update delete and duplicate button positions when selection changes
    const rect = canvas.getBoundingClientRect()
    const scaleX = rect.width / canvas.width
    const scaleY = rect.height / canvas.height

    if (activeShapeLayerIdRef.current) {
      const layer = shapeLayersRef.current.find((l) => l.id === activeShapeLayerIdRef.current)
      if (layer) {
        // Draw selection outline and handles, accounting for rotation
        drawSelectionOutline(ctx, layer, layer.rotation)
        drawSelectionHandles(ctx, layer, layer.rotation)
        // Position buttons above the selection, centered
        // Position them higher to avoid rotation handle (which is 30px above center)
        const buttonX = layer.x + layer.width / 2
        const buttonY = layer.y - 45 // Higher up to avoid rotation handle
        const buttonSpacing = 35 // Reduced spacing for smaller buttons
        // Delete button on the right
        const newDeletePos = {
          x: rect.left + (buttonX + buttonSpacing) * scaleX,
          y: rect.top + buttonY * scaleY,
        }
        setDeleteButtonPos(prev => {
          if (prev && Math.abs(prev.x - newDeletePos.x) < 0.1 && Math.abs(prev.y - newDeletePos.y) < 0.1) return prev
          return newDeletePos
        })

        // Duplicate button on the left
        const newDuplicatePos = {
          x: rect.left + (buttonX - buttonSpacing) * scaleX,
          y: rect.top + buttonY * scaleY,
        }
        setDuplicateButtonPos(prev => {
          if (prev && Math.abs(prev.x - newDuplicatePos.x) < 0.1 && Math.abs(prev.y - newDuplicatePos.y) < 0.1) return prev
          return newDuplicatePos
        })
      } else {
        setDeleteButtonPos(null)
        setDuplicateButtonPos(null)
      }
    } else if (activeTextLayerIdRef.current) {
      const layer = textLayersRef.current.find((l) => l.id === activeTextLayerIdRef.current)
      if (layer) {
        // Draw selection outline and handles, accounting for rotation
        drawSelectionOutline(ctx, layer, layer.rotation)
        drawSelectionHandles(ctx, layer, layer.rotation)
        // Position buttons above the selection, centered
        // Position them higher to avoid rotation handle (which is 30px above center)
        const buttonX = layer.x + layer.width / 2
        const buttonY = layer.y - 45 // Higher up to avoid rotation handle
        const buttonSpacing = 35 // Reduced spacing for smaller buttons
        // Delete button on the right
        const newDeletePos = {
          x: rect.left + (buttonX + buttonSpacing) * scaleX,
          y: rect.top + buttonY * scaleY,
        }
        setDeleteButtonPos(prev => {
          if (prev && Math.abs(prev.x - newDeletePos.x) < 0.1 && Math.abs(prev.y - newDeletePos.y) < 0.1) return prev
          return newDeletePos
        })

        // Duplicate button on the left
        const newDuplicatePos = {
          x: rect.left + (buttonX - buttonSpacing) * scaleX,
          y: rect.top + buttonY * scaleY,
        }
        setDuplicateButtonPos(prev => {
          if (prev && Math.abs(prev.x - newDuplicatePos.x) < 0.1 && Math.abs(prev.y - newDuplicatePos.y) < 0.1) return prev
          return newDuplicatePos
        })
      } else {
        setDeleteButtonPos(null)
        setDuplicateButtonPos(null)
      }
    } else {
      setDeleteButtonPos(null)
      setDuplicateButtonPos(null)
    }
  }, [panelData, drawShapeLayers, drawTextLayers])

  const updateShapeLayers = useCallback((layers: ShapeLayer[], skipHistory = false) => {
    debugLog('Canvas', 'Updating shape layers', { layerCount: layers.length, skipHistory })
    shapeLayersRef.current = layers
    if (onShapeLayersChange) {
      onShapeLayersChange(layers, skipHistory)
    }
  }, [onShapeLayersChange])

  const updateTextLayers = useCallback((layers: TextLayer[], skipHistory = false) => {
    debugLog('Canvas', 'Updating text layers', { layerCount: layers.length, skipHistory })
    textLayersRef.current = layers
    if (onTextLayersChange) {
      onTextLayersChange(layers, skipHistory)
    }
  }, [onTextLayersChange])

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
      if (layer && (
        point.x >= layer.x &&
        point.x <= layer.x + layer.width &&
        point.y >= layer.y &&
        point.y <= layer.y + layer.height
      )) {
        return layer
      }
    }
    return null
  }, [])

  const hitTestTextLayers = useCallback((point: { x: number; y: number }): TextLayer | null => {
    const layers = textLayersRef.current
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i]
      if (layer && (
        point.x >= layer.x &&
        point.x <= layer.x + layer.width &&
        point.y >= layer.y &&
        point.y <= layer.y + layer.height
      )) {
        return layer
      }
    }
    return null
  }, [])

  const beginShapeLayerInteraction = useCallback(
    (point: { x: number; y: number }, allowResizeHandles = true): boolean => {
      // First, check if we're clicking on handles of the currently selected layer
      // This allows clicking on edge handles even if they're outside the bounding box
      if (allowResizeHandles && activeShapeLayerIdRef.current) {
        const selectedLayer = shapeLayersRef.current.find(l => l.id === activeShapeLayerIdRef.current)
        if (selectedLayer) {
          const layerRect: SelectionRect = {
            x: selectedLayer.x,
            y: selectedLayer.y,
            width: selectedLayer.width,
            height: selectedLayer.height,
          }

          // Check rotation handle first (has priority)
          if (isRotationHandle(point, layerRect, 10, selectedLayer.rotation)) {
            // Save history before starting rotation
            if (onShapeLayersChange) {
              onShapeLayersChange([...shapeLayersRef.current], false)
            }
            isRotatingShapeLayerRef.current = true
            isDraggingShapeLayerRef.current = false
            isResizingShapeLayerRef.current = false
            const centerX = layerRect.x + layerRect.width / 2
            const centerY = layerRect.y + layerRect.height / 2
            rotationCenterRef.current = { x: centerX, y: centerY }
            const clickAngle = calculateRotationAngle(rotationCenterRef.current, point)
            shapeRotationStartAngleRef.current = clickAngle
            shapeRotationBaseAngleRef.current = selectedLayer.rotation
            repaintCanvas()
            return true
          }

          // Check resize handles
          const handle = getHandleAtPoint(point, layerRect, 12, selectedLayer.rotation)
          if (handle) {
            // Save history before starting resize
            if (onShapeLayersChange) {
              onShapeLayersChange([...shapeLayersRef.current], false)
            }
            isResizingShapeLayerRef.current = true
            isDraggingShapeLayerRef.current = false
            isRotatingShapeLayerRef.current = false
            shapeResizeHandleRef.current = handle
            shapeResizeStartRectRef.current = { ...layerRect }
            shapeResizeStartPosRef.current = { x: point.x, y: point.y }
            repaintCanvas()
            return true
          }
        }
      }

      // If no handle was hit, check if point hits any layer's bounding box
      const hitLayer = hitTestShapeLayers(point)
      if (!hitLayer) {
        return false
      }

      activeShapeLayerIdRef.current = hitLayer.id
      activeTextLayerIdRef.current = null
      const layerRect: SelectionRect = {
        x: hitLayer.x,
        y: hitLayer.y,
        width: hitLayer.width,
        height: hitLayer.height,
      }

      // Rotation handle has priority
      if (allowResizeHandles && isRotationHandle(point, layerRect, 10, hitLayer.rotation)) {
        // Save history before starting rotation
        if (onShapeLayersChange) {
          onShapeLayersChange([...shapeLayersRef.current], false)
        }
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
        const handle = allowResizeHandles ? getHandleAtPoint(point, layerRect, 12, hitLayer.rotation) : null
        if (handle) {
          // Resize - save history before starting resize
          if (onShapeLayersChange) {
            onShapeLayersChange([...shapeLayersRef.current], false)
          }
          isResizingShapeLayerRef.current = true
          isDraggingShapeLayerRef.current = false
          isRotatingShapeLayerRef.current = false
          shapeResizeHandleRef.current = handle
          shapeResizeStartRectRef.current = { ...layerRect }
          shapeResizeStartPosRef.current = { x: point.x, y: point.y }
        } else {
          // Drag - save history before starting drag
          if (onShapeLayersChange) {
            onShapeLayersChange([...shapeLayersRef.current], false)
          }
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
    [hitTestShapeLayers, repaintCanvas, onShapeLayersChange]
  )

  const beginTextLayerInteraction = useCallback(
    (point: { x: number; y: number }, allowResizeHandles = true): boolean => {
      // First, check if we're clicking on handles of the currently selected layer
      // This allows clicking on edge handles even if they're outside the bounding box
      if (allowResizeHandles && activeTextLayerIdRef.current) {
        const selectedLayer = textLayersRef.current.find(l => l.id === activeTextLayerIdRef.current)
        if (selectedLayer) {
          const layerRect: SelectionRect = {
            x: selectedLayer.x,
            y: selectedLayer.y,
            width: selectedLayer.width,
            height: selectedLayer.height,
          }

          // Check rotation handle first (has priority)
          if (isRotationHandle(point, layerRect, 10, selectedLayer.rotation)) {
            // Save history before starting rotation
            if (onTextLayersChange) {
              onTextLayersChange([...textLayersRef.current], false)
            }
            isRotatingTextLayerRef.current = true
            isDraggingTextLayerRef.current = false
            isResizingTextLayerRef.current = false
            const centerX = layerRect.x + layerRect.width / 2
            const centerY = layerRect.y + layerRect.height / 2
            rotationCenterRef.current = { x: centerX, y: centerY }
            const clickAngle = calculateRotationAngle(rotationCenterRef.current, point)
            textRotationStartAngleRef.current = clickAngle
            textRotationBaseAngleRef.current = selectedLayer.rotation
            repaintCanvas()
            return true
          }

          // Check resize handles
          const handle = getHandleAtPoint(point, layerRect, 12, selectedLayer.rotation)
          if (handle) {
            // Save history before starting resize
            if (onTextLayersChange) {
              onTextLayersChange([...textLayersRef.current], false)
            }
            isResizingTextLayerRef.current = true
            isDraggingTextLayerRef.current = false
            isRotatingTextLayerRef.current = false
            textResizeHandleRef.current = handle
            textResizeStartRectRef.current = { ...layerRect }
            textResizeStartPosRef.current = { x: point.x, y: point.y }
            textResizeStartFontSizeRef.current = selectedLayer.fontSize
            repaintCanvas()
            return true
          }
        }
      }

      // If no handle was hit, check if point hits any layer's bounding box
      const hitLayer = hitTestTextLayers(point)
      if (!hitLayer) {
        return false
      }

      activeTextLayerIdRef.current = hitLayer.id
      activeShapeLayerIdRef.current = null
      const layerRect: SelectionRect = {
        x: hitLayer.x,
        y: hitLayer.y,
        width: hitLayer.width,
        height: hitLayer.height,
      }

      // Rotation handle has priority
      if (allowResizeHandles && isRotationHandle(point, layerRect, 10, hitLayer.rotation)) {
        // Save history before starting rotation
        if (onTextLayersChange) {
          onTextLayersChange([...textLayersRef.current], false)
        }
        isRotatingTextLayerRef.current = true
        isDraggingTextLayerRef.current = false
        isResizingTextLayerRef.current = false
        const centerX = layerRect.x + layerRect.width / 2
        const centerY = layerRect.y + layerRect.height / 2
        rotationCenterRef.current = { x: centerX, y: centerY }
        const clickAngle = calculateRotationAngle(rotationCenterRef.current, point)
        textRotationStartAngleRef.current = clickAngle
        textRotationBaseAngleRef.current = hitLayer.rotation
      } else {
        const handle = allowResizeHandles ? getHandleAtPoint(point, layerRect, 12, hitLayer.rotation) : null
        if (handle) {
          // Resize - save history before starting resize
          if (onTextLayersChange) {
            onTextLayersChange([...textLayersRef.current], false)
          }
          isResizingTextLayerRef.current = true
          isDraggingTextLayerRef.current = false
          isRotatingTextLayerRef.current = false
          textResizeHandleRef.current = handle
          textResizeStartRectRef.current = { ...layerRect }
          textResizeStartPosRef.current = { x: point.x, y: point.y }
          textResizeStartFontSizeRef.current = hitLayer.fontSize
        } else {
          // Drag - save history before starting drag
          if (onTextLayersChange) {
            onTextLayersChange([...textLayersRef.current], false)
          }
          isDraggingTextLayerRef.current = true
          isResizingTextLayerRef.current = false
          isRotatingTextLayerRef.current = false
          textResizeHandleRef.current = null
          textResizeStartRectRef.current = null
          textDragOffsetRef.current = {
            x: point.x - hitLayer.x,
            y: point.y - hitLayer.y,
          }
        }
      }
      repaintCanvas()
      return true
    },
    [hitTestTextLayers, repaintCanvas, onTextLayersChange]
  )

  useEffect(() => {
    shapeLayersRef.current = shapeLayers
    repaintCanvas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeLayers])

  useEffect(() => {
    textLayersRef.current = textLayers
    repaintCanvas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textLayers])

  useEffect(() => {
    repaintCanvas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repaintCanvas])

  useEffect(() => {
    repaintCanvas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelData])

  const handleDelete = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Check if a shape layer is selected
    if (activeShapeLayerIdRef.current) {
      const layerId = activeShapeLayerIdRef.current
      // Save history before deletion
      if (onShapeLayersChange) {
        onShapeLayersChange([...shapeLayersRef.current], false)
      }
      // Remove the layer
      const updatedLayers = shapeLayersRef.current.filter((layer) => layer.id !== layerId)
      updateShapeLayers(updatedLayers, true)
      // Clear selection
      activeShapeLayerIdRef.current = null
      repaintCanvas()
      return
    }

    // Check if a text layer is selected
    if (activeTextLayerIdRef.current) {
      const layerId = activeTextLayerIdRef.current
      // Save history before deletion
      if (onTextLayersChange) {
        onTextLayersChange([...textLayersRef.current], false)
      }
      // Remove the layer
      const updatedLayers = textLayersRef.current.filter((layer) => layer.id !== layerId)
      updateTextLayers(updatedLayers, true)
      // Clear selection
      activeTextLayerIdRef.current = null
      repaintCanvas()
      return
    }
  }, [updateShapeLayers, updateTextLayers, onShapeLayersChange, onTextLayersChange, repaintCanvas])

  const handleDuplicate = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const DUPLICATE_OFFSET = 30 // Offset in pixels for the duplicate

    // Check if a shape layer is selected
    if (activeShapeLayerIdRef.current) {
      const layerId = activeShapeLayerIdRef.current
      const originalLayer = shapeLayersRef.current.find((layer) => layer.id === layerId)
      if (!originalLayer) return

      // Save history before duplication
      if (onShapeLayersChange) {
        onShapeLayersChange([...shapeLayersRef.current], false)
      }

      // Create duplicate with new ID and offset position
      const duplicatedLayer: ShapeLayer = {
        ...originalLayer,
        type: 'shape',
        id: generateLayerId(),
        x: Math.min(originalLayer.x + DUPLICATE_OFFSET, canvas.width - originalLayer.width),
        y: Math.min(originalLayer.y + DUPLICATE_OFFSET, canvas.height - originalLayer.height),
      }

      // Add the duplicated layer
      const updatedLayers = [...shapeLayersRef.current, duplicatedLayer]
      updateShapeLayers(updatedLayers, true)

      // Select the new duplicated layer
      activeShapeLayerIdRef.current = duplicatedLayer.id
      activeTextLayerIdRef.current = null
      repaintCanvas()
      return
    }

    // Check if a text layer is selected
    if (activeTextLayerIdRef.current) {
      const layerId = activeTextLayerIdRef.current
      const originalLayer = textLayersRef.current.find((layer) => layer.id === layerId)
      if (!originalLayer) return

      // Save history before duplication
      if (onTextLayersChange) {
        onTextLayersChange([...textLayersRef.current], false)
      }

      // Create duplicate with new ID and offset position
      const duplicatedLayer: TextLayer = {
        ...originalLayer,
        type: 'text',
        id: generateLayerId(),
        x: Math.min(originalLayer.x + DUPLICATE_OFFSET, canvas.width - originalLayer.width),
        y: Math.min(originalLayer.y + DUPLICATE_OFFSET, canvas.height - originalLayer.height),
      }

      // Add the duplicated layer
      const updatedLayers = [...textLayersRef.current, duplicatedLayer]
      updateTextLayers(updatedLayers, true)

      // Select the new duplicated layer
      activeTextLayerIdRef.current = duplicatedLayer.id
      activeShapeLayerIdRef.current = null
      repaintCanvas()
      return
    }
  }, [updateShapeLayers, updateTextLayers, onShapeLayersChange, onTextLayersChange, repaintCanvas])

  // Keyboard event handler for Delete/Backspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle delete if we're in select mode and not typing in an input
      if (tool !== 'select') return
      if (e.target instanceof HTMLInputElement) return

      // Delete or Backspace key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        handleDelete()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [tool, handleDelete])

  // Update delete button position on window resize
  useEffect(() => {
    const handleResize = () => {
      if (activeShapeLayerIdRef.current || activeTextLayerIdRef.current) {
        repaintCanvas()
      }
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [repaintCanvas])

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
      // Skip history during drawing - we already saved when shape creation started
      updateShapeLayers(updatedLayers, true)
      repaintCanvas()
      return
    }

    if (tool === 'select') {
      // Handle text layer interactions
      if (isRotatingTextLayerRef.current && activeTextLayerIdRef.current) {
        const layerId = activeTextLayerIdRef.current
        const currentAngle = calculateRotationAngle(rotationCenterRef.current, pos)
        const delta = currentAngle - textRotationStartAngleRef.current
        const updatedLayers = textLayersRef.current.map((layer) =>
          layer.id === layerId
            ? { ...layer, rotation: textRotationBaseAngleRef.current + delta }
            : layer
        )
        updateTextLayers(updatedLayers, true)
        repaintCanvas()
        return
      }

      if (isResizingTextLayerRef.current && activeTextLayerIdRef.current && textResizeHandleRef.current && textResizeStartRectRef.current) {
        const startRect = textResizeStartRectRef.current
        const handle = textResizeHandleRef.current
        const newRect = calculateResizedRect(handle, startRect, pos, textResizeStartPosRef.current)

        // Calculate scale factors from width and height changes
        const scaleX = startRect.width > 0 ? newRect.width / startRect.width : 1
        const scaleY = startRect.height > 0 ? newRect.height / startRect.height : 1
        // Use average scale to maintain reasonable proportions
        const scale = (scaleX + scaleY) / 2

        // Calculate new fontSize based on scale
        const newFontSize = Math.max(1, textResizeStartFontSizeRef.current * scale)

        const updatedLayers = textLayersRef.current.map((layer) =>
          layer.id === activeTextLayerIdRef.current
            ? {
              ...layer,
              x: newRect.x,
              y: newRect.y,
              width: Math.max(1, newRect.width),
              height: Math.max(1, newRect.height),
              fontSize: newFontSize,
            }
            : layer
        )
        updateTextLayers(updatedLayers, true)
        repaintCanvas()
        return
      }

      if (isDraggingTextLayerRef.current && activeTextLayerIdRef.current) {
        const updatedLayers = textLayersRef.current.map((layer) =>
          layer.id === activeTextLayerIdRef.current
            ? {
              ...layer,
              x: clamp(pos.x - textDragOffsetRef.current.x, 0, canvas.width - layer.width),
              y: clamp(pos.y - textDragOffsetRef.current.y, 0, canvas.height - layer.height),
            }
            : layer
        )
        updateTextLayers(updatedLayers, true)
        repaintCanvas()
        return
      }

      // Handle shape layer interactions
      if (isRotatingShapeLayerRef.current && activeShapeLayerIdRef.current) {
        const layerId = activeShapeLayerIdRef.current
        const currentAngle = calculateRotationAngle(rotationCenterRef.current, pos)
        const delta = currentAngle - shapeRotationStartAngleRef.current
        const updatedLayers = shapeLayersRef.current.map((layer) =>
          layer.id === layerId
            ? { ...layer, rotation: shapeRotationBaseAngleRef.current + delta }
            : layer
        )
        // Skip history during rotation drag - history saved when rotation starts
        updateShapeLayers(updatedLayers, true)
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
        // Skip history during resize drag - history saved when resize starts
        updateShapeLayers(updatedLayers, true)
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
        // Skip history during drag - history saved when drag starts
        updateShapeLayers(updatedLayers, true)
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

      if (isDraggingTextLayerRef.current || isResizingTextLayerRef.current || isRotatingTextLayerRef.current) {
        isDraggingTextLayerRef.current = false
        isResizingTextLayerRef.current = false
        isRotatingTextLayerRef.current = false
        textResizeHandleRef.current = null
        textResizeStartRectRef.current = null
        textResizeStartFontSizeRef.current = 0
        setIsDrawing(false)
        repaintCanvas()
        return
      }

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
          // Create temp canvas and context for rotation
          const rotationCanvas = document.createElement('canvas')
          rotationCanvas.width = origWidth
          rotationCanvas.height = origHeight
          const rotationCtx = rotationCanvas.getContext('2d')
          if (rotationCtx && selectionImageRef.current && originalImageSizeRef.current) {
            // Use original unrotated image
            rotationCtx.putImageData(selectionImageRef.current, 0, 0)

            // Use total angle (accumulated + new)
            const totalAngle = cumulativeRotationAngleRef.current + rotationAngleRef.current

            ctx.save()
            ctx.translate(centerX, centerY)
            ctx.rotate(totalAngle)
            ctx.drawImage(rotationCanvas, -origWidth / 2, -origHeight / 2)
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

            // Capture background without layers, then add the selection
            const background = getBackgroundImageData()
            const tempCanvas = document.createElement('canvas')
            tempCanvas.width = canvas.width
            tempCanvas.height = canvas.height
            const tempCtx = tempCanvas.getContext('2d')
            if (tempCtx) {
              tempCtx.putImageData(background, 0, 0)
              // Add the rotated selection
              const origWidth = originalImageSizeRef.current?.width || rect.width
              const origHeight = originalImageSizeRef.current?.height || rect.height
              const centerX = rect.x + rect.width / 2
              const centerY = rect.y + rect.height / 2
              const selectionCanvas = document.createElement('canvas')
              selectionCanvas.width = origWidth
              selectionCanvas.height = origHeight
              const selectionCtx = selectionCanvas.getContext('2d')
              if (selectionCtx && selectionImageRef.current) {
                selectionCtx.putImageData(selectionImageRef.current, 0, 0)
                tempCtx.save()
                tempCtx.translate(centerX, centerY)
                tempCtx.rotate(totalAngle)
                tempCtx.drawImage(selectionCanvas, -origWidth / 2, -origHeight / 2)
                tempCtx.restore()
              }
              const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height)
              onCanvasChange(imageData)
            } else {
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
              onCanvasChange(imageData)
            }
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

          // Capture background without layers, then add the resized selection
          const background = getBackgroundImageData()
          const backgroundCanvas = document.createElement('canvas')
          backgroundCanvas.width = canvas.width
          backgroundCanvas.height = canvas.height
          const backgroundCtx = backgroundCanvas.getContext('2d')
          if (backgroundCtx) {
            backgroundCtx.putImageData(background, 0, 0)
            // Add the resized selection
            const selectionCanvas = document.createElement('canvas')
            selectionCanvas.width = selectionImageRef.current.width
            selectionCanvas.height = selectionImageRef.current.height
            const selectionCtx = selectionCanvas.getContext('2d')
            if (selectionCtx) {
              selectionCtx.putImageData(selectionImageRef.current, 0, 0)
              backgroundCtx.save()
              backgroundCtx.imageSmoothingEnabled = true
              backgroundCtx.imageSmoothingQuality = 'high'
              backgroundCtx.drawImage(selectionCanvas, newRect.x, newRect.y, newRect.width, newRect.height)
              backgroundCtx.restore()
            }
            const imageData = backgroundCtx.getImageData(0, 0, canvas.width, canvas.height)
            onCanvasChange(imageData)
          } else {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            onCanvasChange(imageData)
          }
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

          // Capture background without layers, then add the dragged selection
          const background = getBackgroundImageData()
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = canvas.width
          tempCanvas.height = canvas.height
          const tempCtx = tempCanvas.getContext('2d')
          if (tempCtx && selectionImageRef.current) {
            tempCtx.putImageData(background, 0, 0)
            // Add the selection at its current position
            if (cumulativeRotationAngleRef.current !== 0 && originalImageSizeRef.current) {
              // Handle rotated selection
              const origWidth = originalImageSizeRef.current.width
              const origHeight = originalImageSizeRef.current.height
              const centerX = rect.x + rect.width / 2
              const centerY = rect.y + rect.height / 2
              const selectionCanvas = document.createElement('canvas')
              selectionCanvas.width = origWidth
              selectionCanvas.height = origHeight
              const selectionCtx = selectionCanvas.getContext('2d')
              if (selectionCtx) {
                selectionCtx.putImageData(selectionImageRef.current, 0, 0)
                tempCtx.save()
                tempCtx.translate(centerX, centerY)
                tempCtx.rotate(cumulativeRotationAngleRef.current)
                tempCtx.drawImage(selectionCanvas, -origWidth / 2, -origHeight / 2)
                tempCtx.restore()
              }
            } else {
              // Handle non-rotated selection
              tempCtx.putImageData(selectionImageRef.current, rect.x, rect.y)
            }
            const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height)
            onCanvasChange(imageData)
          } else {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            onCanvasChange(imageData)
          }
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

    // Capture pen/eraser strokes without layers
    // The canvas currently has: background + layers + pen strokes
    // We want to save: background + pen strokes (without layers)
    // Solution: Get background, then extract only the pen stroke pixels from current canvas
    const background = getBackgroundImageData()
    const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // Create a new ImageData with background, then add only pen strokes
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height
    const tempCtx = tempCanvas.getContext('2d')
    if (tempCtx) {
      // Start with clean background
      tempCtx.putImageData(background, 0, 0)

      // Extract pen strokes by comparing current state with background
      // For each pixel, if it's different from background and not a layer pixel, keep it
      const bgData = background.data
      const currData = currentState.data
      const resultData = new Uint8ClampedArray(bgData)

      // Get layer bounds to exclude layer pixels
      const layerBounds = new Set<string>()
      shapeLayersRef.current.forEach(layer => {
        for (let y = Math.floor(layer.y); y < Math.ceil(layer.y + layer.height); y++) {
          for (let x = Math.floor(layer.x); x < Math.ceil(layer.x + layer.width); x++) {
            if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
              layerBounds.add(`${x},${y}`)
            }
          }
        }
      })
      textLayersRef.current.forEach(layer => {
        for (let y = Math.floor(layer.y); y < Math.ceil(layer.y + layer.height); y++) {
          for (let x = Math.floor(layer.x); x < Math.ceil(layer.x + layer.width); x++) {
            if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
              layerBounds.add(`${x},${y}`)
            }
          }
        }
      })

      // Copy pen strokes (pixels that differ from background and aren't in layer bounds)
      for (let i = 0; i < currData.length; i += 4) {
        const x = (i / 4) % canvas.width
        const y = Math.floor((i / 4) / canvas.width)
        const pixelKey = `${x},${y}`

        // If pixel is different from background and not in a layer area, it's a pen stroke
        if (!layerBounds.has(pixelKey)) {
          const bgR = bgData[i]
          const bgG = bgData[i + 1]
          const bgB = bgData[i + 2]
          const bgA = bgData[i + 3]
          const currR = currData[i]
          const currG = currData[i + 1]
          const currB = currData[i + 2]
          const currA = currData[i + 3]

          // If pixel differs significantly from background, it's a pen stroke
          if (bgR !== undefined && bgG !== undefined && bgB !== undefined && bgA !== undefined &&
            currR !== undefined && currG !== undefined && currB !== undefined && currA !== undefined &&
            (Math.abs(bgR - currR) > 5 || Math.abs(bgG - currG) > 5 ||
              Math.abs(bgB - currB) > 5 || Math.abs(bgA - currA) > 5)) {
            resultData[i] = currR
            resultData[i + 1] = currG
            resultData[i + 2] = currB
            resultData[i + 3] = currA
          }
        }
      }

      const finalImageData = new ImageData(resultData, canvas.width, canvas.height)
      tempCtx.putImageData(finalImageData, 0, 0)
      const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height)
      onCanvasChange(imageData)
    } else {
      // Fallback: use current state (may include layers, but better than nothing)
      onCanvasChange(currentState)
    }
  }

  const handleTextSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && textInputPos) {
      debugLog('Canvas', 'Text submitted', { text: textInput, isBalloon: !!balloonOval, editingLayerId: editingTextLayerIdRef.current })
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) {
        debugError('Canvas', 'Cannot submit text: canvas or context not available')
        return
      }

      // Check if we're editing an existing text layer
      if (editingTextLayerIdRef.current) {
        const existingLayer = textLayersRef.current.find(l => l.id === editingTextLayerIdRef.current)
        if (existingLayer) {
          // Calculate scale factor for measurement
          const rect = canvas.getBoundingClientRect()
          const scaleX = rect.width / canvas.width
          const scaleY = rect.height / canvas.height
          const scale = (scaleX + scaleY) / 2

          // Scale fontSize for measurement (to get correct dimensions)
          const scaledFontSize = fontSize / scale

          // Measure text to determine new width and height using current font settings
          ctx.font = `${scaledFontSize}px ${font}`
          ctx.textAlign = 'left'
          ctx.textBaseline = 'top'
          const metrics = ctx.measureText(textInput)
          const textWidth = metrics.width
          const textHeight = scaledFontSize * 1.2

          // Update existing layer with current font/fontSize/color settings
          // Store fontSize in CSS pixels (original, unscaled) for consistency
          const updatedLayers = textLayersRef.current.map((layer) =>
            layer.id === editingTextLayerIdRef.current
              ? {
                ...layer,
                text: textInput,
                font: font,
                fontSize: fontSize, // Store original CSS pixel size, not scaled
                color: color,
                width: textWidth,
                height: textHeight,
              }
              : layer
          )

          // Save history before updating text layer
          const currentLayers = [...textLayersRef.current]
          if (onTextLayersChange) {
            onTextLayersChange(currentLayers, false)
          }

          updateTextLayers(updatedLayers, true)
          repaintCanvas()

          // Clear editing state
          editingTextLayerIdRef.current = null
          setTextInputPos(null)
          setTextInputScreenPos(null)
          setTextInput('')
          setBalloonOval(null)
          return
        }
      }

      // Create new text layer (only if text is not empty)
      if (!textInput.trim()) {
        // Empty text - just cancel
        setTextInputPos(null)
        setTextInputScreenPos(null)
        setTextInput('')
        setBalloonOval(null)
        return
      }

      // Measure text to determine width and height
      // Calculate scale factor to measure text correctly
      const rect = canvas.getBoundingClientRect()
      const scaleX = rect.width / canvas.width
      const scaleY = rect.height / canvas.height
      const scale = (scaleX + scaleY) / 2

      // Scale fontSize for measurement (to get correct dimensions)
      const scaledFontSize = fontSize / scale

      ctx.font = `${scaledFontSize}px ${font}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      const metrics = ctx.measureText(textInput)
      const textWidth = metrics.width
      const textHeight = scaledFontSize * 1.2 // Approximate line height

      // Calculate position and size
      let textX: number
      let textY: number
      let textW: number
      let textH: number

      if (balloonOval) {
        // Center text in balloon
        textX = balloonOval.centerX - textWidth / 2
        textY = balloonOval.centerY - textHeight / 2
        textW = textWidth
        textH = textHeight
      } else {
        // Use click position as top-left
        textX = textInputPos.x
        textY = textInputPos.y
        textW = textWidth
        textH = textHeight
      }

      // Create text layer
      // Store fontSize in CSS pixels (original, unscaled) for consistency
      const layerId = generateLayerId()
      const newLayer: TextLayer = {
        type: 'text',
        id: layerId,
        text: textInput,
        x: textX,
        y: textY,
        width: textW,
        height: textH,
        rotation: 0,
        font: font,
        fontSize: fontSize, // Store original CSS pixel size, not scaled
        color: color,
      }

      // Save history before creating new text layer
      const currentLayers = [...textLayersRef.current]
      if (onTextLayersChange) {
        onTextLayersChange(currentLayers, false)
      }

      // Add the new layer
      updateTextLayers([...textLayersRef.current, newLayer], true)
      repaintCanvas()

      // Hide input
      setTextInputPos(null)
      setTextInputScreenPos(null)
      setTextInput('')
      setBalloonOval(null)
      editingTextLayerIdRef.current = null
    } else if (e.key === 'Escape') {
      debugLog('Canvas', 'Text input cancelled')
      editingTextLayerIdRef.current = null
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
      {textInputPos && textInputScreenPos && (() => {
        const editingLayer = editingTextLayerIdRef.current
          ? textLayersRef.current.find(l => l.id === editingTextLayerIdRef.current)
          : null
        // When editing, use current font/fontSize/color props (they update the layer in real-time)
        // When creating new text, use the props directly
        const inputFont = editingLayer ? font : font
        const inputFontSize = fontSize // Always use current fontSize prop (CSS pixels)
        const inputColor = editingLayer ? color : color

        return (
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
              fontSize: `${inputFontSize}px`,
              fontFamily: inputFont,
              color: inputColor,
              outline: 'none',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              zIndex: 1000,
            }}
          />
        )
      })()}
      {duplicateButtonPos && tool === 'select' && (activeShapeLayerIdRef.current || activeTextLayerIdRef.current) && (
        <button
          onClick={handleDuplicate}
          style={{
            position: 'fixed',
            left: `${duplicateButtonPos.x}px`,
            top: `${duplicateButtonPos.y}px`,
            transform: 'translateX(-50%)',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            padding: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            zIndex: 1001,
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#2563eb'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#3b82f6'
          }}
          title="Duplicate"
        >
          📋
        </button>
      )}
      {deleteButtonPos && tool === 'select' && (activeShapeLayerIdRef.current || activeTextLayerIdRef.current) && (
        <button
          onClick={handleDelete}
          style={{
            position: 'fixed',
            left: `${deleteButtonPos.x}px`,
            top: `${deleteButtonPos.y}px`,
            transform: 'translateX(-50%)',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            padding: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            zIndex: 1001,
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#dc2626'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ef4444'
          }}
          title="Delete (Delete/Backspace)"
        >
          🗑️
        </button>
      )}
    </div>
  )
}

