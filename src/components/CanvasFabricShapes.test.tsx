import { render, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Canvas from './Canvas'
import { ObjectLayer, TextLayer } from '../types/layers'

/**
 * Integration test for the Fabric.js shape mode (objectShapes tool).
 *
 * Fabric's pointer pipeline is hard to drive faithfully in jsdom, so instead of simulating
 * a freehand drag we exercise the deterministic enter/exit wiring: mounting with the tool
 * active loads existing shapes onto the Fabric canvas, and switching away syncs them back
 * into shapeLayers (the seam that keeps save/load working).
 */

const baseProps = {
  color: '#000000',
  font: 'Arial',
  fontSize: 20,
  panelData: null,
  layout: { rows: 1, columns: [1] },
  onCanvasChange: vi.fn(),
}

const rectLayer: ObjectLayer = {
  type: 'shape',
  id: 's1',
  shape: 'rectangle',
  x: 100,
  y: 100,
  width: 200,
  height: 120,
  rotation: 0,
  strokeColor: '#123456',
  strokeWidth: 2,
  fillColor: null,
}

describe('Canvas — Fabric shape mode', () => {
  it('mounts with the objectShapes tool and existing shapes without crashing', () => {
    const { container } = render(
      <Canvas
        {...baseProps}
        tool="objectShapes"
        shape="rectangle"
        shapeLayers={[rectLayer]}
        onShapeLayersChange={vi.fn()}
      />
    )
    // Two canvases now exist: the Fabric overlay and the legacy canvas.
    expect(container.querySelectorAll('canvas').length).toBeGreaterThanOrEqual(2)
  })

  it('syncs Fabric shapes back into shapeLayers when leaving the tool', async () => {
    const onShapeLayersChange = vi.fn()
    const { rerender } = render(
      <Canvas
        {...baseProps}
        tool="objectShapes"
        shape="rectangle"
        shapeLayers={[rectLayer]}
        onShapeLayersChange={onShapeLayersChange}
      />
    )

    // Switching away from objectShapes runs the effect cleanup, which hands the Fabric
    // shapes back to the layer model.
    rerender(
      <Canvas
        {...baseProps}
        tool="select"
        shape="rectangle"
        shapeLayers={[rectLayer]}
        onShapeLayersChange={onShapeLayersChange}
      />
    )

    await waitFor(() => expect(onShapeLayersChange).toHaveBeenCalled())

    const lastCall = onShapeLayersChange.mock.calls[onShapeLayersChange.mock.calls.length - 1]
    const layers = lastCall[0] as ObjectLayer[]
    const rect = layers.find((l) => l.type === 'shape' && l.id === 's1')
    expect(rect).toBeTruthy()
    expect(rect).toMatchObject({ shape: 'rectangle', width: 200, height: 120 })
  })

  it('loads text onto Fabric and syncs it back when leaving the text tool', async () => {
    const textLayer: TextLayer = {
      type: 'text',
      id: 't1',
      text: 'Bang!',
      x: 50,
      y: 40,
      width: 80,
      height: 24,
      rotation: 0,
      font: 'Arial',
      fontSize: 24,
      color: '#000000',
    }
    const onTextLayersChange = vi.fn()
    const { rerender } = render(
      <Canvas {...baseProps} tool="text" textLayers={[textLayer]} onTextLayersChange={onTextLayersChange} />
    )
    rerender(
      <Canvas {...baseProps} tool="select" textLayers={[textLayer]} onTextLayersChange={onTextLayersChange} />
    )

    await waitFor(() => expect(onTextLayersChange).toHaveBeenCalled())
    const lastCall = onTextLayersChange.mock.calls[onTextLayersChange.mock.calls.length - 1]
    const layers = lastCall[0] as TextLayer[]
    const text = layers.find((l) => l.id === 't1')
    expect(text).toBeTruthy()
    expect(text).toMatchObject({ type: 'text', text: 'Bang!', fontSize: 24 })
  })
})
