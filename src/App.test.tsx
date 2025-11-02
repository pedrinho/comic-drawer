import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the app title', () => {
    render(<App />)
    expect(screen.getByText('🎨 Comic Drawer')).toBeInTheDocument()
  })

  it('renders toolbar', () => {
    render(<App />)
    expect(screen.getByText('Pen')).toBeInTheDocument()
  })

  it('renders panel layout', () => {
    render(<App />)
    expect(screen.getByText('Panel 1')).toBeInTheDocument()
  })

  it('adds a new panel when add panel is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByText('+ Add Panel'))

    await waitFor(() => {
      expect(screen.getByText('Configure Panel Layout')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Create Panel'))

    await waitFor(() => {
      expect(screen.getByText('Panel 2')).toBeInTheDocument()
    })
  })

  it('shows modal when adding a panel', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByText('+ Add Panel'))

    await waitFor(() => {
      expect(screen.getByText('Configure Panel Layout')).toBeInTheDocument()
    })
  })

  it('switches between panels', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Add a second panel
    await user.click(screen.getByText('+ Add Panel'))
    await waitFor(() => {
      expect(screen.getByText('Configure Panel Layout')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Create Panel'))

    // Switch panels
    await waitFor(() => {
      const panel2 = screen.getByText('Panel 2')
      expect(panel2).toBeInTheDocument()
    })

    const panel2 = screen.getByText('Panel 2')
    await user.click(panel2)

    const panel2Div = panel2.closest('div')
    expect(panel2Div).toHaveClass('selected')
  })

  it('changes tool when toolbar button is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByText('Eraser'))

    const eraserButton = screen.getByText('Eraser').closest('button')
    expect(eraserButton).toHaveClass('active')
  })
})
