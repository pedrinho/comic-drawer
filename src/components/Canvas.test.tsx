import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Canvas from './Canvas'

describe('Canvas', () => {
  it('renders canvas element', () => {
    const onCanvasChange = vi.fn()
    render(
      <Canvas
        tool="pen"
        color="#000000"
        panelData={null}
        layout={{ rows: 1, columns: [1] }}
        onCanvasChange={onCanvasChange}
      />
    )

    expect(document.querySelector('canvas')).toBeInTheDocument()
  })

  it('renders canvas with default grid layout', () => {
    const onCanvasChange = vi.fn()
    render(
      <Canvas
        tool="pen"
        color="#000000"
        panelData={null}
        layout={{ rows: 1, columns: [1] }}
        onCanvasChange={onCanvasChange}
      />
    )

    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('renders canvas with custom grid layout', () => {
    const onCanvasChange = vi.fn()
    render(
      <Canvas
        tool="pen"
        color="#000000"
        panelData={null}
        layout={{ rows: 2, columns: [2, 3] }}
        onCanvasChange={onCanvasChange}
      />
    )

    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('updates when layout changes', () => {
    const onCanvasChange = vi.fn()
    const { rerender } = render(
      <Canvas
        tool="pen"
        color="#000000"
        panelData={null}
        layout={{ rows: 1, columns: [1] }}
        onCanvasChange={onCanvasChange}
      />
    )

    rerender(
      <Canvas
        tool="pen"
        color="#000000"
        panelData={null}
        layout={{ rows: 2, columns: [2, 2] }}
        onCanvasChange={onCanvasChange}
      />
    )

    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('renders canvas with fill tool', () => {
    const onCanvasChange = vi.fn()
    render(
      <Canvas
        tool="fill"
        color="#ff0000"
        panelData={null}
        layout={{ rows: 1, columns: [1] }}
        onCanvasChange={onCanvasChange}
      />
    )

    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('renders canvas with text tool', () => {
    const onCanvasChange = vi.fn()
    render(
      <Canvas
        tool="text"
        color="#000000"
        panelData={null}
        layout={{ rows: 1, columns: [1] }}
        onCanvasChange={onCanvasChange}
      />
    )

    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('renders canvas with balloon tool', () => {
    const onCanvasChange = vi.fn()
    render(
      <Canvas
        tool="balloon"
        color="#000000"
        panelData={null}
        layout={{ rows: 1, columns: [1] }}
        onCanvasChange={onCanvasChange}
      />
    )

    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })
})
