import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Canvas from './Canvas'
import { ShapeLayer, TextLayer } from '../types/layers'

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

  describe('Delete functionality', () => {
    it('shows delete button when shape layer is selected', async () => {
      const onShapeLayersChange = vi.fn()
      const shapeLayers: ShapeLayer[] = [
        {
          id: 'shape-1',
          shape: 'rectangle',
          x: 100,
          y: 100,
          width: 50,
          height: 50,
          rotation: 0,
          strokeColor: '#000000',
          strokeWidth: 2,
          fillColor: null,
        },
      ]

      render(
        <Canvas
          tool="select"
          color="#000000"
          panelData={null}
          layout={{ rows: 1, columns: [1] }}
          onCanvasChange={vi.fn()}
          shapeLayers={shapeLayers}
          onShapeLayersChange={onShapeLayersChange}
        />
      )

      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()

      // Click on the shape to select it
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const clickX = rect.left + (100 + 25) * (rect.width / 1200) // Center of shape
        const clickY = rect.top + (100 + 25) * (rect.height / 800)

        await userEvent.click(canvas, {
          clientX: clickX,
          clientY: clickY,
        })
      }

      // Wait for delete button to appear
      await waitFor(() => {
        const deleteButton = screen.queryByText('🗑️ Delete')
        expect(deleteButton).toBeInTheDocument()
      })
    })

    it('shows delete button when text layer is selected', async () => {
      const onTextLayersChange = vi.fn()
      const textLayers: TextLayer[] = [
        {
          id: 'text-1',
          text: 'Test',
          x: 100,
          y: 100,
          width: 50,
          height: 30,
          rotation: 0,
          font: 'Arial',
          fontSize: 24,
          color: '#000000',
        },
      ]

      render(
        <Canvas
          tool="select"
          color="#000000"
          panelData={null}
          layout={{ rows: 1, columns: [1] }}
          onCanvasChange={vi.fn()}
          textLayers={textLayers}
          onTextLayersChange={onTextLayersChange}
        />
      )

      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()

      // Click on the text to select it
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const clickX = rect.left + (100 + 25) * (rect.width / 1200) // Center of text
        const clickY = rect.top + (100 + 15) * (rect.height / 800)

        await userEvent.click(canvas, {
          clientX: clickX,
          clientY: clickY,
        })
      }

      // Wait for delete button to appear
      await waitFor(() => {
        const deleteButton = screen.queryByText('🗑️ Delete')
        expect(deleteButton).toBeInTheDocument()
      })
    })

    it('deletes shape layer when delete button is clicked', async () => {
      const onShapeLayersChange = vi.fn()
      const shapeLayers: ShapeLayer[] = [
        {
          id: 'shape-1',
          shape: 'rectangle',
          x: 100,
          y: 100,
          width: 50,
          height: 50,
          rotation: 0,
          strokeColor: '#000000',
          strokeWidth: 2,
          fillColor: null,
        },
      ]

      render(
        <Canvas
          tool="select"
          color="#000000"
          panelData={null}
          layout={{ rows: 1, columns: [1] }}
          onCanvasChange={vi.fn()}
          shapeLayers={shapeLayers}
          onShapeLayersChange={onShapeLayersChange}
        />
      )

      const canvas = document.querySelector('canvas')
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const clickX = rect.left + (100 + 25) * (rect.width / 1200)
        const clickY = rect.top + (100 + 25) * (rect.height / 800)

        await userEvent.click(canvas, {
          clientX: clickX,
          clientY: clickY,
        })
      }

      // Wait for delete button and click it
      await waitFor(async () => {
        const deleteButton = screen.queryByText('🗑️ Delete')
        expect(deleteButton).toBeInTheDocument()
        if (deleteButton) {
          await userEvent.click(deleteButton)
        }
      })

      // Verify onShapeLayersChange was called with empty array (after deletion)
      await waitFor(() => {
        expect(onShapeLayersChange).toHaveBeenCalled()
        const calls = onShapeLayersChange.mock.calls
        // Should have been called at least once with an empty array or filtered array
        const lastCall = calls[calls.length - 1]
        expect(lastCall[0]).toEqual([])
      })
    })

    it('deletes text layer when delete button is clicked', async () => {
      const onTextLayersChange = vi.fn()
      const textLayers: TextLayer[] = [
        {
          id: 'text-1',
          text: 'Test',
          x: 100,
          y: 100,
          width: 50,
          height: 30,
          rotation: 0,
          font: 'Arial',
          fontSize: 24,
          color: '#000000',
        },
      ]

      render(
        <Canvas
          tool="select"
          color="#000000"
          panelData={null}
          layout={{ rows: 1, columns: [1] }}
          onCanvasChange={vi.fn()}
          textLayers={textLayers}
          onTextLayersChange={onTextLayersChange}
        />
      )

      const canvas = document.querySelector('canvas')
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const clickX = rect.left + (100 + 25) * (rect.width / 1200)
        const clickY = rect.top + (100 + 15) * (rect.height / 800)

        await userEvent.click(canvas, {
          clientX: clickX,
          clientY: clickY,
        })
      }

      // Wait for delete button and click it
      await waitFor(async () => {
        const deleteButton = screen.queryByText('🗑️ Delete')
        expect(deleteButton).toBeInTheDocument()
        if (deleteButton) {
          await userEvent.click(deleteButton)
        }
      })

      // Verify onTextLayersChange was called
      await waitFor(() => {
        expect(onTextLayersChange).toHaveBeenCalled()
        const calls = onTextLayersChange.mock.calls
        const lastCall = calls[calls.length - 1]
        expect(lastCall[0]).toEqual([])
      })
    })

    it('deletes shape layer when Delete key is pressed', async () => {
      const onShapeLayersChange = vi.fn()
      const shapeLayers: ShapeLayer[] = [
        {
          id: 'shape-1',
          shape: 'rectangle',
          x: 100,
          y: 100,
          width: 50,
          height: 50,
          rotation: 0,
          strokeColor: '#000000',
          strokeWidth: 2,
          fillColor: null,
        },
      ]

      render(
        <Canvas
          tool="select"
          color="#000000"
          panelData={null}
          layout={{ rows: 1, columns: [1] }}
          onCanvasChange={vi.fn()}
          shapeLayers={shapeLayers}
          onShapeLayersChange={onShapeLayersChange}
        />
      )

      const canvas = document.querySelector('canvas')
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const clickX = rect.left + (100 + 25) * (rect.width / 1200)
        const clickY = rect.top + (100 + 25) * (rect.height / 800)

        await userEvent.click(canvas, {
          clientX: clickX,
          clientY: clickY,
        })
      }

      // Press Delete key
      await userEvent.keyboard('{Delete}')

      // Verify deletion was called
      await waitFor(() => {
        expect(onShapeLayersChange).toHaveBeenCalled()
      })
    })

    it('deletes text layer when Backspace key is pressed', async () => {
      const onTextLayersChange = vi.fn()
      const textLayers: TextLayer[] = [
        {
          id: 'text-1',
          text: 'Test',
          x: 100,
          y: 100,
          width: 50,
          height: 30,
          rotation: 0,
          font: 'Arial',
          fontSize: 24,
          color: '#000000',
        },
      ]

      render(
        <Canvas
          tool="select"
          color="#000000"
          panelData={null}
          layout={{ rows: 1, columns: [1] }}
          onCanvasChange={vi.fn()}
          textLayers={textLayers}
          onTextLayersChange={onTextLayersChange}
        />
      )

      const canvas = document.querySelector('canvas')
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const clickX = rect.left + (100 + 25) * (rect.width / 1200)
        const clickY = rect.top + (100 + 15) * (rect.height / 800)

        await userEvent.click(canvas, {
          clientX: clickX,
          clientY: clickY,
        })
      }

      // Press Backspace key
      await userEvent.keyboard('{Backspace}')

      // Verify deletion was called
      await waitFor(() => {
        expect(onTextLayersChange).toHaveBeenCalled()
      })
    })

    it('does not show delete button when tool is not select', () => {
      const shapeLayers: ShapeLayer[] = [
        {
          id: 'shape-1',
          shape: 'rectangle',
          x: 100,
          y: 100,
          width: 50,
          height: 50,
          rotation: 0,
          strokeColor: '#000000',
          strokeWidth: 2,
          fillColor: null,
        },
      ]

      render(
        <Canvas
          tool="pen"
          color="#000000"
          panelData={null}
          layout={{ rows: 1, columns: [1] }}
          onCanvasChange={vi.fn()}
          shapeLayers={shapeLayers}
          onShapeLayersChange={vi.fn()}
        />
      )

      const deleteButton = screen.queryByText('🗑️ Delete')
      expect(deleteButton).not.toBeInTheDocument()
    })
  })

  describe('Duplicate functionality', () => {
    it('shows duplicate button when shape layer is selected', async () => {
      const onShapeLayersChange = vi.fn()
      const shapeLayers: ShapeLayer[] = [
        {
          id: 'shape-1',
          shape: 'rectangle',
          x: 100,
          y: 100,
          width: 50,
          height: 50,
          rotation: 0,
          strokeColor: '#000000',
          strokeWidth: 2,
          fillColor: null,
        },
      ]

      render(
        <Canvas
          tool="select"
          color="#000000"
          panelData={null}
          layout={{ rows: 1, columns: [1] }}
          onCanvasChange={vi.fn()}
          shapeLayers={shapeLayers}
          onShapeLayersChange={onShapeLayersChange}
        />
      )

      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()

      // Click on the shape to select it
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const clickX = rect.left + (100 + 25) * (rect.width / 1200) // Center of shape
        const clickY = rect.top + (100 + 25) * (rect.height / 800)

        await userEvent.click(canvas, {
          clientX: clickX,
          clientY: clickY,
        })
      }

      // Wait for duplicate button to appear
      await waitFor(() => {
        const duplicateButton = screen.queryByText('📋 Duplicate')
        expect(duplicateButton).toBeInTheDocument()
      })
    })

    it('shows duplicate button when text layer is selected', async () => {
      const onTextLayersChange = vi.fn()
      const textLayers: TextLayer[] = [
        {
          id: 'text-1',
          text: 'Test',
          x: 100,
          y: 100,
          width: 50,
          height: 30,
          rotation: 0,
          font: 'Arial',
          fontSize: 24,
          color: '#000000',
        },
      ]

      render(
        <Canvas
          tool="select"
          color="#000000"
          panelData={null}
          layout={{ rows: 1, columns: [1] }}
          onCanvasChange={vi.fn()}
          textLayers={textLayers}
          onTextLayersChange={onTextLayersChange}
        />
      )

      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()

      // Click on the text to select it
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const clickX = rect.left + (100 + 25) * (rect.width / 1200) // Center of text
        const clickY = rect.top + (100 + 15) * (rect.height / 800)

        await userEvent.click(canvas, {
          clientX: clickX,
          clientY: clickY,
        })
      }

      // Wait for duplicate button to appear
      await waitFor(() => {
        const duplicateButton = screen.queryByText('📋 Duplicate')
        expect(duplicateButton).toBeInTheDocument()
      })
    })

    it('duplicates shape layer when duplicate button is clicked', async () => {
      const onShapeLayersChange = vi.fn()
      const shapeLayers: ShapeLayer[] = [
        {
          id: 'shape-1',
          shape: 'rectangle',
          x: 100,
          y: 100,
          width: 50,
          height: 50,
          rotation: 0,
          strokeColor: '#000000',
          strokeWidth: 2,
          fillColor: '#ff0000',
        },
      ]

      render(
        <Canvas
          tool="select"
          color="#000000"
          panelData={null}
          layout={{ rows: 1, columns: [1] }}
          onCanvasChange={vi.fn()}
          shapeLayers={shapeLayers}
          onShapeLayersChange={onShapeLayersChange}
        />
      )

      const canvas = document.querySelector('canvas')
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const clickX = rect.left + (100 + 25) * (rect.width / 1200)
        const clickY = rect.top + (100 + 25) * (rect.height / 800)

        await userEvent.click(canvas, {
          clientX: clickX,
          clientY: clickY,
        })
      }

      // Wait for duplicate button and click it
      await waitFor(async () => {
        const duplicateButton = screen.queryByText('📋 Duplicate')
        expect(duplicateButton).toBeInTheDocument()
        if (duplicateButton) {
          await userEvent.click(duplicateButton)
        }
      })

      // Verify onShapeLayersChange was called with duplicated layer
      await waitFor(() => {
        expect(onShapeLayersChange).toHaveBeenCalled()
        const calls = onShapeLayersChange.mock.calls
        // Find the call that adds a duplicate (should have 2 layers)
        const duplicateCall = calls.find((call) => call[0].length === 2)
        expect(duplicateCall).toBeDefined()
        if (duplicateCall) {
          const duplicatedLayers = duplicateCall[0] as ShapeLayer[]
          expect(duplicatedLayers.length).toBe(2)
          // Original layer should still be there
          expect(duplicatedLayers[0].id).toBe('shape-1')
          // Duplicate should have different ID
          expect(duplicatedLayers[1].id).not.toBe('shape-1')
          // Duplicate should have same properties except position
          expect(duplicatedLayers[1].shape).toBe('rectangle')
          expect(duplicatedLayers[1].strokeColor).toBe('#000000')
          expect(duplicatedLayers[1].strokeWidth).toBe(2)
          expect(duplicatedLayers[1].fillColor).toBe('#ff0000')
          expect(duplicatedLayers[1].rotation).toBe(0)
          // Duplicate should be offset by 30 pixels
          expect(duplicatedLayers[1].x).toBe(130) // 100 + 30
          expect(duplicatedLayers[1].y).toBe(130) // 100 + 30
        }
      })
    })

    it('duplicates text layer when duplicate button is clicked', async () => {
      const onTextLayersChange = vi.fn()
      const textLayers: TextLayer[] = [
        {
          id: 'text-1',
          text: 'Test',
          x: 100,
          y: 100,
          width: 50,
          height: 30,
          rotation: 0,
          font: 'Arial',
          fontSize: 24,
          color: '#000000',
        },
      ]

      render(
        <Canvas
          tool="select"
          color="#000000"
          panelData={null}
          layout={{ rows: 1, columns: [1] }}
          onCanvasChange={vi.fn()}
          textLayers={textLayers}
          onTextLayersChange={onTextLayersChange}
        />
      )

      const canvas = document.querySelector('canvas')
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const clickX = rect.left + (100 + 25) * (rect.width / 1200)
        const clickY = rect.top + (100 + 15) * (rect.height / 800)

        await userEvent.click(canvas, {
          clientX: clickX,
          clientY: clickY,
        })
      }

      // Wait for duplicate button and click it
      await waitFor(async () => {
        const duplicateButton = screen.queryByText('📋 Duplicate')
        expect(duplicateButton).toBeInTheDocument()
        if (duplicateButton) {
          await userEvent.click(duplicateButton)
        }
      })

      // Verify onTextLayersChange was called with duplicated layer
      await waitFor(() => {
        expect(onTextLayersChange).toHaveBeenCalled()
        const calls = onTextLayersChange.mock.calls
        // Find the call that adds a duplicate (should have 2 layers)
        const duplicateCall = calls.find((call) => call[0].length === 2)
        expect(duplicateCall).toBeDefined()
        if (duplicateCall) {
          const duplicatedLayers = duplicateCall[0] as TextLayer[]
          expect(duplicatedLayers.length).toBe(2)
          // Original layer should still be there
          expect(duplicatedLayers[0].id).toBe('text-1')
          // Duplicate should have different ID
          expect(duplicatedLayers[1].id).not.toBe('text-1')
          // Duplicate should have same properties except position
          expect(duplicatedLayers[1].text).toBe('Test')
          expect(duplicatedLayers[1].font).toBe('Arial')
          expect(duplicatedLayers[1].fontSize).toBe(24)
          expect(duplicatedLayers[1].color).toBe('#000000')
          expect(duplicatedLayers[1].rotation).toBe(0)
          // Duplicate should be offset by 30 pixels
          expect(duplicatedLayers[1].x).toBe(130) // 100 + 30
          expect(duplicatedLayers[1].y).toBe(130) // 100 + 30
        }
      })
    })

    it('clamps duplicate position to canvas bounds', async () => {
      const onShapeLayersChange = vi.fn()
      // Place shape near the right edge of canvas (width 1200)
      const shapeLayers: ShapeLayer[] = [
        {
          id: 'shape-1',
          shape: 'rectangle',
          x: 1150, // Near right edge
          y: 100,
          width: 50,
          height: 50,
          rotation: 0,
          strokeColor: '#000000',
          strokeWidth: 2,
          fillColor: null,
        },
      ]

      render(
        <Canvas
          tool="select"
          color="#000000"
          panelData={null}
          layout={{ rows: 1, columns: [1] }}
          onCanvasChange={vi.fn()}
          shapeLayers={shapeLayers}
          onShapeLayersChange={onShapeLayersChange}
        />
      )

      const canvas = document.querySelector('canvas')
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const clickX = rect.left + (1150 + 25) * (rect.width / 1200)
        const clickY = rect.top + (100 + 25) * (rect.height / 800)

        await userEvent.click(canvas, {
          clientX: clickX,
          clientY: clickY,
        })
      }

      // Wait for duplicate button and click it
      await waitFor(async () => {
        const duplicateButton = screen.queryByText('📋 Duplicate')
        expect(duplicateButton).toBeInTheDocument()
        if (duplicateButton) {
          await userEvent.click(duplicateButton)
        }
      })

      // Verify duplicate position is clamped to canvas bounds
      await waitFor(() => {
        expect(onShapeLayersChange).toHaveBeenCalled()
        const calls = onShapeLayersChange.mock.calls
        const duplicateCall = calls.find((call) => call[0].length === 2)
        if (duplicateCall) {
          const duplicatedLayers = duplicateCall[0] as ShapeLayer[]
          const duplicate = duplicatedLayers[1]
          // Should be clamped: 1150 + 30 = 1180, but width is 50, so max x is 1200 - 50 = 1150
          expect(duplicate.x).toBeLessThanOrEqual(1200 - duplicate.width)
          expect(duplicate.y).toBeLessThanOrEqual(800 - duplicate.height)
        }
      })
    })

    it('does not show duplicate button when tool is not select', () => {
      const shapeLayers: ShapeLayer[] = [
        {
          id: 'shape-1',
          shape: 'rectangle',
          x: 100,
          y: 100,
          width: 50,
          height: 50,
          rotation: 0,
          strokeColor: '#000000',
          strokeWidth: 2,
          fillColor: null,
        },
      ]

      render(
        <Canvas
          tool="pen"
          color="#000000"
          panelData={null}
          layout={{ rows: 1, columns: [1] }}
          onCanvasChange={vi.fn()}
          shapeLayers={shapeLayers}
          onShapeLayersChange={vi.fn()}
        />
      )

      const duplicateButton = screen.queryByText('📋 Duplicate')
      expect(duplicateButton).not.toBeInTheDocument()
    })
  })
})
