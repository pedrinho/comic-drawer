import { useRef } from 'react'
import { Tool, Shape, PenType, BalloonKind } from '../types/common'
import { TextLayer, ObjectLayer } from '../types/layers'
import { useFabricCanvas } from '../hooks/useFabricCanvas'
import { useOverlaySizing } from '../hooks/useOverlaySizing'
import { useCanvasController } from '../hooks/useCanvasController'
import './Canvas.css'

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
  shapeLayers?: ObjectLayer[]
  onShapeLayersChange?: (layers: ObjectLayer[], skipHistory?: boolean) => void
  textLayers?: TextLayer[]
  onTextLayersChange?: (layers: TextLayer[], skipHistory?: boolean) => void
  onTextEditingChange?: (isEditing: boolean) => void
  onToolChange?: (tool: Tool) => void // Added to allow switching tools
  emoji?: string
  balloonKind?: BalloonKind
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
  onToolChange,
  emoji = '😀',
  balloonKind = 'speech',
}: CanvasProps) {
  const { fabricRef, fabricCanvasRef } = useFabricCanvas()
  // Wraps the Fabric canvas; the overlay's CSS size is fitted into this box.
  const containerRef = useRef<HTMLDivElement>(null)
  // Live "W × H" pill shown while drawing or resizing an object. Mutated imperatively (not React
  // state) so per-mousemove updates never re-render.
  const sizeLabelRef = useRef<HTMLDivElement>(null)

  useOverlaySizing(containerRef, fabricCanvasRef)
  useCanvasController({
    tool,
    shape,
    penType,
    color,
    font,
    fontSize,
    panelData,
    layout,
    emoji,
    balloonKind,
    shapeLayers,
    textLayers,
    onCanvasChange,
    onShapeLayersChange,
    onTextLayersChange,
    onTextEditingChange,
    onToolChange,
    containerRef,
    fabricCanvasRef,
    sizeLabelRef,
  })

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      style={{ position: 'relative', width: '100%', height: '100%' }}
      data-testid="canvas"
    >
      {/* Fabric.js Canvas — the single interactive canvas. */}
      <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, pointerEvents: 'auto' }}>
        <canvas ref={fabricRef} />
      </div>
      {/* Live size readout, positioned imperatively while drawing/resizing. */}
      <div ref={sizeLabelRef} className="size-label" style={{ display: 'none' }} />
    </div>
  )
}
