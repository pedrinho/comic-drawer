import { useEffect, useRef } from 'react'
import { PanelData } from '../types/common'
import { renderPanelToStaticCanvas } from '../utils/exportPanel'
import './Presentation.css'

interface PresentationProps {
  panels: PanelData[]
  currentIndex: number
  onNext: () => void
  onPrevious: () => void
  onClose: () => void
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

    const container = canvas.parentElement
    if (!container) return

    let cancelled = false // a newer slide (or closing) supersedes this async render

    requestAnimationFrame(async () => {
      const containerRect = container.getBoundingClientRect()
      const containerStyle = window.getComputedStyle(container)
      const paddingTop = parseFloat(containerStyle.paddingTop) || 0
      const paddingBottom = parseFloat(containerStyle.paddingBottom) || 0
      const paddingLeft = parseFloat(containerStyle.paddingLeft) || 0
      const paddingRight = parseFloat(containerStyle.paddingRight) || 0

      // Available space for drawing (excluding padding)
      const availableWidth = containerRect.width - paddingLeft - paddingRight
      const availableHeight = containerRect.height - paddingTop - paddingBottom

      // Fit the 1200x800 panel inside the available space, preserving its aspect ratio, centred.
      const scale = Math.min(availableWidth / 1200, availableHeight / 800)
      const drawWidth = 1200 * scale
      const drawHeight = 800 * scale
      const offsetX = paddingLeft + (availableWidth - drawWidth) / 2
      const offsetY = paddingTop + (availableHeight - drawHeight) / 2
      const dpr = window.devicePixelRatio || 1

      // The panel (raster, grid and every object — eraser masks, images, groups included) renders
      // through the same Fabric StaticCanvas path as PDF export, so the slide matches the editor.
      // Rendered at on-screen resolution so it stays crisp.
      let slide: HTMLCanvasElement | null = null
      try {
        slide = await renderPanelToStaticCanvas(panel, Math.max(scale * dpr, 0.01))
      } catch {
        slide = null
      }
      if (cancelled) return

      // Size the canvas to the container (device pixel ratio for crisp rendering), white ground.
      canvas.width = containerRect.width * dpr
      canvas.height = containerRect.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, containerRect.width, containerRect.height)
      if (slide) ctx.drawImage(slide, offsetX, offsetY, drawWidth, drawHeight)
    })

    return () => {
      cancelled = true
    }
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

