import { PenType } from '../App'
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
    { name: 'large', label: 'Large', thickness: 8 },
    { name: 'thick', label: 'Thick', thickness: 10 },
    { name: 'verythick', label: 'Very Thick', thickness: 12 },
  ]

  return (
    <div className="pen-picker-inline">
      {penTypes.map((penType) => (
        <button
          key={penType.name}
          className={`pen-btn-inline ${selectedPenType === penType.name ? 'selected' : ''}`}
          onClick={() => onSelectPenType(penType.name)}
          title={penType.label}
        >
          <span className="pen-label">{penType.label}</span>
          <span
            className="pen-preview"
            style={{ height: `${penType.thickness}px` }}
          />
        </button>
      ))}
    </div>
  )
}

