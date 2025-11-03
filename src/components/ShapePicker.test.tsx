import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ShapePicker from './ShapePicker'

describe('ShapePicker', () => {
  const defaultProps = {
    isOpen: true,
    selectedShape: 'rectangle' as const,
    onSelectShape: vi.fn(),
  }

  it('renders when open', () => {
    render(<ShapePicker {...defaultProps} />)
    expect(screen.getByTitle('rectangle')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<ShapePicker {...defaultProps} isOpen={false} />)
    expect(screen.queryByTitle('rectangle')).not.toBeInTheDocument()
  })

  it('renders all 12 shapes', () => {
    render(<ShapePicker {...defaultProps} />)
    expect(screen.getByTitle('triangle')).toBeInTheDocument()
    expect(screen.getByTitle('rectangle')).toBeInTheDocument()
    expect(screen.getByTitle('pentagon')).toBeInTheDocument()
    expect(screen.getByTitle('hexagon')).toBeInTheDocument()
    expect(screen.getByTitle('heptagon')).toBeInTheDocument()
    expect(screen.getByTitle('octagon')).toBeInTheDocument()
    expect(screen.getByTitle('circle')).toBeInTheDocument()
    expect(screen.getByTitle('diamond')).toBeInTheDocument()
    expect(screen.getByTitle('star')).toBeInTheDocument()
    expect(screen.getByTitle('heart')).toBeInTheDocument()
    expect(screen.getByTitle('arrow')).toBeInTheDocument()
    expect(screen.getByTitle('cross')).toBeInTheDocument()
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

