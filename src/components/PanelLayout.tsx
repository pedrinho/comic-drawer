import { useState, useRef, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  onReorderPanel: (oldIndex: number, newIndex: number) => void
}

interface SortablePanelItemProps {
  panel: PanelData
  index: number
  isSelected: boolean
  isEditing: boolean
  editValue: string
  onSelect: () => void
  onDoubleClick: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onInputBlur: () => void
  onInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  inputRef: React.RefObject<HTMLInputElement>
}

// Sub-component for individual sortable item
function SortablePanelItem({
  panel,
  isSelected,
  isEditing,
  editValue,
  onSelect,
  onDoubleClick,
  onDelete,
  onInputChange,
  onInputBlur,
  onInputKeyDown,
  inputRef
}: SortablePanelItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: panel.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`panel-item ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
    >
      <div className="drag-handle" {...attributes} {...listeners} title="Drag to reorder">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </div>

      <div className="panel-content">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="panel-name-input"
            value={editValue}
            onChange={onInputChange}
            onBlur={onInputBlur}
            onKeyDown={onInputKeyDown}
            onClick={(e) => e.stopPropagation()}
            aria-label="Panel name"
          />
        ) : (
          <span className="panel-name">{panel.name}</span>
        )}
      </div>

      <button
        className="panel-delete-btn"
        title="Delete Panel"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault() // Try to prevent default just in case
          console.log('%c[PanelLayout] DELETE BUTTON CLICKED', 'background: red; color: white', {
            panelId: panel.id,
            // index: index, // Index not available in this scope, removing
            button: 'Delete'
          })
          onDelete(e)
        }}
      // onPointerDown removed to ensure click works freely (listeners are on handle anyway)
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  )
}

export default function PanelLayout({
  panels,
  selectedPanel,
  onPanelSelect,
  onAddPanel,
  onDeletePanel,
  onRenamePanel,
  onReorderPanel
}: PanelLayoutProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8 // Increased drag delay to distinguish clicks better
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  useEffect(() => {
    if (editingIndex !== null && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingIndex])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = panels.findIndex((p) => p.id === active.id)
      const newIndex = panels.findIndex((p) => p.id === over?.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderPanel(oldIndex, newIndex)
      }
    }
  }

  const handleDoubleClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    const panel = panels[index]
    if (panel) {
      setEditValue(panel.name)
      setEditingIndex(index)
    }
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
      <div className="panels-list">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={panels.map(p => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {panels.map((panel, index) => (
              <SortablePanelItem
                key={panel.id}
                panel={panel}
                index={index}
                isSelected={index === selectedPanel}
                isEditing={editingIndex === index}
                editValue={editValue}
                inputRef={inputRef}
                onSelect={() => {
                  if (editingIndex !== index) onPanelSelect(index)
                }}
                onDoubleClick={(e) => handleDoubleClick(e, index)}
                onDelete={(e) => {
                  e.stopPropagation()
                  onDeletePanel(index)
                }}
                onInputChange={(e) => setEditValue(e.target.value)}
                onInputBlur={() => handleInputBlur(index)}
                onInputKeyDown={(e) => handleInputKeyDown(e, index)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <button className="add-panel-btn" title="Add Panel" onClick={onAddPanel}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        New Panel
      </button>
    </div>
  )
}
