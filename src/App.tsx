import { useState, useRef, useEffect, useCallback } from 'react'
import jsPDF from 'jspdf'
import './App.css'
import Canvas from './components/Canvas'
import Toolbar from './components/Toolbar'
import PanelLayout from './components/PanelLayout'
import PanelLayoutModal from './components/PanelLayoutModal'
import { ShapeLayer } from './types/layers'
import { traceShapePath, drawGrid as drawGridUtil, debugLog, debugError, debugWarn, cloneImageData, createBlankImageData } from './utils/canvasUtils'

export type Tool = 'select' | 'pen' | 'eraser' | 'shapes' | 'objectShapes' | 'text' | 'fill' | 'balloon'
export type Shape = 'rectangle' | 'circle' | 'triangle' | 'star' | 'heart' | 'diamond' | 'hexagon' | 'pentagon' | 'arrow' | 'cross' | 'heptagon' | 'octagon'
export type PenType = 'fine' | 'small' | 'medium' | 'large' | 'thick' | 'verythick'

export interface PanelData {
  id: number
  data: ImageData | null
  layout: {
    rows: number
    columns: number[]
  }
  shapeLayers: ShapeLayer[]
}

interface SavedPanel {
  id: number
  data: string | null  // Base64 encoded ImageData
  layout: {
    rows: number
    columns: number[]
  }
  shapeLayers?: ShapeLayer[]
}

interface ComicFile {
  version: string
  panels: SavedPanel[]
}

interface PanelHistory {
  undo: ImageData[]
  redo: ImageData[]
}

const MAX_HISTORY = 10

const renderShapeLayerOnContext = (ctx: CanvasRenderingContext2D, layer: ShapeLayer) => {
  const { x, y, width, height, rotation, strokeColor, strokeWidth, fillColor, shape } = layer
  const centerX = x + width / 2
  const centerY = y + height / 2
  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.rotate(rotation)
  traceShapePath(ctx, shape, -width / 2, -height / 2, width / 2, height / 2)
  if (fillColor) {
    ctx.fillStyle = fillColor
    ctx.fill()
  }
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = strokeWidth
  ctx.stroke()
  ctx.restore()
}

function App() {
  const [currentTool, setCurrentTool] = useState<Tool>('pen')
  const [selectedShape, setSelectedShape] = useState<Shape>('rectangle')
  const [selectedPenType, setSelectedPenType] = useState<PenType>('medium')
  const [selectedColor, setSelectedColor] = useState<string>('#000000')
  const [selectedPanel, setSelectedPanel] = useState<number>(0)
  const [panels, setPanels] = useState<PanelData[]>([
    { id: 0, data: null, layout: { rows: 1, columns: [1] }, shapeLayers: [] }
  ])
  const [showModal, setShowModal] = useState(false)
  
  // History for each panel: Map<panelIndex, {undo: ImageData[], redo: ImageData[]}>
  const historyRef = useRef<Map<number, PanelHistory>>(new Map())

  const addPanel = () => {
    debugLog('App', 'Adding new panel')
    setShowModal(true)
  }

  const handlePanelLayoutConfirm = (rows: number, columns: number[]) => {
    debugLog('App', 'Panel layout confirmed', { rows, columns, newPanelId: panels.length })
    setPanels([...panels, { id: panels.length, data: null, layout: { rows, columns }, shapeLayers: [] }])
  }

  // Helper to get or initialize history for a panel
  const getPanelHistory = (panelIndex: number): PanelHistory => {
    if (!historyRef.current.has(panelIndex)) {
      historyRef.current.set(panelIndex, { undo: [], redo: [] })
    }
    return historyRef.current.get(panelIndex)!
  }

  // Save current state to history before making changes
  const saveToHistory = (panelIndex: number, currentData: ImageData | null) => {
    debugLog('App', 'Saving to history', { panelIndex, hasData: !!currentData })
    const history = getPanelHistory(panelIndex)
    
    let stateToSave: ImageData | null = null
    
    if (currentData) {
      // Clone the existing ImageData for history
      stateToSave = cloneImageData(currentData)
    } else {
      // If canvas is empty, create a blank white canvas as the initial state
      stateToSave = createBlankImageData()
    }
    
    if (stateToSave) {
      // Add to undo stack
      history.undo.push(stateToSave)
      
      // Limit to MAX_HISTORY
      if (history.undo.length > MAX_HISTORY) {
        history.undo.shift()
        debugWarn('App', 'History limit reached, removing oldest state')
      }
      
      // Clear redo stack when new action is performed
      history.redo = []
      debugLog('App', 'History saved', { undoStackSize: history.undo.length })
    }
  }

  const handleCanvasChange = (data: ImageData, skipHistory = false) => {
    debugLog('App', 'Canvas changed', { selectedPanel, skipHistory })
    const panel = panels[selectedPanel]
    if (!panel) return
    
    if (!skipHistory) {
      // Save current state to history before making changes
      const currentData = panel.data
      saveToHistory(selectedPanel, currentData)
    }
    
    const updatedPanels = [...panels]
    const updatedPanel = updatedPanels[selectedPanel]
    if (updatedPanel) {
      updatedPanel.data = data
      setPanels(updatedPanels)
    }
  }

  const handleShapeLayersChange = useCallback((layers: ShapeLayer[]) => {
    setPanels((prevPanels) => {
      const nextPanels = [...prevPanels]
      const panel = nextPanels[selectedPanel]
      if (!panel) {
        return prevPanels
      }
      nextPanels[selectedPanel] = { ...panel, shapeLayers: layers }
      return nextPanels
    })
  }, [selectedPanel])

  const handleUndo = useCallback(() => {
    debugLog('App', 'Undo requested', { selectedPanel })
    const panel = panels[selectedPanel]
    if (!panel) return
    
    const history = getPanelHistory(selectedPanel)
    const currentData = panel.data
    
    if (history.undo.length === 0) {
      debugWarn('App', 'Nothing to undo')
      return // Nothing to undo
    }
    
    // Move current state to redo stack if it exists
    if (currentData) {
      const clonedData = cloneImageData(currentData)
      history.redo.push(clonedData)
      if (history.redo.length > MAX_HISTORY) {
        history.redo.shift()
      }
    }
    
    // Restore previous state from undo stack
    const previousState = history.undo.pop()!
    const updatedPanels = [...panels]
    const updatedPanel = updatedPanels[selectedPanel]
    if (updatedPanel) {
      updatedPanel.data = previousState
      setPanels(updatedPanels)
    }
  }, [selectedPanel, panels])

  const handleRedo = useCallback(() => {
    debugLog('App', 'Redo requested', { selectedPanel })
    const panel = panels[selectedPanel]
    if (!panel) return
    
    const history = getPanelHistory(selectedPanel)
    const currentData = panel.data
    
    if (history.redo.length === 0) {
      debugWarn('App', 'Nothing to redo')
      return // Nothing to redo
    }
    
    // Move current state to undo stack if it exists
    if (currentData) {
      const clonedData = cloneImageData(currentData)
      history.undo.push(clonedData)
      if (history.undo.length > MAX_HISTORY) {
        history.undo.shift()
      }
    }
    
    // Restore next state from redo stack
    const nextState = history.redo.pop()!
    const updatedPanels = [...panels]
    const updatedPanel = updatedPanels[selectedPanel]
    if (updatedPanel) {
      updatedPanel.data = nextState
      setPanels(updatedPanels)
    }
  }, [selectedPanel, panels])

  const handlePanelSwitch = (index: number) => {
    debugLog('App', 'Switching panel', { from: selectedPanel, to: index })
    // Save current canvas before switching
    setSelectedPanel(index)
  }

  const handleDeletePanel = (index: number) => {
    debugLog('App', 'Delete panel requested', { index, totalPanels: panels.length })
    // Don't allow deleting the last panel
    if (panels.length <= 1) {
      debugWarn('App', 'Cannot delete last panel')
      return
    }

    // Ask for confirmation before deleting
    const confirmed = window.confirm(`Are you sure you want to delete Panel ${index + 1}? This action cannot be undone.`)
    if (!confirmed) {
      debugLog('App', 'Panel deletion cancelled')
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
    debugLog('App', 'Saving comic file', { panelCount: panels.length })
    // Convert ImageData to base64 for each panel
    const savedPanels: SavedPanel[] = panels.map(panel => ({
      id: panel.id,
      data: panel.data ? imageDataToBase64(panel.data) : null,
      layout: panel.layout,
      shapeLayers: panel.shapeLayers
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
    debugLog('App', 'Comic file saved successfully')
  }

  const handleLoad = () => {
    debugLog('App', 'Loading comic file')
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.cd,application/json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) {
        debugWarn('App', 'No file selected')
        return
      }

      debugLog('App', 'File selected', { fileName: file.name, fileSize: file.size })
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const jsonStr = event.target?.result as string
          const comicFile: ComicFile = JSON.parse(jsonStr)
          debugLog('App', 'Comic file parsed', { version: comicFile.version, panelCount: comicFile.panels.length })
          
          // Convert base64 back to ImageData (async)
          const loadedPanels: PanelData[] = await Promise.all(
            comicFile.panels.map(async (panel) => ({
              id: panel.id,
              data: panel.data ? await base64ToImageData(panel.data) : null,
              layout: panel.layout,
              shapeLayers: panel.shapeLayers ?? []
            }))
          )

          setPanels(loadedPanels)
          setSelectedPanel(0)
          debugLog('App', 'Comic file loaded successfully', { loadedPanelCount: loadedPanels.length })
        } catch (error) {
          debugError('App', 'Error loading file', error)
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
    drawGridUtil(ctx, panel.layout)

    // Draw shape layers if any
    if (panel.shapeLayers && panel.shapeLayers.length > 0) {
      panel.shapeLayers.forEach((layer) => {
        renderShapeLayerOnContext(ctx, layer)
      })
    }

    return canvas
  }

  const handleExportPDF = async () => {
    debugLog('App', 'Exporting PDF', { panelCount: panels.length })
    if (panels.length === 0) {
      debugWarn('App', 'No panels to export')
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
        if (!panel) {
          console.error(`Panel ${i + 1} is undefined`)
          continue
        }
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
      debugLog('App', 'PDF exported successfully')
    } catch (error) {
      debugError('App', 'Error exporting PDF', error)
      alert('Error exporting PDF. Please try again.')
    }
  }

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
      // Ctrl+Shift+Z or Cmd+Shift+Z for redo
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault()
        handleRedo()
      }
      // Ctrl+Y or Cmd+Y for redo (alternative)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleUndo, handleRedo])

  // Initialize history when panels change or panel is switched
  useEffect(() => {
    // Initialize history for new panels
    panels.forEach((_, index) => {
      getPanelHistory(index)
    })
  }, [panels.length])

  return (
    <div className="app">
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>🎨 Comic Drawer</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={handleUndo} 
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', cursor: 'pointer' }}
              title="Undo (Ctrl+Z)"
            >
              ↶ Undo
            </button>
            <button 
              onClick={handleRedo} 
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', cursor: 'pointer' }}
              title="Redo (Ctrl+Shift+Z)"
            >
              ↷ Redo
            </button>
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
        {panels[selectedPanel] && (
          <Canvas 
            tool={currentTool} 
            shape={selectedShape}
            penType={selectedPenType}
            color={selectedColor}
            panelData={panels[selectedPanel]!.data}
            layout={panels[selectedPanel]!.layout}
            shapeLayers={panels[selectedPanel]!.shapeLayers}
            onCanvasChange={handleCanvasChange}
            onShapeLayersChange={handleShapeLayersChange}
            key={selectedPanel}
          />
        )}
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
