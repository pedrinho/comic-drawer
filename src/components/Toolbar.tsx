import { Tool, Shape, PenType } from '../types/common'
import './Toolbar.css'
import React, { useState, useEffect } from 'react'
import ShapePicker from './ShapePicker'
import PenPicker from './PenPicker'
import FontPicker from './FontPicker'
import EmojiPicker from './EmojiPicker'

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
  isTextEditing?: boolean
  selectedEmoji?: string
  onSelectEmoji?: (emoji: string) => void
}

export default function Toolbar({ currentTool, onToolChange, color, onColorChange, selectedShape, onSelectShape, selectedPenType, onSelectPenType, font, onFontChange, fontSize, onFontSizeChange, isTextEditing = false, selectedEmoji = '😀', onSelectEmoji }: ToolbarProps) {
  const [showPenSubmenu, setShowPenSubmenu] = useState(false)
  const [showShapesSubmenu, setShowShapesSubmenu] = useState(false)
  const [showTextSubmenu, setShowTextSubmenu] = useState(false)
  const [showEmojiSubmenu, setShowEmojiSubmenu] = useState(false)
  const tools: { name: Tool; icon: string; label: string }[] = [
    { name: 'select', icon: '🖱️', label: 'Select' },
    { name: 'pen', icon: '✏️', label: 'Pen' },
    { name: 'eraser', icon: '🧹', label: 'Eraser' },
    { name: 'shapes', icon: '🔷', label: 'Shapes' },
    { name: 'objectShapes', icon: '⬚', label: 'Object Shapes' },
    { name: 'fill', icon: '🪣', label: 'Fill' },
    { name: 'text', icon: '💬', label: 'Text' },
    { name: 'balloon', icon: '💭', label: 'Balloon' },
    { name: 'emoji', icon: '😀', label: 'Emoji' },
  ]

  useEffect(() => {
    if (currentTool !== 'pen') {
      setShowPenSubmenu(false)
    }
    if (currentTool !== 'shapes' && currentTool !== 'objectShapes') {
      setShowShapesSubmenu(false)
    }
    // Show text submenu when editing text or when text/balloon tool is active
    if (currentTool !== 'text' && currentTool !== 'balloon' && !isTextEditing) {
      setShowTextSubmenu(false)
    } else if (isTextEditing) {
      setShowTextSubmenu(true)
    }
    if (currentTool !== 'emoji') {
      setShowEmojiSubmenu(false)
    }
  }, [currentTool, isTextEditing])

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

  const handleTextButtonClick = () => {
    if (currentTool === 'text' || currentTool === 'balloon') {
      // Toggle submenu
      setShowTextSubmenu(!showTextSubmenu)
      setShowPenSubmenu(false)
      setShowShapesSubmenu(false)
    } else {
      onToolChange('text')
      setShowTextSubmenu(true)
      setShowPenSubmenu(false)
      setShowShapesSubmenu(false)
    }
  }

  const handleBalloonButtonClick = () => {
    if (currentTool === 'balloon') {
      // Toggle submenu
      setShowTextSubmenu(!showTextSubmenu)
      setShowPenSubmenu(false)
      setShowShapesSubmenu(false)
    } else {
      onToolChange('balloon')
      setShowTextSubmenu(true)
      setShowPenSubmenu(false)
      setShowShapesSubmenu(false)
    }
  }

  const handleEmojiButtonClick = () => {
    if (currentTool === 'emoji') {
      // Toggle submenu
      setShowEmojiSubmenu(!showEmojiSubmenu)
      setShowPenSubmenu(false)
      setShowShapesSubmenu(false)
      setShowTextSubmenu(false)
    } else {
      onToolChange('emoji')
      setShowEmojiSubmenu(true)
      setShowPenSubmenu(false)
      setShowShapesSubmenu(false)
      setShowTextSubmenu(false)
    }
  }

  const handleOtherToolClick = (tool: Tool) => {
    onToolChange(tool)
    setShowPenSubmenu(false)
    setShowShapesSubmenu(false)
    setShowTextSubmenu(false)
    setShowEmojiSubmenu(false)
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
                  : tool.name === 'text'
                    ? handleTextButtonClick
                    : tool.name === 'balloon'
                      ? handleBalloonButtonClick
                      : tool.name === 'emoji'
                        ? handleEmojiButtonClick
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
          {tool.name === 'text' && ((currentTool === 'text' || currentTool === 'balloon' || isTextEditing) && showTextSubmenu) && (
            <FontPicker
              isOpen={true}
              font={font}
              onFontChange={onFontChange}
              fontSize={fontSize}
              onFontSizeChange={onFontSizeChange}
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
      {currentTool === 'emoji' && showEmojiSubmenu && onSelectEmoji && (
        <div className="emoji-picker-wrapper">
          <EmojiPicker
            isOpen={true}
            selectedEmoji={selectedEmoji}
            onSelectEmoji={onSelectEmoji}
          />
        </div>
      )}
    </div>
  )
}
