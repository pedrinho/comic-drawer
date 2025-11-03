import { Shape } from '../App'
import './ShapePicker.css'

interface ShapePickerProps {
  isOpen: boolean
  selectedShape: Shape
  onSelectShape: (shape: Shape) => void
}

export default function ShapePicker({ isOpen, selectedShape, onSelectShape }: ShapePickerProps) {
  if (!isOpen) return null

  const shapes: { name: Shape; icon: string }[] = [
    // Ordered by number of sides
    { name: 'triangle', icon: '△' },
    { name: 'rectangle', icon: '▭' },
    { name: 'pentagon', icon: '⬟' },
    { name: 'hexagon', icon: '⬡' },
    { name: 'heptagon', icon: '⬟' },
    { name: 'octagon', icon: '⯃' },
    { name: 'circle', icon: '○' },
    { name: 'diamond', icon: '◆' },
    { name: 'star', icon: '★' },
    { name: 'heart', icon: '♥' },
    { name: 'arrow', icon: '→' },
    { name: 'cross', icon: '✚' },
  ]

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

