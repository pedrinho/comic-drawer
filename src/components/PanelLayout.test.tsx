import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PanelLayout from './PanelLayout'
import { PanelData } from '../App'

describe('PanelLayout', () => {
  const mockPanels: PanelData[] = [
    { id: 0, data: null, layout: { rows: 1, columns: [1] } },
    { id: 1, data: null, layout: { rows: 2, columns: [1, 2] } },
  ]

  it('renders all panels', () => {
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
      />
    )

    expect(screen.getByText('Panel 1')).toBeInTheDocument()
    expect(screen.getByText('Panel 2')).toBeInTheDocument()
  })

  it('highlights the selected panel', () => {
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={1}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
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
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
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
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
      />
    )

    await user.click(screen.getByText('+ Add Panel'))
    expect(onAddPanel).toHaveBeenCalled()
  })

  it('renders delete button when there are multiple panels', () => {
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
      />
    )

    const deleteButtons = screen.getAllByTitle('Delete Panel')
    expect(deleteButtons.length).toBe(2)
  })

  it('does not render delete button when there is only one panel', () => {
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    const singlePanel: PanelData[] = [
      { id: 0, data: null, layout: { rows: 1, columns: [1] } },
    ]
    render(
      <PanelLayout
        panels={singlePanel}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
      />
    )

    expect(screen.queryByTitle('Delete Panel')).not.toBeInTheDocument()
  })

  it('calls onDeletePanel when delete button is clicked', async () => {
    const user = userEvent.setup()
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    const onDeletePanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
        onDeletePanel={onDeletePanel}
      />
    )

    const deleteButtons = screen.getAllByTitle('Delete Panel')
    await user.click(deleteButtons[0])
    expect(onDeletePanel).toHaveBeenCalledWith(0)
    expect(onPanelSelect).not.toHaveBeenCalled()
  })
})
