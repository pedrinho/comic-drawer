import { useEffect, useRef, useState, useCallback } from 'react'
import { Tool, Shape, PenType } from '../App'
import './Canvas.css'

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

export default function Canvas({ tool, shape, penType, color, panelData, layout, onCanvasChange }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const savedImageRef = useRef<ImageData | null>(null)
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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = 1200
    canvas.height = 800

    // Set drawing styles
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

    // Parse fill color
    const fillR = parseInt(fillColor.slice(1, 3), 16)
    const fillG = parseInt(fillColor.slice(3, 5), 16)
    const fillB = parseInt(fillColor.slice(5, 7), 16)

    // Helper function to check if a pixel matches the target color
    const matchesTargetColor = (r: number, g: number, b: number) => {
      const tolerance = 10 // Allow small differences for antialiasing
      return Math.abs(r - targetR) <= tolerance && 
             Math.abs(g - targetG) <= tolerance && 
             Math.abs(b - targetB) <= tolerance
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

      // Fill pixels that match the target color (where we clicked)
      if (matchesTargetColor(r, g, b)) {
        // Fill this pixel
        data[index] = fillR
        data[index + 1] = fillG
        data[index + 2] = fillB

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
    setStartPos(pos)
    setIsDrawing(true)

    if (tool === 'pen') {
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    } else if (tool === 'fill') {
      // Fill tool is instant on click
      floodFill(ctx, pos.x, pos.y, color)
      
      // Redraw grid on top after fill
      drawGrid(ctx)
      
      setIsDrawing(false)
      
      // Save immediately after fill
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      onCanvasChange(imageData)
    } else if (tool === 'text') {
      // Show text input at clicked position
      setTextInputPos({ x: pos.x, y: pos.y })
      // Get screen position for the input
      const rect = canvas.getBoundingClientRect()
      setTextInputScreenPos({ 
        x: rect.left + (pos.x * rect.width / canvas.width), 
        y: rect.top + (pos.y * rect.height / canvas.height)
      })
      setTextInput('')
      setIsDrawing(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    } else if (tool === 'shapes' || tool === 'balloon') {
      // Save the current canvas state for live preview
      savedImageRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
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

    if (tool === 'pen') {
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    } else if (tool === 'eraser') {
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = 20
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      ctx.restore()
    } else if (tool === 'shapes' || tool === 'balloon') {
      // Restore saved canvas and draw preview
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
        
        // Draw balloon tail (small triangle pointing down)
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
    if (!isDrawing) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const pos = getMousePos(e)

    if (tool === 'shapes' && shape) {
      drawShape(ctx, shape, startPos.x, startPos.y, pos.x, pos.y)
    } else if (tool === 'balloon') {
      // Draw balloon oval
      ctx.beginPath()
      const radiusX = Math.abs(pos.x - startPos.x) / 2
      const radiusY = Math.abs(pos.y - startPos.y) / 2
      const centerX = (startPos.x + pos.x) / 2
      const centerY = (startPos.y + pos.y) / 2
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI)
      ctx.stroke()
      
      // Draw balloon tail (small triangle pointing down)
      const tailY = centerY + radiusY
      ctx.beginPath()
      ctx.moveTo(centerX, tailY)
      ctx.lineTo(centerX - 15, tailY + 20)
      ctx.lineTo(centerX + 15, tailY + 20)
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
      ctx.stroke()
      
      // Store balloon oval info and show text input
      const rect = canvas.getBoundingClientRect()
      const screenPos = {
        x: rect.left + (centerX * rect.width / canvas.width),
        y: rect.top + (centerY * rect.height / canvas.height) - 12 // Offset up for text baseline
      }
      setBalloonOval({
        centerX,
        centerY,
        radiusX,
        radiusY,
        screenPos
      })
      setTextInputPos({ x: centerX, y: centerY })
      setTextInputScreenPos(screenPos)
      setTimeout(() => inputRef.current?.focus(), 0)
    }

    setIsDrawing(false)
    
    // Save the current canvas state
    if (canvas && ctx) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      onCanvasChange(imageData)
    }
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

