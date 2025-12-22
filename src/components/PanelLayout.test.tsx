import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PanelLayout from './PanelLayout'
import { PanelData } from '../types/common'

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
        onReorderPanel={vi.fn()}
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
        onReorderPanel={vi.fn()}
      />
    )

    const panel2 = screen.getByText('Panel 2').closest('.panel-item')
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
        onReorderPanel={vi.fn()}
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
        onReorderPanel={vi.fn()}
      />
    )

    await user.click(screen.getByText('New Panel'))
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
        onReorderPanel={vi.fn()}
      />
    )

    const deleteButtons = screen.getAllByTitle('Delete Panel')
    expect(deleteButtons.length).toBe(2)
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
        onReorderPanel={vi.fn()}
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
        onReorderPanel={vi.fn()}
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
        onReorderPanel={vi.fn()}
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
        onReorderPanel={vi.fn()}
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
        onReorderPanel={vi.fn()}
      />
    )

    const panel1 = screen.getByText('Panel 1')
    await user.dblClick(panel1)

    const input = screen.getByDisplayValue('Panel 1') as HTMLInputElement
    await user.type(input, '{Escape}')

    expect(onRenamePanel).not.toHaveBeenCalled()
    expect(screen.getByText('Panel 1')).toBeInTheDocument()
  })


})
