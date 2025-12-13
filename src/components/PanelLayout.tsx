import { useState, useRef, useEffect } from 'react'
import './PanelLayout.css'
import { PanelData } from '../types/common'

interface PanelLayoutProps {
  panels: PanelData[]
  selectedPanel: number
  onPanelSelect: (index: number) => void
  onAddPanel: () => void
  onDeletePanel: (index: number) => void
  onRenamePanel: (index: number, newName: string) => void
  onMovePanel: (index: number, direction: 'up' | 'down') => void
}

export default function PanelLayout({ panels, selectedPanel, onPanelSelect, onAddPanel, onDeletePanel, onRenamePanel, onMovePanel }: PanelLayoutProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingIndex !== null && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingIndex])

  const handleDeleteClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation() // Prevent panel selection when clicking delete
    onDeletePanel(index)
  }

  const handleMoveClick = (e: React.MouseEvent, index: number, direction: 'up' | 'down') => {
    e.stopPropagation() // Prevent panel selection when clicking move
    onMovePanel(index, direction)
  }

  const handleDoubleClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    const panel = panels[index]
    if (panel) {
      setEditValue(panel.name)
      setEditingIndex(index)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value)
  }

  const handleInputBlur = (index: number) => {
    if (editingIndex === index) {
      const trimmedValue = editValue.trim()
      if (trimmedValue) {
        onRenamePanel(index, trimmedValue)
      }
      setEditingIndex(null)
      setEditValue('')
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleInputBlur(index)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditingIndex(null)
      setEditValue('')
    }
  }

  return (
    <div className="panel-layout">
      <h3>Panels</h3>
      <div className="panels-container">
        {panels.map((panel, index) => (
          <div
            key={index}
            className={`panel ${index === selectedPanel ? 'selected' : ''}`}
            onClick={() => {
              if (editingIndex !== index) {
                onPanelSelect(index)
              }
            }}
            onDoubleClick={(e) => handleDoubleClick(e, index)}
          >
            {editingIndex === index ? (
              <input
                ref={inputRef}
                type="text"
                className="panel-name-input"
                value={editValue}
                onChange={handleInputChange}
                onBlur={() => handleInputBlur(index)}
                onKeyDown={(e) => handleInputKeyDown(e, index)}
                onClick={(e) => e.stopPropagation()}
                aria-label="Panel name"
              />
            ) : (
              <span className="panel-name">{panel.name}</span>
            )}
            {panels.length > 1 && (
              <div className="panel-controls">
                <button
                  className="panel-move-btn"
                  title="Move Up"
                  onClick={(e) => handleMoveClick(e, index, 'up')}
                  disabled={index === 0}
                  aria-label="Move panel up"
                >
                  ↑
                </button>
                <button
                  className="panel-move-btn"
                  title="Move Down"
                  onClick={(e) => handleMoveClick(e, index, 'down')}
                  disabled={index === panels.length - 1}
                  aria-label="Move panel down"
                >
                  ↓
                </button>
                <button
                  className="panel-delete-btn"
                  title="Delete Panel"
                  onClick={(e) => handleDeleteClick(e, index)}
                  aria-label="Delete panel"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        ))}
        <button className="add-panel-btn" title="Add Panel" onClick={onAddPanel}>
          + Add Panel
        </button>
      </div>
    </div>
  )
}
