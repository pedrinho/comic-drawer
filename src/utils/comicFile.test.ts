import { describe, it, expect } from 'vitest'
import { serializeComic, deserializeComic, COMIC_FILE_VERSION } from './comicFile'
import { PanelData } from '../types/common'
import { ObjectLayer, TextLayer, isShapeObjectLayer, isPathObjectLayer } from '../types/layers'

// NOTE: base64 <-> ImageData can't round-trip in jsdom (no image decoding), so these tests use
// panels with `data: null` and focus on the structural round-trip: names, layout, and vector
// layers — the part that a corrupted save/load would silently break.

const shape: ObjectLayer = {
  type: 'shape',
  id: 'shape-1',
  shape: 'star',
  x: 10,
  y: 20,
  width: 100,
  height: 80,
  rotation: 0.5,
  strokeColor: '#ff0000',
  strokeWidth: 3,
  fillColor: '#00ff00',
}

const path: ObjectLayer = {
  type: 'path',
  id: 'path-1',
  x: 0,
  y: 0,
  width: 50,
  height: 50,
  rotation: 0,
  points: [{ x: 0, y: 0 }, { x: 25, y: 25 }, { x: 50, y: 0 }],
  strokeColor: '#0000ff',
  strokeWidth: 2,
}

const text: TextLayer = {
  type: 'text',
  id: 'text-1',
  x: 5,
  y: 5,
  width: 60,
  height: 24,
  rotation: 0,
  text: 'Kapow!',
  font: 'Comic Sans',
  fontSize: 30,
  color: '#333333',
}

const makePanels = (): PanelData[] => [
  {
    id: 42,
    name: 'Intro',
    data: null,
    layout: { rows: 2, columns: [1, 2] },
    shapeLayers: [shape, path],
    textLayers: [text],
  },
]

// A full save -> JSON string -> parse -> load cycle, mirroring what App does around the DOM glue.
const roundTrip = async (panels: PanelData[]): Promise<PanelData[]> => {
  const json = JSON.stringify(serializeComic(panels))
  return deserializeComic(JSON.parse(json))
}

describe('comicFile serialize/deserialize round-trip', () => {
  it('stamps the current version and one saved panel per live panel', () => {
    const file = serializeComic(makePanels())
    expect(file.version).toBe(COMIC_FILE_VERSION)
    expect(file.panels).toHaveLength(1)
    expect(file.panels[0]!.name).toBe('Intro')
    expect(file.panels[0]!.data).toBeNull() // no raster substrate
  })

  it('preserves panel name and layout across a round-trip', async () => {
    const [loaded] = await roundTrip(makePanels())
    expect(loaded!.name).toBe('Intro')
    expect(loaded!.layout).toEqual({ rows: 2, columns: [1, 2] })
  })

  it('preserves every shape/path/text layer with its properties', async () => {
    const [loaded] = await roundTrip(makePanels())

    expect(loaded!.shapeLayers).toHaveLength(2)
    const loadedShape = loaded!.shapeLayers.find((l) => l.id === 'shape-1')!
    expect(isShapeObjectLayer(loadedShape)).toBe(true)
    if (isShapeObjectLayer(loadedShape)) {
      expect(loadedShape.shape).toBe('star')
      expect(loadedShape.strokeColor).toBe('#ff0000')
      expect(loadedShape.fillColor).toBe('#00ff00')
      expect(loadedShape.rotation).toBe(0.5)
    }

    const loadedPath = loaded!.shapeLayers.find((l) => l.id === 'path-1')!
    expect(isPathObjectLayer(loadedPath)).toBe(true)
    if (isPathObjectLayer(loadedPath)) {
      expect(loadedPath.points).toHaveLength(3)
      expect(loadedPath.points[1]).toEqual({ x: 25, y: 25 })
    }

    expect(loaded!.textLayers).toHaveLength(1)
    expect(loaded!.textLayers[0]!.text).toBe('Kapow!')
    expect(loaded!.textLayers[0]!.fontSize).toBe(30)
  })

  it('backfills the layer `type` when loading a legacy file that lacks it', async () => {
    // Simulate an old .cd where layers were saved without the discriminated-union `type`.
    const legacy = {
      version: '0.0.1',
      panels: [
        {
          id: 1,
          name: 'Old',
          data: null,
          layout: { rows: 1, columns: [1] },
          shapeLayers: [
            { id: 's', x: 0, y: 0, width: 10, height: 10, rotation: 0, shape: 'circle' },
          ],
          textLayers: [],
        },
      ],
    }
    const [loaded] = await deserializeComic(legacy as any)
    expect(loaded!.shapeLayers[0]!.type).toBe('shape')
  })

  it('falls back to a generated name when a saved panel has none', async () => {
    const file = serializeComic(makePanels())
    delete (file.panels[0] as any).name
    const [loaded] = await deserializeComic(file)
    expect(loaded!.name).toBe('Panel 1')
  })

  it('tolerates panels with missing layer arrays', async () => {
    const file = serializeComic(makePanels())
    delete (file.panels[0] as any).shapeLayers
    delete (file.panels[0] as any).textLayers
    const [loaded] = await deserializeComic(file)
    expect(loaded!.shapeLayers).toEqual([])
    expect(loaded!.textLayers).toEqual([])
  })
})
