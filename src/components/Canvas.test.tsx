import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Canvas from './Canvas'
import { ShapeLayer, TextLayer } from '../types/layers'

describe('Canvas', () => {
  it('renders canvas element', () => {
    const onCanvasChange = vi.fn()
    render(
      <Canvas
        font="Arial"
        fontSize={20}
        tool="pen"
        color="#000000"
        panelData={null}
        layout={{ rows: 1, columns: [1] }}
        onCanvasChange={onCanvasChange}
      />
    )

    expect(screen.getByTestId('canvas')).toBeInTheDocument()
  })

  it('renders canvas with default grid layout', () => {
    const onCanvasChange = vi.fn()
    render(
      <Canvas
        font="Arial"
        fontSize={20}
        tool="pen"
        color="#000000"
        panelData={null}
        layout={{ rows: 1, columns: [1] }}
        onCanvasChange={onCanvasChange}
      />
    )

    const canvas = screen.getByTestId('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('renders canvas with custom grid layout', () => {
    const onCanvasChange = vi.fn()
    render(
      <Canvas
        font="Arial"
        fontSize={20}
        tool="pen"
        color="#000000"
        panelData={null}
        layout={{ rows: 2, columns: [2, 3] }}
        onCanvasChange={onCanvasChange}
      />
    )

    const canvas = screen.getByTestId('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('updates when layout changes', () => {
    const onCanvasChange = vi.fn()
    const { rerender } = render(
      <Canvas
        font="Arial"
        fontSize={20}
        tool="pen"
        color="#000000"
        panelData={null}
        layout={{ rows: 1, columns: [1] }}
        onCanvasChange={onCanvasChange}
      />
    )

    rerender(
      <Canvas
        font="Arial"
        fontSize={20}
        tool="pen"
        color="#000000"
        panelData={null}
        layout={{ rows: 2, columns: [2, 2] }}
        onCanvasChange={onCanvasChange}
      />
    )

    const canvas = screen.getByTestId('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('renders canvas with fill tool', () => {
    const onCanvasChange = vi.fn()
    render(
      <Canvas
        font="Arial"
        fontSize={20}
        tool="fill"
        color="#ff0000"
        panelData={null}
        layout={{ rows: 1, columns: [1] }}
        onCanvasChange={onCanvasChange}
      />
    )

    const canvas = screen.getByTestId('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('renders canvas with text tool', () => {
    const onCanvasChange = vi.fn()
    render(
      <Canvas
        font="Arial"
        fontSize={20}
        tool="text"
        color="#000000"
        panelData={null}
        layout={{ rows: 1, columns: [1] }}
        onCanvasChange={onCanvasChange}
      />
    )

    const canvas = screen.getByTestId('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('renders canvas with balloon tool', () => {
    const onCanvasChange = vi.fn()
    render(
      <Canvas
        font="Arial"
        fontSize={20}
        tool="balloon"
        color="#000000"
        panelData={null}
        layout={{ rows: 1, columns: [1] }}
        onCanvasChange={onCanvasChange}
      />
    )

    const canvas = screen.getByTestId('canvas')
    expect(canvas).toBeInTheDocument()
  })

  // NOTE: the "Delete" and "Duplicate" functionality blocks were removed — those DOM buttons
  // and the legacy keyboard-delete path no longer exist; deletion/duplication is now handled by
  // native Fabric controls (browser-verified).
})
