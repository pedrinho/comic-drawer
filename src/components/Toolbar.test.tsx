import { render, screen, fireEvent } from '@testing-library/react'
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
    selectedPenType: 'medium' as const,
    onSelectPenType: vi.fn(),
    font: 'Arial',
    onFontChange: vi.fn(),
    fontSize: 24,
    onFontSizeChange: vi.fn(),
  }

  it('renders all tools', () => {
    render(<Toolbar {...defaultProps} />)

    expect(screen.getByText('Select')).toBeInTheDocument()
    expect(screen.getByText('Pen')).toBeInTheDocument()
    expect(screen.getByText('Eraser')).toBeInTheDocument()
    expect(screen.getByText('Object Shapes')).toBeInTheDocument()
    expect(screen.getByText('Text')).toBeInTheDocument()
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

    const toolIcons = screen.getAllByText('✏️')
    expect(toolIcons.length).toBeGreaterThan(0)
    expect(screen.getByText('🖱️')).toBeInTheDocument()
    expect(screen.getByText('🧹')).toBeInTheDocument()
    expect(screen.getByText('⬚')).toBeInTheDocument()
    expect(screen.getByText('🪣')).toBeInTheDocument()
    expect(screen.getByText('💬')).toBeInTheDocument()
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

  it('calls onColorChange when color is changed', async () => {
    const user = userEvent.setup()
    const onColorChange = vi.fn()
    render(<Toolbar {...defaultProps} onColorChange={onColorChange} />)

    const colorPicker = screen.getByLabelText('Color:') as HTMLInputElement
    // For color input, fire change event directly
    fireEvent.change(colorPicker, { target: { value: '#ff0000' } })

    expect(onColorChange).toHaveBeenCalledWith('#ff0000')
  })

  it('shows pen picker when pen tool is active and clicked', async () => {
    const user = userEvent.setup()
    render(<Toolbar {...defaultProps} currentTool="pen" />)

    // Click pen button to show submenu
    await user.click(screen.getByText('Pen').closest('button')!)

    expect(screen.getByText('Fine')).toBeInTheDocument()
    expect(screen.getByText('Small')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })

  it('shows shape picker when object shapes tool is active and clicked', async () => {
    const user = userEvent.setup()
    render(<Toolbar {...defaultProps} currentTool="objectShapes" />)

    // Click shapes button to show submenu
    await user.click(screen.getByText('Object Shapes').closest('button')!)

    expect(screen.getByTitle('rectangle')).toBeInTheDocument()
    expect(screen.getByTitle('circle')).toBeInTheDocument()
  })

  it('calls onSelectPenType when pen type is clicked', async () => {
    const user = userEvent.setup()
    const onSelectPenType = vi.fn()
    render(<Toolbar {...defaultProps} currentTool="pen" onSelectPenType={onSelectPenType} />)

    // First click to show submenu
    await user.click(screen.getByText('Pen').closest('button')!)

    // Then click pen type
    await user.click(screen.getByText('Fine'))
    expect(onSelectPenType).toHaveBeenCalledWith('fine')
  })

  it('calls onSelectShape when shape is clicked', async () => {
    const user = userEvent.setup()
    const onSelectShape = vi.fn()
    render(<Toolbar {...defaultProps} currentTool="objectShapes" onSelectShape={onSelectShape} />)

    // First click to show submenu
    await user.click(screen.getByText('Object Shapes').closest('button')!)

    // Then click shape (using title attribute)
    await user.click(screen.getByTitle('circle'))
    expect(onSelectShape).toHaveBeenCalledWith('circle')
  })

  it('shows font controls when text tool is active', async () => {
    const user = userEvent.setup()
    render(<Toolbar {...defaultProps} currentTool="text" />)

    // Click text button to show submenu
    await user.click(screen.getByText('Text').closest('button')!)

    expect(screen.getByTitle('Select font')).toBeInTheDocument()
    expect(screen.getByTitle('Decrease size')).toBeInTheDocument()
    expect(screen.getByTitle('Increase size')).toBeInTheDocument()
  })

  it('calls onFontChange when font is changed', async () => {
    const user = userEvent.setup()
    const onFontChange = vi.fn()
    render(<Toolbar {...defaultProps} currentTool="text" onFontChange={onFontChange} />)

    // Click text button to show submenu
    await user.click(screen.getByText('Text').closest('button')!)

    const fontSelect = screen.getByTitle('Select font') as HTMLSelectElement
    await user.selectOptions(fontSelect, 'Times New Roman')

    expect(onFontChange).toHaveBeenCalledWith('Times New Roman')
  })

  it('calls onFontSizeChange when font size is changed', async () => {
    const user = userEvent.setup()
    const onFontSizeChange = vi.fn()
    // Start with 24px
    render(<Toolbar {...defaultProps} currentTool="text" fontSize={24} onFontSizeChange={onFontSizeChange} />)

    // Click text button to show submenu
    await user.click(screen.getByText('Text').closest('button')!)

    const increaseBtn = screen.getByTitle('Increase size')
    await user.click(increaseBtn)

    expect(onFontSizeChange).toHaveBeenCalledWith(26) // 24 + 2
  })

  it('hides pen picker when pen tool is not active', () => {
    render(<Toolbar {...defaultProps} currentTool="eraser" />)
    expect(screen.queryByText('Fine')).not.toBeInTheDocument()
  })

  it('hides shape picker when shapes tool is not active', () => {
    render(<Toolbar {...defaultProps} currentTool="pen" />)
    expect(screen.queryByTitle('rectangle')).not.toBeInTheDocument()
  })

  it('hides font controls when text tool is not active', () => {
    render(<Toolbar {...defaultProps} currentTool="pen" />)
    expect(screen.queryByTitle('Select font')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Increase size')).not.toBeInTheDocument()
  })

  it('toggles pen submenu when pen button is clicked', async () => {
    const user = userEvent.setup()
    const onToolChange = vi.fn()
    render(<Toolbar {...defaultProps} currentTool="pen" onToolChange={onToolChange} />)

    // Click pen button to toggle submenu
    await user.click(screen.getByText('Pen').closest('button')!)

    // Should show pen picker
    expect(screen.getByText('Fine')).toBeInTheDocument()

    // Click again to hide
    await user.click(screen.getByText('Pen').closest('button')!)

    // Should hide pen picker
    expect(screen.queryByText('Fine')).not.toBeInTheDocument()
  })

  it('toggles shape submenu when shapes button is clicked', async () => {
    const user = userEvent.setup()
    const onToolChange = vi.fn()
    render(<Toolbar {...defaultProps} currentTool="objectShapes" onToolChange={onToolChange} />)

    // Click shapes button to toggle submenu
    await user.click(screen.getByText('Object Shapes').closest('button')!)

    // Should show shape picker (check by title attribute)
    expect(screen.getByTitle('rectangle')).toBeInTheDocument()

    // Click again to hide
    await user.click(screen.getByText('Object Shapes').closest('button')!)

    // Should hide shape picker
    expect(screen.queryByTitle('rectangle')).not.toBeInTheDocument()
  })
})
