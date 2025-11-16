import { Tool, Shape, PenType } from '../App'
import './Toolbar.css'
import React, { useState, useEffect } from 'react'
import ShapePicker from './ShapePicker'
import PenPicker from './PenPicker'

interface ToolbarProps {
  currentTool: Tool
  onToolChange: (tool: Tool) => void
  color: string
  onColorChange: (color: string) => void
  selectedShape: Shape
  onSelectShape: (shape: Shape) => void
  selectedPenType: PenType
  onSelectPenType: (penType: PenType) => void
}

export default function Toolbar({ currentTool, onToolChange, color, onColorChange, selectedShape, onSelectShape, selectedPenType, onSelectPenType }: ToolbarProps) {
  const [showPenSubmenu, setShowPenSubmenu] = useState(false)
  const [showShapesSubmenu, setShowShapesSubmenu] = useState(false)
  const tools: { name: Tool; icon: string; label: string }[] = [
    { name: 'select', icon: '🖱️', label: 'Select' },
    { name: 'pen', icon: '✏️', label: 'Pen' },
    { name: 'eraser', icon: '🧹', label: 'Eraser' },
    { name: 'shapes', icon: '🔷', label: 'Shapes' },
    { name: 'objectShapes', icon: '⬚', label: 'Object Shapes' },
    { name: 'fill', icon: '🪣', label: 'Fill' },
    { name: 'text', icon: '💬', label: 'Text' },
    { name: 'balloon', icon: '💭', label: 'Balloon' },
  ]

  useEffect(() => {
    if (currentTool !== 'pen') {
      setShowPenSubmenu(false)
    }
    if (currentTool !== 'shapes' && currentTool !== 'objectShapes') {
      setShowShapesSubmenu(false)
    }
  }, [currentTool])

  const handleShapeToolClick = (toolName: Tool) => {
    if (currentTool === toolName) {
      setShowShapesSubmenu(!showShapesSubmenu)
      setShowPenSubmenu(false)
    } else {
      onToolChange(toolName)
      setShowShapesSubmenu(true)
      setShowPenSubmenu(false)
    }
  }

  const handlePenButtonClick = () => {
    if (currentTool === 'pen') {
      // Toggle submenu
      setShowPenSubmenu(!showPenSubmenu)
      setShowShapesSubmenu(false)
    } else {
      onToolChange('pen')
      setShowPenSubmenu(true)
      setShowShapesSubmenu(false)
    }
  }

  const handleOtherToolClick = (tool: Tool) => {
    onToolChange(tool)
    setShowPenSubmenu(false)
    setShowShapesSubmenu(false)
  }

  return (
    <div className="toolbar">
      {tools.map((tool) => (
        <React.Fragment key={tool.name}>
          <button
            className={`tool-btn ${currentTool === tool.name ? 'active' : ''}`}
            onClick={
              tool.name === 'pen'
                ? handlePenButtonClick
                : tool.name === 'shapes' || tool.name === 'objectShapes'
                ? () => handleShapeToolClick(tool.name)
                : () => handleOtherToolClick(tool.name)
            }
            title={tool.label}
          >
            <span className="tool-icon">{tool.icon}</span>
            <span className="tool-label">{tool.label}</span>
          </button>
          {tool.name === 'pen' && currentTool === 'pen' && showPenSubmenu && (
            <PenPicker
              isOpen={true}
              selectedPenType={selectedPenType}
              onSelectPenType={onSelectPenType}
            />
          )}
          {tool.name === 'shapes' && currentTool === 'shapes' && showShapesSubmenu && (
            <ShapePicker
              isOpen={true}
              selectedShape={selectedShape}
              onSelectShape={onSelectShape}
            />
          )}
          {tool.name === 'objectShapes' && currentTool === 'objectShapes' && showShapesSubmenu && (
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
