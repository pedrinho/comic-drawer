import { useEffect, useState } from 'react'
import {
  regularPolygonPoints,
  clampSides,
  POLYGON_MIN_SIDES,
  POLYGON_MAX_SIDES,
} from '../utils/fabricShapes'
import './PolygonPicker.css'

interface PolygonPickerProps {
  isOpen: boolean
  sides: number
  onSidesChange: (sides: number) => void
}

const PREVIEW = 40

/** The Polygon tool's submenu: choose how many sides (3–1000) the next polygon has. */
export default function PolygonPicker({ isOpen, sides, onSidesChange }: PolygonPickerProps) {
  // The typed text is kept separately so the field can be mid-edit (empty, "1" on the way to "12")
  // without being clamped under the user's fingers; it commits on blur/Enter.
  const [draft, setDraft] = useState(String(sides))
  useEffect(() => setDraft(String(sides)), [sides])

  if (!isOpen) return null

  const commit = (value: number) => {
    const next = clampSides(value)
    setDraft(String(next))
    if (next !== sides) onSidesChange(next)
  }

  const previewPoints = regularPolygonPoints(sides, PREVIEW - 4, PREVIEW - 4)
    .map((p) => `${p.x + 2},${p.y + 2}`)
    .join(' ')

  return (
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
  )
}
