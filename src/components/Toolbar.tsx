import { Tool } from '../App'
import './Toolbar.css'

interface ToolbarProps {
  currentTool: Tool
  onToolChange: (tool: Tool) => void
  color: string
  onColorChange: (color: string) => void
}

export default function Toolbar({ currentTool, onToolChange, color, onColorChange }: ToolbarProps) {
  const tools: { name: Tool; icon: string; label: string }[] = [
    { name: 'pen', icon: '✏️', label: 'Pen' },
    { name: 'eraser', icon: '🧹', label: 'Eraser' },
    { name: 'rect', icon: '⬜', label: 'Rectangle' },
    { name: 'ellipse', icon: '⭕', label: 'Circle' },
    { name: 'fill', icon: '🪣', label: 'Fill' },
    { name: 'text', icon: '💬', label: 'Text' },
  ]

  return (
    <div className="toolbar">
      {tools.map((tool) => (
        <button
          key={tool.name}
          className={`tool-btn ${currentTool === tool.name ? 'active' : ''}`}
          onClick={() => onToolChange(tool.name)}
          title={tool.label}
        >
          <span className="tool-icon">{tool.icon}</span>
          <span className="tool-label">{tool.label}</span>
        </button>
      ))}
      <div className="color-selector">
        <label htmlFor="color-picker">Color:</label>
        <input
          id="color-picker"
          type="color"
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          title="Select drawing color"
        />
      </div>
    </div>
  )
}
