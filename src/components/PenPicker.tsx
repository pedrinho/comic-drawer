import { PenType } from '../App'
import './PenPicker.css'

interface PenPickerProps {
  isOpen: boolean
  selectedPenType: PenType
  onSelectPenType: (penType: PenType) => void
}

export default function PenPicker({ isOpen, selectedPenType, onSelectPenType }: PenPickerProps) {
  if (!isOpen) return null

  const penTypes: { name: PenType; icon: string; label: string }[] = [
    { name: 'fine', icon: '•', label: 'Fine' },
    { name: 'small', icon: '●', label: 'Small' },
    { name: 'medium', icon: '⬤', label: 'Medium' },
    { name: 'large', icon: '●', label: 'Large' },
    { name: 'thick', icon: '⬤', label: 'Thick' },
    { name: 'verythick', icon: '⬤', label: 'Very Thick' },
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
          {penType.icon}
        </button>
      ))}
    </div>
  )
}

