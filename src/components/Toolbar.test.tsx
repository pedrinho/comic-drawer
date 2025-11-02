import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Toolbar from './Toolbar'

describe('Toolbar', () => {
  it('renders all tools', () => {
    const onToolChange = vi.fn()
    render(<Toolbar currentTool="pen" onToolChange={onToolChange} />)

    expect(screen.getByText('Pen')).toBeInTheDocument()
    expect(screen.getByText('Eraser')).toBeInTheDocument()
    expect(screen.getByText('Rectangle')).toBeInTheDocument()
    expect(screen.getByText('Circle')).toBeInTheDocument()
    expect(screen.getByText('Text')).toBeInTheDocument()
  })

  it('highlights the current tool', () => {
    const onToolChange = vi.fn()
    render(<Toolbar currentTool="pen" onToolChange={onToolChange} />)

    const penButton = screen.getByText('Pen').closest('button')
    expect(penButton).toHaveClass('active')
  })

  it('calls onToolChange when a tool is clicked', async () => {
    const user = userEvent.setup()
    const onToolChange = vi.fn()
    render(<Toolbar currentTool="pen" onToolChange={onToolChange} />)

    await user.click(screen.getByText('Eraser'))
    expect(onToolChange).toHaveBeenCalledWith('eraser')
  })

  it('shows correct tool icons', () => {
    const onToolChange = vi.fn()
    render(<Toolbar currentTool="pen" onToolChange={onToolChange} />)

    expect(screen.getByText('✏️')).toBeInTheDocument()
    expect(screen.getByText('🧹')).toBeInTheDocument()
    expect(screen.getByText('⬜')).toBeInTheDocument()
    expect(screen.getByText('⭕')).toBeInTheDocument()
    expect(screen.getByText('💬')).toBeInTheDocument()
  })
})
