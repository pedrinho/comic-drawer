import { Tool, Shape } from '../App'
import './Toolbar.css'
import React from 'react'
import ShapePicker from './ShapePicker'

interface ToolbarProps {
  currentTool: Tool
  onToolChange: (tool: Tool) => void
  color: string
  onColorChange: (color: string) => void
  selectedShape: Shape
  onSelectShape: (shape: Shape) => void
}

export default function Toolbar({ currentTool, onToolChange, color, onColorChange, selectedShape, onSelectShape }: ToolbarProps) {
  const tools: { name: Tool; icon: string; label: string }[] = [
    { name: 'pen', icon: '✏️', label: 'Pen' },
    { name: 'eraser', icon: '🧹', label: 'Eraser' },
    { name: 'shapes', icon: '🔷', label: 'Shapes' },
    { name: 'fill', icon: '🪣', label: 'Fill' },
    { name: 'text', icon: '💬', label: 'Text' },
    { name: 'balloon', icon: '💭', label: 'Balloon' },
  ]

  const handleShapeButtonClick = () => {
    if (currentTool === 'shapes') {
      onToolChange('pen')
    } else {
      onToolChange('shapes')
    }
  }

  return (
    <div className="toolbar">
      {tools.map((tool) => (
        <React.Fragment key={tool.name}>
          <button
            className={`tool-btn ${currentTool === tool.name ? 'active' : ''}`}
            onClick={tool.name === 'shapes' ? handleShapeButtonClick : () => onToolChange(tool.name)}
            title={tool.label}
          >
            <span className="tool-icon">{tool.icon}</span>
            <span className="tool-label">{tool.label}</span>
          </button>
          {tool.name === 'shapes' && currentTool === 'shapes' && (
            <ShapePicker
              isOpen={true}
              selectedShape={selectedShape}
              onSelectShape={onSelectShape}
            />
          )}
        </React.Fragment>
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
