import { EraserSize } from '../types/common'
import { ERASER_WIDTHS } from '../utils/eraserTool'
import './PenPicker.css'

interface EraserPickerProps {
  isOpen: boolean
  selectedSize: EraserSize
  onSelectSize: (size: EraserSize) => void
}

/** Eraser size submenu (shares the pen picker's look). Widths come from `ERASER_WIDTHS`. */
export default function EraserPicker({ isOpen, selectedSize, onSelectSize }: EraserPickerProps) {
  if (!isOpen) return null

  const sizes: { name: EraserSize; label: string }[] = [
    { name: 'small', label: 'Small' },
    { name: 'medium', label: 'Medium' },
    { name: 'large', label: 'Large' },
  ]

  return (
    <div className="pen-picker-container">
      <span className="picker-label">Eraser Size</span>
      <div className="pen-grid">
        {sizes.map(({ name, label }) => {
          // Preview ring scaled down so the large size still fits the button.
          const dot = Math.max(6, Math.round(ERASER_WIDTHS[name] * 0.55))
          return (
            <button
              key={name}
              className={`pen-option-btn ${selectedSize === name ? 'selected' : ''}`}
              onClick={() => onSelectSize(name)}
              title={`${label} (${ERASER_WIDTHS[name]}px)`}
            >
              <div
                className="pen-preview-dot"
                style={{ width: dot, height: dot, border: '2px solid currentColor', boxSizing: 'border-box' }}
              />
              <span className="pen-label">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
