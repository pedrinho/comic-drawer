import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Presentation from './Presentation'
import { PanelData } from '../App'

describe('Presentation', () => {
  const mockPanels: PanelData[] = [
    { 
      id: 0, 
      name: 'Panel 1', 
      data: null, 
      layout: { rows: 1, columns: [1] }, 
      shapeLayers: [], 
      textLayers: [] 
    },
    { 
      id: 1, 
      name: 'Panel 2', 
      data: null, 
      layout: { rows: 2, columns: [1, 2] }, 
      shapeLayers: [], 
      textLayers: [] 
    },
    { 
      id: 2, 
      name: 'Panel 3', 
      data: null, 
      layout: { rows: 1, columns: [2] }, 
      shapeLayers: [], 
      textLayers: [] 
    },
  ]

  it('renders presentation overlay', () => {
    const onNext = vi.fn()
    const onPrevious = vi.fn()
    const onClose = vi.fn()
    
    render(
      <Presentation
        panels={mockPanels}
        currentIndex={0}
        onNext={onNext}
        onPrevious={onPrevious}
        onClose={onClose}
      />
    )

    expect(screen.getByText('Panel 1')).toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('displays current panel name and counter', () => {
    const onNext = vi.fn()
    const onPrevious = vi.fn()
    const onClose = vi.fn()
    
    render(
      <Presentation
        panels={mockPanels}
        currentIndex={1}
        onNext={onNext}
        onPrevious={onPrevious}
        onClose={onClose}
      />
    )

    expect(screen.getByText('Panel 2')).toBeInTheDocument()
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('calls onNext when next button is clicked', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    const onPrevious = vi.fn()
    const onClose = vi.fn()
    
    render(
      <Presentation
        panels={mockPanels}
        currentIndex={0}
        onNext={onNext}
        onPrevious={onPrevious}
        onClose={onClose}
      />
    )

    const nextButton = screen.getByText('Next →')
    await user.click(nextButton)
    expect(onNext).toHaveBeenCalled()
  })

  it('calls onPrevious when previous button is clicked', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    const onPrevious = vi.fn()
    const onClose = vi.fn()
    
    render(
      <Presentation
        panels={mockPanels}
        currentIndex={1}
        onNext={onNext}
        onPrevious={onPrevious}
        onClose={onClose}
      />
    )

    const previousButton = screen.getByText('← Previous')
    await user.click(previousButton)
    expect(onPrevious).toHaveBeenCalled()
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    const onPrevious = vi.fn()
    const onClose = vi.fn()
    
    render(
      <Presentation
        panels={mockPanels}
        currentIndex={0}
        onNext={onNext}
        onPrevious={onPrevious}
        onClose={onClose}
      />
    )

    const closeButton = screen.getByLabelText('Close presentation')
    await user.click(closeButton)
    expect(onClose).toHaveBeenCalled()
  })

  it('disables previous button on first panel', () => {
    const onNext = vi.fn()
    const onPrevious = vi.fn()
    const onClose = vi.fn()
    
    render(
      <Presentation
        panels={mockPanels}
        currentIndex={0}
        onNext={onNext}
        onPrevious={onPrevious}
        onClose={onClose}
      />
    )

    const previousButton = screen.getByText('← Previous')
    expect(previousButton).toBeDisabled()
  })

  it('disables next button on last panel', () => {
    const onNext = vi.fn()
    const onPrevious = vi.fn()
    const onClose = vi.fn()
    
    render(
      <Presentation
        panels={mockPanels}
        currentIndex={2}
        onNext={onNext}
        onPrevious={onPrevious}
        onClose={onClose}
      />
    )

    const nextButton = screen.getByText('Next →')
    expect(nextButton).toBeDisabled()
  })

  it('calls onClose when overlay is clicked', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    const onPrevious = vi.fn()
    const onClose = vi.fn()
    
    render(
      <Presentation
        panels={mockPanels}
        currentIndex={0}
        onNext={onNext}
        onPrevious={onPrevious}
        onClose={onClose}
      />
    )

    const overlay = screen.getByText('Panel 1').closest('.presentation-overlay')
    if (overlay) {
      await user.click(overlay)
      expect(onClose).toHaveBeenCalled()
    }
  })
})


