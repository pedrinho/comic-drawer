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
    // Single-canvas end state: only the Fabric canvas remains.
    expect(container.querySelectorAll('canvas').length).toBeGreaterThanOrEqual(1)
  })

  // In the single-canvas model, edits sync to the layer model IMMEDIATELY (on each gesture),
  // not on tool exit. So the important invariant on a plain tool switch (no edit) is that the
  // model is NOT clobbered — an early bug had the effect cleanup write the stale canvas back
  // over the model, wiping objects on load / undo / tool switch. These guard against that.
  const wipedTo = (fn: ReturnType<typeof vi.fn>) =>
    fn.mock.calls.some((c) => Array.isArray(c[0]) && c[0].length === 0)

  it('does not clobber shapeLayers when switching tools (no edit)', async () => {
    const onShapeLayersChange = vi.fn()
    const { rerender } = render(
      <Canvas {...baseProps} tool="objectShapes" shape="rectangle" shapeLayers={[rectLayer]} onShapeLayersChange={onShapeLayersChange} />
    )
    rerender(
      <Canvas {...baseProps} tool="select" shape="rectangle" shapeLayers={[rectLayer]} onShapeLayersChange={onShapeLayersChange} />
    )
    await waitFor(() => {}) // flush effects
    expect(wipedTo(onShapeLayersChange)).toBe(false)
  })

  it('does not clobber textLayers when switching tools (no edit)', async () => {
    const textLayer: TextLayer = {
      type: 'text', id: 't1', text: 'Bang!', x: 50, y: 40, width: 80, height: 24,
      rotation: 0, font: 'Arial', fontSize: 24, color: '#000000',
    }
    const onTextLayersChange = vi.fn()
    const { rerender } = render(
      <Canvas {...baseProps} tool="text" textLayers={[textLayer]} onTextLayersChange={onTextLayersChange} />
    )
    rerender(
      <Canvas {...baseProps} tool="select" textLayers={[textLayer]} onTextLayersChange={onTextLayersChange} />
    )
    await waitFor(() => {})
    expect(wipedTo(onTextLayersChange)).toBe(false)
  })

  it('does not clobber shapes + text when switching from select to a raster tool', async () => {
    const textLayer: TextLayer = {
      type: 'text', id: 't1', text: 'Pow', x: 50, y: 40, width: 60, height: 24,
      rotation: 0, font: 'Arial', fontSize: 24, color: '#000000',
    }
    const onShapeLayersChange = vi.fn()
    const onTextLayersChange = vi.fn()
    const { rerender } = render(
      <Canvas {...baseProps} tool="select" shapeLayers={[rectLayer]} textLayers={[textLayer]} onShapeLayersChange={onShapeLayersChange} onTextLayersChange={onTextLayersChange} />
    )
    rerender(
      <Canvas {...baseProps} tool="pen" shapeLayers={[rectLayer]} textLayers={[textLayer]} onShapeLayersChange={onShapeLayersChange} onTextLayersChange={onTextLayersChange} />
    )
    await waitFor(() => {})
    expect(wipedTo(onShapeLayersChange)).toBe(false)
    expect(wipedTo(onTextLayersChange)).toBe(false)
  })
})
