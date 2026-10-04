import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PolygonPicker from './PolygonPicker'

describe('PolygonPicker', () => {
  const polygonProps = (over: Partial<React.ComponentProps<typeof PolygonPicker>> = {}) => ({
    isOpen: true,
    sides: 6,
    onSidesChange: vi.fn(),
    ...over,
  })

  it('renders nothing when closed', () => {
    render(<PolygonPicker {...polygonProps({ isOpen: false })} />)
    expect(screen.queryByLabelText('Number of sides')).not.toBeInTheDocument()
  })

  it('shows the side count and a matching preview', () => {
    render(<PolygonPicker {...polygonProps()} />)
    expect(screen.getByLabelText('Number of sides')).toHaveValue(6)
    expect(screen.getByTestId('polygon-preview').querySelector('polygon')!.getAttribute('points')!.split(' ')).toHaveLength(6)
  })

  it('− and + step the side count', async () => {
    const user = userEvent.setup()
    const onSidesChange = vi.fn()
    render(<PolygonPicker {...polygonProps({ onSidesChange })} />)
    await user.click(screen.getByLabelText('More sides'))
    expect(onSidesChange).toHaveBeenLastCalledWith(7)
    await user.click(screen.getByLabelText('Fewer sides'))
    expect(onSidesChange).toHaveBeenLastCalledWith(5)
  })

  it('disables − at 3 and + at 1000', () => {
    const { rerender } = render(<PolygonPicker {...polygonProps({ sides: 3 })} />)
    expect(screen.getByLabelText('Fewer sides')).toBeDisabled()
    expect(screen.getByLabelText('More sides')).toBeEnabled()
    rerender(<PolygonPicker {...polygonProps({ sides: 1000 })} />)
    expect(screen.getByLabelText('More sides')).toBeDisabled()
  })

  it('typing a number commits on Enter, clamped to 3..1000', async () => {
    const user = userEvent.setup()
    const onSidesChange = vi.fn()
    render(<PolygonPicker {...polygonProps({ onSidesChange })} />)
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
    render(<PolygonPicker {...polygonProps({ onSidesChange })} />)
    const input = screen.getByLabelText('Number of sides')
    await user.clear(input)
    await user.type(input, '12')
    expect(onSidesChange).not.toHaveBeenCalled()
    await user.tab()
    expect(onSidesChange).toHaveBeenCalledWith(12)
  })
})
