import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ShapePicker from './ShapePicker'

describe('ShapePicker', () => {
  const defaultProps = {
    isOpen: true,
    selectedShape: 'star' as const,
    onSelectShape: vi.fn(),
  }

  it('renders when open', () => {
    render(<ShapePicker {...defaultProps} />)
    expect(screen.getByTitle('star')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<ShapePicker {...defaultProps} isOpen={false} />)
    expect(screen.queryByTitle('star')).not.toBeInTheDocument()
  })

  it('defaults to the objects list, including circle and diamond', () => {
    render(<ShapePicker {...defaultProps} />)
    for (const name of ['star', 'heart', 'arrow', 'cross', 'circle', 'diamond']) {
      expect(screen.getByTitle(name)).toBeInTheDocument()
    }
    for (const name of ['rectangle', 'triangle', 'polygon', 'hexagon']) {
      expect(screen.queryByTitle(name)).not.toBeInTheDocument()
    }
  })

  it('calls onSelectShape when a shape is clicked', async () => {
    const user = userEvent.setup()
    const onSelectShape = vi.fn()
    render(<ShapePicker {...defaultProps} onSelectShape={onSelectShape} />)
    
    await user.click(screen.getByTitle('circle'))
    expect(onSelectShape).toHaveBeenCalledWith('circle')
  })

  it('highlights the selected shape', () => {
    render(<ShapePicker {...defaultProps} selectedShape="heart" />)
    const heartButton = screen.getByTitle('heart').closest('button')
    expect(heartButton).toHaveClass('selected')
  })
})
