import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ShapePicker, { OBJECT_SHAPES } from './ShapePicker'

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

  it('defaults to the geometric shapes, with a single polygon in place of the fixed n-gons', () => {
    render(<ShapePicker {...defaultProps} />)
    for (const name of ['triangle', 'rectangle', 'polygon', 'circle', 'diamond']) {
      expect(screen.getByTitle(name)).toBeInTheDocument()
    }
    for (const name of ['pentagon', 'hexagon', 'heptagon', 'octagon', 'star', 'heart']) {
      expect(screen.queryByTitle(name)).not.toBeInTheDocument()
    }
  })

  it('renders the objects list when given it', () => {
    render(<ShapePicker {...defaultProps} shapes={OBJECT_SHAPES} />)
    for (const name of ['star', 'heart', 'arrow', 'cross']) {
      expect(screen.getByTitle(name)).toBeInTheDocument()
    }
    expect(screen.queryByTitle('rectangle')).not.toBeInTheDocument()
  })

  it('calls onSelectShape when a shape is clicked', async () => {
    const user = userEvent.setup()
    const onSelectShape = vi.fn()
    render(<ShapePicker {...defaultProps} onSelectShape={onSelectShape} />)
    
    await user.click(screen.getByTitle('circle'))
    expect(onSelectShape).toHaveBeenCalledWith('circle')
  })

  it('highlights the selected shape', () => {
    render(<ShapePicker {...defaultProps} shapes={OBJECT_SHAPES} selectedShape="heart" />)
    const heartButton = screen.getByTitle('heart').closest('button')
    expect(heartButton).toHaveClass('selected')
  })
})

describe('ShapePicker — polygon sides', () => {
  const polygonProps = (over: Partial<React.ComponentProps<typeof ShapePicker>> = {}) => ({
    isOpen: true,
    selectedShape: 'polygon' as const,
    onSelectShape: vi.fn(),
    sides: 6,
    onSidesChange: vi.fn(),
    ...over,
  })

  it('shows the sides chooser only when polygon is selected', () => {
    const { rerender } = render(<ShapePicker {...polygonProps({ selectedShape: 'rectangle' })} />)
    expect(screen.queryByLabelText('Number of sides')).not.toBeInTheDocument()
    rerender(<ShapePicker {...polygonProps()} />)
    expect(screen.getByLabelText('Number of sides')).toHaveValue(6)
    expect(screen.getByTestId('polygon-preview').querySelector('polygon')!.getAttribute('points')!.split(' ')).toHaveLength(6)
  })

  it('− and + step the side count', async () => {
    const user = userEvent.setup()
    const onSidesChange = vi.fn()
    render(<ShapePicker {...polygonProps({ onSidesChange })} />)
    await user.click(screen.getByLabelText('More sides'))
    expect(onSidesChange).toHaveBeenLastCalledWith(7)
    await user.click(screen.getByLabelText('Fewer sides'))
    expect(onSidesChange).toHaveBeenLastCalledWith(5)
  })

  it('disables − at 3 and + at 1000', () => {
    const { rerender } = render(<ShapePicker {...polygonProps({ sides: 3 })} />)
    expect(screen.getByLabelText('Fewer sides')).toBeDisabled()
    expect(screen.getByLabelText('More sides')).toBeEnabled()
    rerender(<ShapePicker {...polygonProps({ sides: 1000 })} />)
    expect(screen.getByLabelText('More sides')).toBeDisabled()
  })

  it('typing a number commits on Enter, clamped to 3..1000', async () => {
    const user = userEvent.setup()
    const onSidesChange = vi.fn()
    render(<ShapePicker {...polygonProps({ onSidesChange })} />)
    const input = screen.getByLabelText('Number of sides')

    await user.clear(input)
    await user.type(input, '250{Enter}')
    expect(onSidesChange).toHaveBeenLastCalledWith(250)

    await user.clear(input)
    await user.type(input, '5000{Enter}')
    expect(onSidesChange).toHaveBeenLastCalledWith(1000)

    await user.clear(input)
    await user.type(input, '1{Enter}')
    expect(onSidesChange).toHaveBeenLastCalledWith(3)
  })

  it('does not commit while typing, only on blur', async () => {
    const user = userEvent.setup()
    const onSidesChange = vi.fn()
    render(<ShapePicker {...polygonProps({ onSidesChange })} />)
    const input = screen.getByLabelText('Number of sides')
    await user.clear(input)
    await user.type(input, '12')
    expect(onSidesChange).not.toHaveBeenCalled()
    await user.tab()
    expect(onSidesChange).toHaveBeenCalledWith(12)
  })
})
