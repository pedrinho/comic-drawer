import { PenType } from '../types/common'
import './PenPicker.css'

interface PenPickerProps {
  isOpen: boolean
  selectedPenType: PenType
  onSelectPenType: (penType: PenType) => void
}

export default function PenPicker({ isOpen, selectedPenType, onSelectPenType }: PenPickerProps) {
  if (!isOpen) return null

  const penTypes: { name: PenType; label: string; thickness: number }[] = [
    { name: 'fine', label: 'Fine', thickness: 2 },
    { name: 'small', label: 'Small', thickness: 4 },
    { name: 'medium', label: 'Medium', thickness: 6 },
    { name: 'large', label: 'Large', thickness: 10 },
    { name: 'thick', label: 'Thick', thickness: 14 },
    { name: 'verythick', label: 'Heavy', thickness: 20 },
  ]

  return (
    <div className="pen-picker-container">
      <span className="picker-label">Stroke Width</span>
      <div className="pen-grid">
        {penTypes.map((penType) => (
          <button
            key={penType.name}
            className={`pen-option-btn ${selectedPenType === penType.name ? 'selected' : ''}`}
            onClick={() => onSelectPenType(penType.name)}
            title={`${penType.label} (${penType.thickness}px)`}
          >
            <div
              className="pen-preview-dot"
              style={{
                width: Math.max(4, penType.thickness),
                height: Math.max(4, penType.thickness),
                background: 'currentColor'
              }}
            />
            <span className="pen-label">{penType.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

