import { useEffect, useRef, useState, useCallback } from 'react'
import { Tool } from '../App'
import './Canvas.css'

interface CanvasProps {
  tool: Tool
  color: string
  panelData: ImageData | null
  layout: { rows: number; columns: number[] }
  onCanvasChange: (data: ImageData) => void
}

export default function Canvas({ tool, color, panelData, layout, onCanvasChange }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const lastSaveRef = useRef<number>(0)
  const savedImageRef = useRef<ImageData | null>(null)

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.save()
    ctx.strokeStyle = '#667eea'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])

    const totalRows = layout.rows
    let currentY = 0

    for (let row = 0; row < totalRows; row++) {
      const columnsInRow = layout.columns[row] || 1
      const rowHeight = 800 / totalRows
      const columnWidth = 1200 / columnsInRow
      let currentX = 0

      // Draw horizontal lines (including borders)
      ctx.beginPath()
      ctx.moveTo(0, currentY)
      ctx.lineTo(1200, currentY)
      ctx.stroke()

      // Draw vertical lines for this row (including borders)
      for (let col = 0; col < columnsInRow; col++) {
        ctx.beginPath()
        ctx.moveTo(currentX, currentY)
        ctx.lineTo(currentX, currentY + rowHeight)
        ctx.stroke()
        currentX += columnWidth
      }

      currentY += rowHeight
    }

    // Draw bottom border
    ctx.beginPath()
    ctx.moveTo(0, currentY)
    ctx.lineTo(1200, currentY)
    ctx.stroke()

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
    ctx.lineWidth = 2

    // Restore saved data if available
    if (panelData) {
      ctx.putImageData(panelData, 0, 0)
    }

    // Draw grid on top (always visible)
    drawGrid(ctx)
  }, [panelData, layout, drawGrid, color])

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
    } else if (tool === 'rect' || tool === 'ellipse') {
      // Save the current canvas state for live preview
      savedImageRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
    }
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
    } else if (tool === 'rect' || tool === 'ellipse') {
      // Restore saved canvas and draw preview
      if (savedImageRef.current) {
        ctx.putImageData(savedImageRef.current, 0, 0)
      }
      drawGrid(ctx)
      
      if (tool === 'rect') {
        ctx.beginPath()
        const width = pos.x - startPos.x
        const height = pos.y - startPos.y
        ctx.rect(startPos.x, startPos.y, width, height)
        ctx.stroke()
      } else if (tool === 'ellipse') {
        ctx.beginPath()
        const radiusX = Math.abs(pos.x - startPos.x) / 2
        const radiusY = Math.abs(pos.y - startPos.y) / 2
        const centerX = (startPos.x + pos.x) / 2
        const centerY = (startPos.y + pos.y) / 2
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI)
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

    if (tool === 'rect') {
      ctx.beginPath()
      const width = pos.x - startPos.x
      const height = pos.y - startPos.y
      ctx.rect(startPos.x, startPos.y, width, height)
      ctx.stroke()
    } else if (tool === 'ellipse') {
      ctx.beginPath()
      const radiusX = Math.abs(pos.x - startPos.x) / 2
      const radiusY = Math.abs(pos.y - startPos.y) / 2
      const centerX = (startPos.x + pos.x) / 2
      const centerY = (startPos.y + pos.y) / 2
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI)
      ctx.stroke()
    }

    setIsDrawing(false)
    
    // Save the current canvas state
    if (canvas && ctx) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      onCanvasChange(imageData)
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
    </div>
  )
}
