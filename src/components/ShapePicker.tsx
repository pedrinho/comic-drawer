import { useEffect, useState } from 'react'
import { Shape } from '../types/common'
import {
  regularPolygonPoints,
  clampSides,
  POLYGON_MIN_SIDES,
  POLYGON_MAX_SIDES,
  DEFAULT_POLYGON_SIDES,
} from '../utils/fabricShapes'
import './ShapePicker.css'

export interface ShapeOption {
  name: Shape
  icon: string
}

// The Shapes button: geometric shapes, ordered by number of sides. `polygon` covers any side count.
export const GEOMETRIC_SHAPES: ShapeOption[] = [
  { name: 'triangle', icon: '△' },
  { name: 'rectangle', icon: '▭' },
  { name: 'polygon', icon: '⬡' },
  { name: 'circle', icon: '○' },
  { name: 'diamond', icon: '◆' },
]

// The Objects button: drawn "things" rather than geometry.
export const OBJECT_SHAPES: ShapeOption[] = [
  { name: 'star', icon: '★' },
  { name: 'heart', icon: '♥' },
  { name: 'arrow', icon: '→' },
  { name: 'cross', icon: '✚' },
]

interface ShapePickerProps {
  isOpen: boolean
  shapes?: ShapeOption[]
  selectedShape: Shape
  onSelectShape: (shape: Shape) => void
  /** Side count for `polygon`; the sides row only shows when polygon is selected. */
  sides?: number
  onSidesChange?: (sides: number) => void
}

const PREVIEW = 40

export default function ShapePicker({
  isOpen,
  shapes = GEOMETRIC_SHAPES,
  selectedShape,
  onSelectShape,
  sides = DEFAULT_POLYGON_SIDES,
  onSidesChange,
}: ShapePickerProps) {
  // The typed text is kept separately so the field can be mid-edit (empty, "1" on the way to "12")
  // without being clamped under the user's fingers; it commits on blur/Enter.
  const [draft, setDraft] = useState(String(sides))
  useEffect(() => setDraft(String(sides)), [sides])

  if (!isOpen) return null

  const commit = (value: number) => {
    const next = clampSides(value)
    setDraft(String(next))
    if (next !== sides) onSidesChange?.(next)
  }

  const showSides = selectedShape === 'polygon' && !!onSidesChange
  const previewPoints = regularPolygonPoints(sides, PREVIEW - 4, PREVIEW - 4)
    .map((p) => `${p.x + 2},${p.y + 2}`)
    .join(' ')

  return (
    <div className="shape-picker-wrapper">
      <div className="shape-picker-inline">
        {shapes.map((shape) => (
          <button
            key={shape.name}
            className={`shape-btn-inline ${selectedShape === shape.name ? 'selected' : ''}`}
            onClick={() => onSelectShape(shape.name)}
            title={shape.name}
          >
            {shape.icon}
          </button>
        ))}
      </div>
      {showSides && (
        <div className="polygon-sides">
          <span className="polygon-sides-label">Sides</span>
          <div className="polygon-sides-controls">
            <button
              className="polygon-sides-btn"
              onClick={() => commit(sides - 1)}
              disabled={sides <= POLYGON_MIN_SIDES}
              aria-label="Fewer sides"
            >
              −
            </button>
            <input
              className="polygon-sides-input"
              type="number"
              inputMode="numeric"
              min={POLYGON_MIN_SIDES}
              max={POLYGON_MAX_SIDES}
              value={draft}
              aria-label="Number of sides"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => commit(Number(draft))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit(Number(draft))
              }}
            />
            <button
              className="polygon-sides-btn"
              onClick={() => commit(sides + 1)}
              disabled={sides >= POLYGON_MAX_SIDES}
              aria-label="More sides"
            >
              +
            </button>
          </div>
          <svg
            className="polygon-sides-preview"
            width={PREVIEW}
            height={PREVIEW}
            viewBox={`0 0 ${PREVIEW} ${PREVIEW}`}
            data-testid="polygon-preview"
          >
            <polygon points={previewPoints} />
          </svg>
        </div>
      )}
    </div>
  )
}
