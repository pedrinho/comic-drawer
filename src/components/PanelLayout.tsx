import './PanelLayout.css'
import { PanelData } from '../App'

interface PanelLayoutProps {
  panels: PanelData[]
  selectedPanel: number
  onPanelSelect: (index: number) => void
  onAddPanel: () => void
  onDeletePanel: (index: number) => void
}

export default function PanelLayout({ panels, selectedPanel, onPanelSelect, onAddPanel, onDeletePanel }: PanelLayoutProps) {
  const handleDeleteClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation() // Prevent panel selection when clicking delete
    onDeletePanel(index)
  }

  return (
    <div className="panel-layout">
      <h3>Panels</h3>
      <div className="panels-container">
        {panels.map((_, index) => (
          <div
            key={index}
            className={`panel ${index === selectedPanel ? 'selected' : ''}`}
            onClick={() => onPanelSelect(index)}
          >
            <span>Panel {index + 1}</span>
            {panels.length > 1 && (
              <button
                className="panel-delete-btn"
                title="Delete Panel"
                onClick={(e) => handleDeleteClick(e, index)}
                aria-label="Delete panel"
              >
                ×
              </button>
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
