import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PanelLayoutModal from './PanelLayoutModal'

describe('PanelLayoutModal', () => {
  it('does not render when closed', () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(<PanelLayoutModal isOpen={false} onClose={onClose} onConfirm={onConfirm} />)

    expect(screen.queryByText('Configure Panel Layout')).not.toBeInTheDocument()
  })

  it('renders when open', () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(<PanelLayoutModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />)

    expect(screen.getByText('Configure Panel Layout')).toBeInTheDocument()
    expect(screen.getByText('Number of Rows:')).toBeInTheDocument()
  })

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(<PanelLayoutModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />)

    await user.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onConfirm with default values when confirm is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(<PanelLayoutModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />)

    await user.click(screen.getByText('Create Panel'))
    expect(onConfirm).toHaveBeenCalledWith(1, [1])
  })

  it('updates columns when rows change', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(<PanelLayoutModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />)

    const rowsInput = screen.getByLabelText('Number of Rows:')
    await user.clear(rowsInput)
    await user.type(rowsInput, '2')

    expect(screen.getByLabelText('Row 1:')).toBeInTheDocument()
    expect(screen.getByLabelText('Row 2:')).toBeInTheDocument()
  })

  it('calls onConfirm with updated values', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(<PanelLayoutModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />)

    const rowsInput = screen.getByLabelText('Number of Rows:')
    await user.click(rowsInput)
    await user.keyboard('{Backspace}2')

    await user.click(screen.getByText('Create Panel'))
    expect(onConfirm).toHaveBeenCalledWith(2, [1, 1])
  })

  it('calls onClose when overlay is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(<PanelLayoutModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />)

    const overlay = screen.getByText('Configure Panel Layout').closest('.modal-overlay')
    if (overlay) {
      await user.click(overlay)
      expect(onClose).toHaveBeenCalled()
    }
  })
})
