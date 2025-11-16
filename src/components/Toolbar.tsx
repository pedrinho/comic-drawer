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
  font: string
  onFontChange: (font: string) => void
  fontSize: number
  onFontSizeChange: (fontSize: number) => void
}

export default function Toolbar({ currentTool, onToolChange, color, onColorChange, selectedShape, onSelectShape, selectedPenType, onSelectPenType, font, onFontChange, fontSize, onFontSizeChange }: ToolbarProps) {
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
      {currentTool === 'text' && (
        <>
          <div className="font-selector">
            <label htmlFor="font-picker">Font:</label>
            <select
              id="font-picker"
              value={font}
              onChange={(e) => onFontChange(e.target.value)}
              title="Select font"
            >
              <option value="Arial">Arial</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
              <option value="Georgia">Georgia</option>
              <option value="Verdana">Verdana</option>
              <option value="Comic Sans MS">Comic Sans MS</option>
              <option value="Impact">Impact</option>
              <option value="Trebuchet MS">Trebuchet MS</option>
            </select>
          </div>
          <div className="font-size-selector">
            <label htmlFor="font-size-picker">Size:</label>
            <input
              id="font-size-picker"
              type="number"
              min="8"
              max="200"
              value={fontSize}
              onChange={(e) => onFontSizeChange(parseInt(e.target.value) || 24)}
              title="Font size"
              style={{ width: '60px' }}
            />
          </div>
        </>
      )}
    </div>
  )
}
