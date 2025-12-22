
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PanelLayout from './components/PanelLayout'
import { PanelData } from './types/common'

// Mock PanelData
const createMockPanel = (id: number, name: string): PanelData => ({
    id,
    name,
    data: null,
    layout: { rows: 1, columns: [1] },
    shapeLayers: [],
    textLayers: []
})

describe('PanelLayout Delete Bug', () => {
    it('should call onDeletePanel when delete button is clicked on the first panel', () => {
        // Setup 2 panels (simulating the duplicate issue)
        const panels = [
            createMockPanel(1001, 'Panel 2'),
            createMockPanel(1002, 'Panel 2')
        ]

        const handleDelete = vi.fn()
        const handleSelect = vi.fn()
        const handleAdd = vi.fn()
        const handleRename = vi.fn()
        const handleMove = vi.fn()
        const handleReorder = vi.fn()

        // Warn: We need to mock window.confirm if it was inside the component, 
        // but PanelLayout calls the prop function directly. 
        // App.tsx handles the actual confirm logic. 
        // We are testing if the click REACHES the prop function.

        render(
            <PanelLayout
                panels={panels}
                selectedPanel={0}
                onPanelSelect={handleSelect}
                onAddPanel={handleAdd}
                onDeletePanel={handleDelete}
                onRenamePanel={handleRename}
                onMovePanel={handleMove}
                onReorderPanel={handleReorder}
            />
        )

        // Find all delete buttons
        // The component renders a button with title "Delete Panel"
        const deleteButtons = screen.getAllByTitle('Delete Panel')
        expect(deleteButtons.length).toBe(2)

        // Click the first one
        console.log('Attempting to click delete button 0')
        fireEvent.click(deleteButtons[0])

        // Verify callback
        expect(handleDelete).toHaveBeenCalledTimes(1)
        expect(handleDelete).toHaveBeenCalledWith(0)
    })
})
