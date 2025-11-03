import { useState } from 'react'
import './App.css'
import Canvas from './components/Canvas'
import Toolbar from './components/Toolbar'
import PanelLayout from './components/PanelLayout'
import PanelLayoutModal from './components/PanelLayoutModal'

export type Tool = 'pen' | 'eraser' | 'rect' | 'ellipse' | 'text' | 'fill'

export interface PanelData {
  id: number
  data: ImageData | null
  layout: {
    rows: number
    columns: number[]
  }
}

function App() {
  const [currentTool, setCurrentTool] = useState<Tool>('pen')
  const [selectedColor, setSelectedColor] = useState<string>('#000000')
  const [selectedPanel, setSelectedPanel] = useState<number>(0)
  const [panels, setPanels] = useState<PanelData[]>([
    { id: 0, data: null, layout: { rows: 1, columns: [1] } }
  ])
  const [showModal, setShowModal] = useState(false)

  const addPanel = () => {
    setShowModal(true)
  }

  const handlePanelLayoutConfirm = (rows: number, columns: number[]) => {
    setPanels([...panels, { id: panels.length, data: null, layout: { rows, columns } }])
  }

  const handleCanvasChange = (data: ImageData) => {
    const updatedPanels = [...panels]
    updatedPanels[selectedPanel].data = data
    setPanels(updatedPanels)
  }

  const handlePanelSwitch = (index: number) => {
    // Save current canvas before switching
    setSelectedPanel(index)
  }

  return (
    <div className="app">
      <header>
        <h1>🎨 Comic Drawer</h1>
      </header>
      <main>
        <Toolbar 
          currentTool={currentTool} 
          onToolChange={setCurrentTool}
          color={selectedColor}
          onColorChange={setSelectedColor}
        />
        <PanelLayout 
          panels={panels}
          selectedPanel={selectedPanel}
          onPanelSelect={handlePanelSwitch}
          onAddPanel={addPanel}
        />
        <Canvas 
          tool={currentTool} 
          color={selectedColor}
          panelData={panels[selectedPanel].data}
          layout={panels[selectedPanel].layout}
          onCanvasChange={handleCanvasChange}
          key={selectedPanel}
        />
      </main>
      <PanelLayoutModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handlePanelLayoutConfirm}
      />
    </div>
  )
}

export default App
