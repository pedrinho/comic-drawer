import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import EraserPicker from './EraserPicker'

describe('EraserPicker', () => {
  const defaultProps = {
    isOpen: true,
    selectedSize: 'medium' as const,
    onSelectSize: vi.fn(),
  }

  it('renders the three sizes with their widths', () => {
    render(<EraserPicker {...defaultProps} />)
    expect(screen.getByTitle('Small (10px)')).toBeInTheDocument()
    expect(screen.getByTitle('Medium (20px)')).toBeInTheDocument()
    expect(screen.getByTitle('Large (40px)')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<EraserPicker {...defaultProps} isOpen={false} />)
    expect(screen.queryByTitle('Small (10px)')).not.toBeInTheDocument()
  })

  it('calls onSelectSize when a size is clicked', async () => {
    const user = userEvent.setup()
    const onSelectSize = vi.fn()
    render(<EraserPicker {...defaultProps} onSelectSize={onSelectSize} />)
    await user.click(screen.getByTitle('Large (40px)'))
    expect(onSelectSize).toHaveBeenCalledWith('large')
  })

  it('highlights the selected size', () => {
    render(<EraserPicker {...defaultProps} selectedSize="small" />)
    expect(screen.getByTitle('Small (10px)').closest('button')).toHaveClass('selected')
  })
})
