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
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
      />
    )

    expect(screen.getByText('Panel 1')).toBeInTheDocument()
    expect(screen.getByText('Panel 2')).toBeInTheDocument()
  })

  it('highlights the selected panel', () => {
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={1}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
      />
    )

    const panel2 = screen.getByText('Panel 2').closest('div')
    expect(panel2).toHaveClass('selected')
  })

  it('calls onPanelSelect when a panel is clicked', async () => {
    const user = userEvent.setup()
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
      />
    )

    await user.click(screen.getByText('Panel 2'))
    expect(onPanelSelect).toHaveBeenCalledWith(1)
  })

  it('calls onAddPanel when add panel button is clicked', async () => {
    const user = userEvent.setup()
    const onPanelSelect = vi.fn()
    const onAddPanel = vi.fn()
    render(
      <PanelLayout
        panels={mockPanels}
        selectedPanel={0}
        onPanelSelect={onPanelSelect}
        onAddPanel={onAddPanel}
      />
    )

    await user.click(screen.getByText('+ Add Panel'))
    expect(onAddPanel).toHaveBeenCalled()
  })
})
