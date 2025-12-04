import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PanelLayout from './PanelLayout'
import { PanelData } from '../App'

describe('PanelLayout', () => {
  const mockPanels: PanelData[] = [
    { id: 0, name: 'Panel 1', data: null, layout: { rows: 1, columns: [1] }, shapeLayers: [], textLayers: [] },
    { id: 1, name: 'Panel 2', data: null, layout: { rows: 2, columns: [1, 2] }, shapeLayers: [], textLayers: [] },
  ]

  it('renders all panels', () => {
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    const onRenamePanel = vi.fn()
    const onMovePanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
        onRenamePanel={onRenamePanel}
        onMovePanel={onMovePanel}
      />
    )

    expect(screen.getByText('Panel 1')).toBeInTheDocument()
    expect(screen.getByText('Panel 2')).toBeInTheDocument()
  })

  it('highlights the selected panel', () => {
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    const onRenamePanel = vi.fn()
    const onMovePanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={1}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
        onRenamePanel={onRenamePanel}
        onMovePanel={onMovePanel}
      />
    )

    const panel2 = screen.getByText('Panel 2').closest('div')
    expect(panel2).toHaveClass('selected')
  })

  it('calls onPanelSelect when a panel is clicked', async () => {
    const user = userEvent.setup()
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    const onRenamePanel = vi.fn()
    const onMovePanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
        onRenamePanel={onRenamePanel}
        onMovePanel={onMovePanel}
      />
    )

    await user.click(screen.getByText('Panel 2'))
    expect(onPanelSelect).toHaveBeenCalledWith(1)
  })

  it('calls onAddPanel when add panel button is clicked', async () => {
    const user = userEvent.setup()
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    const onRenamePanel = vi.fn()
    const onMovePanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
        onRenamePanel={onRenamePanel}
        onMovePanel={onMovePanel}
      />
    )

    await user.click(screen.getByText('+ Add Panel'))
    expect(onAddPanel).toHaveBeenCalled()
  })

  it('renders delete button when there are multiple panels', () => {
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    const onRenamePanel = vi.fn()
    const onMovePanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
        onRenamePanel={onRenamePanel}
        onMovePanel={onMovePanel}
      />
    )

    const deleteButtons = screen.getAllByTitle('Delete Panel')
    expect(deleteButtons.length).toBe(2)
  })

  it('does not render delete button when there is only one panel', () => {
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    const onRenamePanel = vi.fn()
    const onMovePanel = vi.fn()
    const singlePanel: PanelData[] = [
      { id: 0, name: 'Panel 1', data: null, layout: { rows: 1, columns: [1] }, shapeLayers: [], textLayers: [] },
    ]
    render(
      <PanelLayout
        panels={singlePanel}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
        onRenamePanel={onRenamePanel}
        onMovePanel={onMovePanel}
      />
    )

    expect(screen.queryByTitle('Delete Panel')).not.toBeInTheDocument()
  })

  it('calls onDeletePanel when delete button is clicked', async () => {
    const user = userEvent.setup()
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    const onRenamePanel = vi.fn()
    const onMovePanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
        onRenamePanel={onRenamePanel}
        onMovePanel={onMovePanel}
      />
    )

    const deleteButtons = screen.getAllByTitle('Delete Panel')
    await user.click(deleteButtons[0])
    expect(onDeletePanel).toHaveBeenCalledWith(0)
    expect(onPanelSelect).not.toHaveBeenCalled()
  })

  it('enters edit mode when panel name is double-clicked', async () => {
    const user = userEvent.setup()
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    const onRenamePanel = vi.fn()
    const onMovePanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
        onRenamePanel={onRenamePanel}
        onMovePanel={onMovePanel}
      />
    )

    const panel1 = screen.getByText('Panel 1')
    await user.dblClick(panel1)
    
    const input = screen.getByDisplayValue('Panel 1')
    expect(input).toBeInTheDocument()
    expect(input).toHaveClass('panel-name-input')
  })

  it('calls onRenamePanel when input is blurred with new value', async () => {
    const user = userEvent.setup()
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    const onRenamePanel = vi.fn()
    const onMovePanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
        onRenamePanel={onRenamePanel}
        onMovePanel={onMovePanel}
      />
    )

    const panel1 = screen.getByText('Panel 1')
    await user.dblClick(panel1)
    
    const input = screen.getByDisplayValue('Panel 1') as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'My Custom Panel')
    await user.tab() // Blur the input
    
    expect(onRenamePanel).toHaveBeenCalledWith(0, 'My Custom Panel')
  })

  it('calls onRenamePanel when Enter is pressed', async () => {
    const user = userEvent.setup()
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    const onRenamePanel = vi.fn()
    const onMovePanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
        onRenamePanel={onRenamePanel}
        onMovePanel={onMovePanel}
      />
    )

    const panel1 = screen.getByText('Panel 1')
    await user.dblClick(panel1)
    
    const input = screen.getByDisplayValue('Panel 1') as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'New Name{Enter}')
    
    expect(onRenamePanel).toHaveBeenCalledWith(0, 'New Name')
  })

  it('cancels editing when Escape is pressed', async () => {
    const user = userEvent.setup()
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    const onRenamePanel = vi.fn()
    const onMovePanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
        onRenamePanel={onRenamePanel}
        onMovePanel={onMovePanel}
      />
    )

    const panel1 = screen.getByText('Panel 1')
    await user.dblClick(panel1)
    
    const input = screen.getByDisplayValue('Panel 1') as HTMLInputElement
    await user.type(input, '{Escape}')
    
    expect(onRenamePanel).not.toHaveBeenCalled()
    expect(screen.getByText('Panel 1')).toBeInTheDocument()
  })

  it('renders move buttons when there are multiple panels', () => {
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    const onRenamePanel = vi.fn()
    const onMovePanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
        onRenamePanel={onRenamePanel}
        onMovePanel={onMovePanel}
      />
    )

    const moveUpButtons = screen.getAllByTitle('Move Up')
    const moveDownButtons = screen.getAllByTitle('Move Down')
    expect(moveUpButtons.length).toBe(2)
    expect(moveDownButtons.length).toBe(2)
  })

  it('disables move up button for first panel', () => {
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    const onRenamePanel = vi.fn()
    const onMovePanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
        onRenamePanel={onRenamePanel}
        onMovePanel={onMovePanel}
      />
    )

    const moveUpButtons = screen.getAllByTitle('Move Up')
    expect(moveUpButtons[0]).toBeDisabled()
    expect(moveUpButtons[1]).not.toBeDisabled()
  })

  it('disables move down button for last panel', () => {
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    const onRenamePanel = vi.fn()
    const onMovePanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
        onRenamePanel={onRenamePanel}
        onMovePanel={onMovePanel}
      />
    )

    const moveDownButtons = screen.getAllByTitle('Move Down')
    expect(moveDownButtons[0]).not.toBeDisabled()
    expect(moveDownButtons[1]).toBeDisabled()
  })

  it('calls onMovePanel with up direction when move up button is clicked', async () => {
    const user = userEvent.setup()
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    const onRenamePanel = vi.fn()
    const onMovePanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
        onRenamePanel={onRenamePanel}
        onMovePanel={onMovePanel}
      />
    )

    const moveUpButtons = screen.getAllByTitle('Move Up')
    await user.click(moveUpButtons[1]) // Click the second panel's move up button
    
    expect(onMovePanel).toHaveBeenCalledWith(1, 'up')
    expect(onPanelSelect).not.toHaveBeenCalled()
  })

  it('calls onMovePanel with down direction when move down button is clicked', async () => {
    const user = userEvent.setup()
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    const onRenamePanel = vi.fn()
    const onMovePanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
        onRenamePanel={onRenamePanel}
        onMovePanel={onMovePanel}
      />
    )

    const moveDownButtons = screen.getAllByTitle('Move Down')
    await user.click(moveDownButtons[0]) // Click the first panel's move down button
    
    expect(onMovePanel).toHaveBeenCalledWith(0, 'down')
    expect(onPanelSelect).not.toHaveBeenCalled()
  })

  it('does not render move buttons when there is only one panel', () => {
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    const onRenamePanel = vi.fn()
    const onMovePanel = vi.fn()
    const singlePanel: PanelData[] = [
      { id: 0, name: 'Panel 1', data: null, layout: { rows: 1, columns: [1] }, shapeLayers: [], textLayers: [] },
    ]
    render(
      <PanelLayout
        panels={singlePanel}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
        onRenamePanel={onRenamePanel}
        onMovePanel={onMovePanel}
      />
    )

    expect(screen.queryByTitle('Move Up')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Move Down')).not.toBeInTheDocument()
  })
})
