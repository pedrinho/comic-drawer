import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PenPicker from './PenPicker'

describe('PenPicker', () => {
  const defaultProps = {
    isOpen: true,
    selectedPenType: 'medium' as const,
    onSelectPenType: vi.fn(),
  }

  it('renders when open', () => {
    render(<PenPicker {...defaultProps} />)
    expect(screen.getByTitle('Fine')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<PenPicker {...defaultProps} isOpen={false} />)
    expect(screen.queryByTitle('Fine')).not.toBeInTheDocument()
  })

  it('renders all 6 pen types', () => {
    render(<PenPicker {...defaultProps} />)
    expect(screen.getByTitle('Fine')).toBeInTheDocument()
    expect(screen.getByTitle('Small')).toBeInTheDocument()
    expect(screen.getByTitle('Medium')).toBeInTheDocument()
    expect(screen.getByTitle('Large')).toBeInTheDocument()
    expect(screen.getByTitle('Thick')).toBeInTheDocument()
    expect(screen.getByTitle('Very Thick')).toBeInTheDocument()
  })

  it('calls onSelectPenType when a pen is clicked', async () => {
    const user = userEvent.setup()
    const onSelectPenType = vi.fn()
    render(<PenPicker {...defaultProps} onSelectPenType={onSelectPenType} />)
    
    await user.click(screen.getByTitle('Small'))
    expect(onSelectPenType).toHaveBeenCalledWith('small')
  })

  it('highlights the selected pen type', () => {
    render(<PenPicker {...defaultProps} selectedPenType="large" />)
    const largeButton = screen.getByTitle('Large').closest('button')
    expect(largeButton).toHaveClass('selected')
  })
})

