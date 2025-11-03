import { useState } from 'react'
import './App.css'
import Canvas from './components/Canvas'
import Toolbar from './components/Toolbar'
import PanelLayout from './components/PanelLayout'
import PanelLayoutModal from './components/PanelLayoutModal'

export type Tool = 'pen' | 'eraser' | 'shapes' | 'text' | 'fill' | 'balloon'
export type Shape = 'rectangle' | 'circle' | 'triangle' | 'star' | 'heart' | 'diamond' | 'hexagon' | 'pentagon' | 'arrow' | 'cross' | 'heptagon' | 'octagon'
export type PenType = 'fine' | 'small' | 'medium' | 'large' | 'thick' | 'verythick'

export interface PanelData {
  id: number
  data: ImageData | null
  layout: {
    rows: number
    columns: number[]
  }
}

interface SavedPanel {
  id: number
  data: string | null  // Base64 encoded ImageData
  layout: {
    rows: number
    columns: number[]
  }
}

interface ComicFile {
  version: string
  panels: SavedPanel[]
}

function App() {
  const [currentTool, setCurrentTool] = useState<Tool>('pen')
  const [selectedShape, setSelectedShape] = useState<Shape>('rectangle')
  const [selectedPenType, setSelectedPenType] = useState<PenType>('medium')
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

  const handleSave = () => {
    // Convert ImageData to base64 for each panel
    const savedPanels: SavedPanel[] = panels.map(panel => ({
      id: panel.id,
      data: panel.data ? imageDataToBase64(panel.data) : null,
      layout: panel.layout
    }))

    const comicFile: ComicFile = {
      version: '0.1.0',
      panels: savedPanels
    }

    const jsonStr = JSON.stringify(comicFile, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'comic.cd'  // .cd = Comic Drawer
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleLoad = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.cd,application/json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const jsonStr = event.target?.result as string
          const comicFile: ComicFile = JSON.parse(jsonStr)
          
          // Convert base64 back to ImageData (async)
          const loadedPanels: PanelData[] = await Promise.all(
            comicFile.panels.map(async (panel) => ({
              id: panel.id,
              data: panel.data ? await base64ToImageData(panel.data) : null,
              layout: panel.layout
            }))
          )

          setPanels(loadedPanels)
          setSelectedPanel(0)
        } catch (error) {
          console.error('Error loading file:', error)
          alert('Error loading comic file. Please check the file format.')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  // Helper function to convert ImageData to base64
  const imageDataToBase64 = (imageData: ImageData): string => {
    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL('image/png')
  }

  // Helper function to convert base64 to ImageData
  const base64ToImageData = async (base64: string): Promise<ImageData | null> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      canvas.width = 1200
      canvas.height = 800
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0)
        resolve(ctx.getImageData(0, 0, 1200, 800))
      }
      img.onerror = () => resolve(null)
      img.src = base64
    })
  }

  return (
    <div className="app">
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>🎨 Comic Drawer</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleSave} style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', cursor: 'pointer' }}>
              💾 Save
            </button>
            <button onClick={handleLoad} style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', cursor: 'pointer' }}>
              📂 Load
            </button>
          </div>
        </div>
      </header>
      <main>
        <Toolbar 
          currentTool={currentTool} 
          onToolChange={setCurrentTool}
          color={selectedColor}
          onColorChange={setSelectedColor}
          selectedShape={selectedShape}
          onSelectShape={setSelectedShape}
          selectedPenType={selectedPenType}
          onSelectPenType={setSelectedPenType}
        />
        <PanelLayout 
          panels={panels}
          selectedPanel={selectedPanel}
          onPanelSelect={handlePanelSwitch}
          onAddPanel={addPanel}
        />
        <Canvas 
          tool={currentTool} 
          shape={selectedShape}
          penType={selectedPenType}
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
