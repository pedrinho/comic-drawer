import './PanelLayout.css'
import { PanelData } from '../App'

interface PanelLayoutProps {
  panels: PanelData[]
  selectedPanel: number
  onPanelSelect: (index: number) => void
  onAddPanel: () => void
}

export default function PanelLayout({ panels, selectedPanel, onPanelSelect, onAddPanel }: PanelLayoutProps) {
  return (
    <div className="panel-layout">
      <h3>Panels</h3>
      <div className="panels-container">
        {panels.map((panel, index) => (
          <div
            key={panel.id}
            className={`panel ${index === selectedPanel ? 'selected' : ''}`}
            onClick={() => onPanelSelect(index)}
          >
            Panel {index + 1}
          </div>
        ))}
        <button className="add-panel-btn" title="Add Panel" onClick={onAddPanel}>
          + Add Panel
        </button>
      </div>
    </div>
  )
}
