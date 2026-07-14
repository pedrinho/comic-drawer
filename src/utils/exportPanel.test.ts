import { describe, it, expect } from 'vitest'
import { PanelData } from '../types/common'
import { ObjectLayer, TextLayer } from '../types/layers'
import { renderPanelToStaticCanvas } from './exportPanel'

const shape: ObjectLayer = {
  type: 'shape', id: 's1', shape: 'rectangle', x: 100, y: 100, width: 200, height: 120,
  rotation: 0, strokeColor: '#000', strokeWidth: 2, fillColor: null,
}
const path: ObjectLayer = {
  type: 'path', id: 'p1', x: 10, y: 10, width: 50, height: 50, rotation: 0,
  strokeColor: '#000', strokeWidth: 3, points: [{ x: 0, y: 0 }, { x: 50, y: 50 }],
}
const text: TextLayer = {
  type: 'text', id: 't1', text: 'Hi', x: 20, y: 20, width: 40, height: 24,
  rotation: 0, font: 'Arial', fontSize: 24, color: '#000',
}

const panel: PanelData = {
  id: 0, name: 'Panel 1', data: null, layout: { rows: 1, columns: [1] },
  shapeLayers: [shape, path], textLayers: [text],
}

describe('renderPanelToStaticCanvas', () => {
  it('renders a 1200x800 canvas for a panel with mixed layers', async () => {
    const out = await renderPanelToStaticCanvas(panel)
    expect(out).toBeTruthy()
    expect(out.width).toBe(1200)
    expect(out.height).toBe(800)
  })

  it('handles an empty panel', async () => {
    const empty: PanelData = { id: 1, name: 'p', data: null, layout: { rows: 1, columns: [1] }, shapeLayers: [], textLayers: [] }
    const out = await renderPanelToStaticCanvas(empty)
    expect(out.width).toBe(1200)
  })
})
