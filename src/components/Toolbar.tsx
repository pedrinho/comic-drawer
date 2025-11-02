import { Tool } from '../App'
import './Toolbar.css'

interface ToolbarProps {
  currentTool: Tool
  onToolChange: (tool: Tool) => void
}

export default function Toolbar({ currentTool, onToolChange }: ToolbarProps) {
  const tools: { name: Tool; icon: string; label: string }[] = [
    { name: 'pen', icon: '✏️', label: 'Pen' },
    { name: 'eraser', icon: '🧹', label: 'Eraser' },
    { name: 'rect', icon: '⬜', label: 'Rectangle' },
    { name: 'ellipse', icon: '⭕', label: 'Circle' },
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
    </div>
  )
}
