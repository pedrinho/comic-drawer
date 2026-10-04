import { Shape } from '../types/common'
import './ShapePicker.css'

export interface ShapeOption {
  name: Shape
  icon: string
}

// The Objects button: drawn "things". Plain geometry lives under the Polygon tool (any side count).
export const OBJECT_SHAPES: ShapeOption[] = [
  { name: 'star', icon: '★' },
  { name: 'heart', icon: '♥' },
  { name: 'arrow', icon: '→' },
  { name: 'cross', icon: '✚' },
  { name: 'circle', icon: '○' },
  { name: 'diamond', icon: '◆' },
]

interface ShapePickerProps {
  isOpen: boolean
  shapes?: ShapeOption[]
  selectedShape: Shape
  onSelectShape: (shape: Shape) => void
}

export default function ShapePicker({ isOpen, shapes = OBJECT_SHAPES, selectedShape, onSelectShape }: ShapePickerProps) {
  if (!isOpen) return null

  return (
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
  )
}
