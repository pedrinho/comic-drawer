import { useState } from 'react'
import jsPDF from 'jspdf'
import './App.css'
import Canvas from './components/Canvas'
import Toolbar from './components/Toolbar'
import PanelLayout from './components/PanelLayout'
import PanelLayoutModal from './components/PanelLayoutModal'

export type Tool = 'select' | 'pen' | 'eraser' | 'shapes' | 'text' | 'fill' | 'balloon'
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

  const handleDeletePanel = (index: number) => {
    // Don't allow deleting the last panel
    if (panels.length <= 1) {
      return
    }

    // Ask for confirmation before deleting
    const confirmed = window.confirm(`Are you sure you want to delete Panel ${index + 1}? This action cannot be undone.`)
    if (!confirmed) {
      return
    }

    // Remove the panel
    const updatedPanels = panels.filter((_, i) => i !== index)
    setPanels(updatedPanels)

    // Adjust selected panel if necessary
    if (selectedPanel >= updatedPanels.length) {
      // If we deleted the last panel, select the new last panel
      setSelectedPanel(updatedPanels.length - 1)
    } else if (selectedPanel > index) {
      // If we deleted a panel before the selected one, adjust index
      setSelectedPanel(selectedPanel - 1)
    }
    // If we deleted a panel after the selected one, no adjustment needed
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

  // Helper function to draw grid on canvas (matching Canvas component)
  const drawGrid = (ctx: CanvasRenderingContext2D, layout: { rows: number; columns: number[] }) => {
    ctx.save()
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 3

    const totalRows = layout.rows
    const gutter = 12 // Space between panels (and around edges)
    const canvasWidth = 1200
    const canvasHeight = 800

    for (let row = 0; row < totalRows; row++) {
      const columnsInRow = layout.columns[row] || 1
      
      // Calculate spacing: gutter on each side + gutters between cells
      const totalVerticalGutters = gutter * 2 + (totalRows - 1) * gutter
      const totalHorizontalGutters = gutter * 2 + (columnsInRow - 1) * gutter
      const panelHeight = (canvasHeight - totalVerticalGutters) / totalRows
      const panelWidth = (canvasWidth - totalHorizontalGutters) / columnsInRow
      
      let currentX = gutter
      const currentY = gutter + (row * (panelHeight + gutter))

      // Draw rectangle for each cell in the row
      for (let col = 0; col < columnsInRow; col++) {
        ctx.beginPath()
        ctx.rect(currentX, currentY, panelWidth, panelHeight)
        ctx.stroke()
        currentX += panelWidth + gutter
      }
    }

    ctx.restore()
  }

  // Helper function to render panel to canvas with grid
  const renderPanelToCanvas = (panel: PanelData): HTMLCanvasElement | null => {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 800
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Fill with white background
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw panel data if available
    if (panel.data) {
      ctx.putImageData(panel.data, 0, 0)
    }

    // Draw grid on top
    drawGrid(ctx, panel.layout)

    return canvas
  }

  const handleExportPDF = async () => {
    if (panels.length === 0) {
      alert('No panels to export')
      return
    }

    try {
      // Create a new PDF document (A4 size in landscape for better panel fit)
      // A4 in mm: 297 x 210, but we'll use landscape: 210 x 297
      // Canvas is 1200x800, so we'll scale it to fit
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()

      // Render each panel as a separate page
      for (let i = 0; i < panels.length; i++) {
        const panel = panels[i]
        const canvas = renderPanelToCanvas(panel)
        
        if (!canvas) {
          console.error(`Failed to render panel ${i + 1}`)
          continue
        }

        // Convert canvas to image
        const imgData = canvas.toDataURL('image/png')
        
        // Add new page for each panel except the first
        if (i > 0) {
          pdf.addPage()
        }

        // Calculate scaling to fit the page while maintaining aspect ratio
        const canvasAspectRatio = canvas.width / canvas.height
        const pdfAspectRatio = pdfWidth / pdfHeight

        let imgWidth: number
        let imgHeight: number
        let x: number
        let y: number

        if (canvasAspectRatio > pdfAspectRatio) {
          // Canvas is wider, fit to width
          imgWidth = pdfWidth - 20 // 10mm margin on each side
          imgHeight = imgWidth / canvasAspectRatio
          x = 10
          y = (pdfHeight - imgHeight) / 2
        } else {
          // Canvas is taller, fit to height
          imgHeight = pdfHeight - 20 // 10mm margin on top and bottom
          imgWidth = imgHeight * canvasAspectRatio
          x = (pdfWidth - imgWidth) / 2
          y = 10
        }

        // Add image to PDF
        pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight)
      }

      // Save the PDF
      pdf.save('comic.pdf')
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Error exporting PDF. Please try again.')
    }
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
            <button onClick={handleExportPDF} style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', cursor: 'pointer' }}>
              📄 Export PDF
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
          onDeletePanel={handleDeletePanel}
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
