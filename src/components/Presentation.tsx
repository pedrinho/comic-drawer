import { useEffect, useRef } from 'react'
import { PanelData } from '../App'
import { ShapeLayer, TextLayer } from '../types/layers'
import { traceShapePath } from '../utils/canvasUtils'
import './Presentation.css'

interface PresentationProps {
  panels: PanelData[]
  currentIndex: number
  onNext: () => void
  onPrevious: () => void
  onClose: () => void
}

const renderShapeLayerOnContext = (ctx: CanvasRenderingContext2D, layer: ShapeLayer) => {
  const { x, y, width, height, rotation, strokeColor, strokeWidth, fillColor, shape } = layer
  const centerX = x + width / 2
  const centerY = y + height / 2
  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.rotate(rotation)
  traceShapePath(ctx, shape, -width / 2, -height / 2, width / 2, height / 2)
  if (fillColor) {
    ctx.fillStyle = fillColor
    ctx.fill()
  }
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = strokeWidth
  ctx.stroke()
  ctx.restore()
}

const renderTextLayerOnContext = (ctx: CanvasRenderingContext2D, layer: TextLayer) => {
  const { x, y, width, height, rotation, text, font, fontSize, color } = layer
  const centerX = x + width / 2
  const centerY = y + height / 2
  
  // In presentation mode, the context is already scaled, so we use fontSize directly
  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.rotate(rotation)
  ctx.fillStyle = color
  ctx.font = `${fontSize}px ${font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

export default function Presentation({ panels, currentIndex, onNext, onPrevious, onClose }: PresentationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const panel = panels[currentIndex]
    if (!panel) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match container
    // Account for padding when calculating available space
    const container = canvas.parentElement
    if (!container) return
    
    // Use requestAnimationFrame to ensure layout is calculated
    requestAnimationFrame(() => {
      const containerRect = container.getBoundingClientRect()
      const containerStyle = window.getComputedStyle(container)
      const paddingTop = parseFloat(containerStyle.paddingTop) || 0
      const paddingBottom = parseFloat(containerStyle.paddingBottom) || 0
      const paddingLeft = parseFloat(containerStyle.paddingLeft) || 0
      const paddingRight = parseFloat(containerStyle.paddingRight) || 0
      
      // Available space for drawing (excluding padding)
      const availableWidth = containerRect.width - paddingLeft - paddingRight
      const availableHeight = containerRect.height - paddingTop - paddingBottom
      
      // Set canvas size to match container (accounting for device pixel ratio for crisp rendering)
      const dpr = window.devicePixelRatio || 1
      canvas.width = containerRect.width * dpr
      canvas.height = containerRect.height * dpr
      ctx.scale(dpr, dpr)
      
      // Adjust available dimensions for device pixel ratio
      const scaledAvailableWidth = availableWidth
      const scaledAvailableHeight = availableHeight

      // Fill with white background
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, containerRect.width, containerRect.height)

      // Calculate scale to fit panel (1200x800) in canvas while maintaining aspect ratio
      // Ensure the entire panel fits - use the smaller scale to guarantee everything is visible
      let drawWidth: number
      let drawHeight: number
      let offsetX: number
      let offsetY: number

      // Calculate scale factors for both dimensions using available space
      const scaleToFitWidth = scaledAvailableWidth / 1200
      const scaleToFitHeight = scaledAvailableHeight / 800
    
      // Use the smaller scale to ensure the entire panel fits (both width and height)
      const scale = Math.min(scaleToFitWidth, scaleToFitHeight)
      
      drawWidth = 1200 * scale
      drawHeight = 800 * scale
      
      // Center in the available space (accounting for padding)
      offsetX = paddingLeft + (scaledAvailableWidth - drawWidth) / 2
      offsetY = paddingTop + (scaledAvailableHeight - drawHeight) / 2

      // Scale context to fit panel
      const scaleX = drawWidth / 1200
      const scaleY = drawHeight / 800
      ctx.save()
      ctx.translate(offsetX, offsetY)
      ctx.scale(scaleX, scaleY)

      // Draw panel data if available
      if (panel.data) {
        // Create a temporary canvas to hold the ImageData
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = 1200
        tempCanvas.height = 800
        const tempCtx = tempCanvas.getContext('2d')
        if (tempCtx) {
          tempCtx.putImageData(panel.data, 0, 0)
          // Draw the temporary canvas onto the main canvas
          // drawImage respects the current transformation matrix (scale and translate)
          ctx.drawImage(tempCanvas, 0, 0)
        }
      }

      ctx.restore() // Restore before drawing grid so we can use screen-space coordinates

      // Draw grid in screen space with fixed line width
      ctx.save()
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 3 // Fixed pixel width in screen space
      
      const totalRows = panel.layout.rows
      const gutter = 12 // Space between panels (and around edges)

      for (let row = 0; row < totalRows; row++) {
        const columnsInRow = panel.layout.columns[row] || 1
        
        // Calculate spacing: gutter on each side + gutters between cells
        const totalVerticalGutters = gutter * 2 + (totalRows - 1) * gutter
        const totalHorizontalGutters = gutter * 2 + (columnsInRow - 1) * gutter
        const panelHeight = (800 - totalVerticalGutters) / totalRows
        const panelWidth = (1200 - totalHorizontalGutters) / columnsInRow
        
        // Convert to screen coordinates
        let currentX = offsetX + gutter * scaleX
        const currentY = offsetY + (gutter + (row * (panelHeight + gutter))) * scaleY
        const scaledPanelWidth = panelWidth * scaleX
        const scaledPanelHeight = panelHeight * scaleY
        const scaledGutter = gutter * scaleX

        // Draw rectangle for each cell in the row
        for (let col = 0; col < columnsInRow; col++) {
          ctx.beginPath()
          ctx.rect(currentX, currentY, scaledPanelWidth, scaledPanelHeight)
          ctx.stroke()
          currentX += scaledPanelWidth + scaledGutter
        }
      }
      ctx.restore()

      // Re-apply scale for shape and text layers
      ctx.save()
      ctx.translate(offsetX, offsetY)
      ctx.scale(scaleX, scaleY)

      // Draw shape layers
      if (panel.shapeLayers && panel.shapeLayers.length > 0) {
        panel.shapeLayers.forEach((layer) => {
          renderShapeLayerOnContext(ctx, layer)
        })
      }

      // Draw text layers
      if (panel.textLayers && panel.textLayers.length > 0) {
        panel.textLayers.forEach((layer) => {
          renderTextLayerOnContext(ctx, layer)
        })
      }

      ctx.restore()
    })
  }, [panels, currentIndex])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        onNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onPrevious()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onNext, onPrevious, onClose])

  const currentPanel = panels[currentIndex]
  const panelName = currentPanel?.name || `Panel ${currentIndex + 1}`

  return (
    <div className="presentation-overlay" onClick={onClose}>
      <div className="presentation-container" onClick={(e) => e.stopPropagation()}>
        <div className="presentation-header">
          <span className="presentation-title">{panelName}</span>
          <span className="presentation-counter">
            {currentIndex + 1} / {panels.length}
          </span>
          <button className="presentation-close-btn" onClick={onClose} aria-label="Close presentation">
            ×
          </button>
        </div>
        <div className="presentation-canvas-container">
          <canvas ref={canvasRef} className="presentation-canvas" />
        </div>
        <div className="presentation-controls">
          <button
            className="presentation-nav-btn"
            onClick={onPrevious}
            disabled={currentIndex === 0}
            aria-label="Previous panel"
          >
            ← Previous
          </button>
          <div className="presentation-hint">
            Use arrow keys or click to navigate • Press Escape to exit
          </div>
          <button
            className="presentation-nav-btn"
            onClick={onNext}
            disabled={currentIndex === panels.length - 1}
            aria-label="Next panel"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

