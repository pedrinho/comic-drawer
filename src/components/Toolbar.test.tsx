import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Toolbar from './Toolbar'

describe('Toolbar', () => {
  const defaultProps = {
    currentTool: 'pen' as const,
    onToolChange: vi.fn(),
    color: '#000000',
    onColorChange: vi.fn(),
    selectedShape: 'rectangle' as const,
    onSelectShape: vi.fn(),
  }

  it('renders all tools', () => {
    render(<Toolbar {...defaultProps} />)

    expect(screen.getByText('Pen')).toBeInTheDocument()
    expect(screen.getByText('Eraser')).toBeInTheDocument()
    expect(screen.getByText('Shapes')).toBeInTheDocument()
    expect(screen.getByText('Text')).toBeInTheDocument()
    expect(screen.getByText('Balloon')).toBeInTheDocument()
  })

  it('highlights the current tool', () => {
    render(<Toolbar {...defaultProps} />)

    const penButton = screen.getByText('Pen').closest('button')
    expect(penButton).toHaveClass('active')
  })

  it('calls onToolChange when a tool is clicked', async () => {
    const user = userEvent.setup()
    const onToolChange = vi.fn()
    render(<Toolbar {...defaultProps} onToolChange={onToolChange} />)

    await user.click(screen.getByText('Eraser'))
    expect(onToolChange).toHaveBeenCalledWith('eraser')
  })

  it('shows correct tool icons', () => {
    render(<Toolbar {...defaultProps} />)

    expect(screen.getByText('✏️')).toBeInTheDocument()
    expect(screen.getByText('🧹')).toBeInTheDocument()
    expect(screen.getByText('🔷')).toBeInTheDocument()
    expect(screen.getByText('🪣')).toBeInTheDocument()
    expect(screen.getByText('💬')).toBeInTheDocument()
    expect(screen.getByText('💭')).toBeInTheDocument()
  })

  it('renders fill tool', () => {
    render(<Toolbar {...defaultProps} />)

    expect(screen.getByText('Fill')).toBeInTheDocument()
  })

  it('renders color picker', () => {
    render(<Toolbar {...defaultProps} />)

    expect(screen.getByLabelText('Color:')).toBeInTheDocument()
  })

  it('has color picker with correct value', () => {
    const onColorChange = vi.fn()
    render(<Toolbar {...defaultProps} onColorChange={onColorChange} />)

    const colorPicker = screen.getByLabelText('Color:') as HTMLInputElement
    expect(colorPicker.value).toBe('#000000')
  })
})
