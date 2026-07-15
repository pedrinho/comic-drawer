import { describe, it, expect, vi } from 'vitest'
import * as fabric from 'fabric'
import { ObjectLayer, TextLayer, PathObjectLayer, GroupObjectLayer, ShapeObjectLayer } from '../types/layers'
import { shapeLayerToFabricObject } from './fabricShapes'
import { textLayerToFabricIText } from './fabricText'
import { pathLayerToFabricPath } from './fabricPath'
import { buildGridObjects, buildRasterImage } from './fabricRaster'
import { canvasObjectsToLayers, buildScene } from './fabricScene'

const rectLayer: ShapeObjectLayer = {
  type: 'shape', id: 's1', shape: 'rectangle', x: 100, y: 100, width: 200, height: 120,
  rotation: 0, strokeColor: '#123456', strokeWidth: 2, fillColor: null,
}
const pathLayer: PathObjectLayer = {
  type: 'path', id: 'p1', x: 10, y: 10, width: 50, height: 40, rotation: 0,
  strokeColor: '#ff0000', strokeWidth: 3, fillColor: null, points: [{ x: 0, y: 0 }, { x: 50, y: 40 }],
}
const textLayer: TextLayer = {
  type: 'text', id: 't1', text: 'hi', x: 0, y: 0, width: 30, height: 20,
  rotation: 0, font: 'Arial', fontSize: 20, color: '#000000',
}
const groupLayer: GroupObjectLayer = {
  type: 'group', id: 'g1', x: 100, y: 80, width: 120, height: 60, rotation: 0,
  children: [
    { type: 'shape', id: 'c1', shape: 'rectangle', x: -50, y: -20, width: 40, height: 40, rotation: 0, strokeColor: '#000000', strokeWidth: 2, fillColor: null },
  ],
}

const makeCanvas = () => new fabric.StaticCanvas(undefined, { width: 1200, height: 800 })
const flush = () => new Promise<void>((r) => setTimeout(r, 0))

describe('canvasObjectsToLayers', () => {
  it('splits shapes/paths from text, excludes chrome, and preserves z-order', () => {
    const objects: fabric.FabricObject[] = [
      shapeLayerToFabricObject(rectLayer),
      pathLayerToFabricPath(pathLayer),
      textLayerToFabricIText(textLayer, 1),
      ...buildGridObjects({ rows: 1, columns: [1] }), // chrome
      buildRasterImage(null).image, // chrome
    ]

    const { shapeLayers, textLayers } = canvasObjectsToLayers(objects, 1)

    expect(shapeLayers.map((l) => l.id)).toEqual(['s1', 'p1']) // chrome excluded, order kept
    expect(textLayers.map((l) => l.id)).toEqual(['t1'])
  })

  it('returns empty layers when handed only chrome', () => {
    const chrome = [...buildGridObjects({ rows: 2, columns: [1, 2] }), buildRasterImage(null).image]
    const { shapeLayers, textLayers } = canvasObjectsToLayers(chrome, 1)
    expect(shapeLayers).toEqual([])
    expect(textLayers).toEqual([])
  })
})

describe('buildScene', () => {
  const baseOpts = {
    panelData: null,
    layout: { rows: 1, columns: [1] },
    scale: 1,
    applyObjectControls: () => {},
    isDisposed: () => false,
  }

  it('lays down chrome + sync objects and returns the raster handles', () => {
    const canvas = makeCanvas()
    const { rasterImage, rasterBacking } = buildScene(canvas, {
      ...baseOpts,
      shapeLayers: [rectLayer, pathLayer] as ObjectLayer[],
      textLayers: [textLayer],
    })

    expect(rasterImage).toBeInstanceOf(fabric.FabricImage)
    expect(rasterBacking.width).toBe(1200)
    expect(rasterBacking.height).toBe(800)
    expect(canvas.backgroundColor).toBe('#ffffff')

    // Reading the built scene back yields the same model (chrome filtered out).
    const back = canvasObjectsToLayers(canvas.getObjects(), 1)
    expect(back.shapeLayers.map((l) => l.id)).toEqual(['s1', 'p1'])
    expect(back.textLayers.map((l) => l.id)).toEqual(['t1'])
  })

  it('clears prior objects before rebuilding', () => {
    const canvas = makeCanvas()
    canvas.add(shapeLayerToFabricObject(rectLayer))
    buildScene(canvas, { ...baseOpts, shapeLayers: [] as ObjectLayer[], textLayers: [] })
    // Only chrome remains — no leftover shape.
    expect(canvasObjectsToLayers(canvas.getObjects(), 1).shapeLayers).toEqual([])
  })

  it('adds async group layers and applies their controls when not disposed', async () => {
    const canvas = makeCanvas()
    const applyObjectControls = vi.fn()
    buildScene(canvas, { ...baseOpts, applyObjectControls, shapeLayers: [groupLayer], textLayers: [] })
    await flush()
    expect(applyObjectControls).toHaveBeenCalledTimes(1)
    expect(canvas.getObjects().some((o) => o instanceof fabric.Group)).toBe(true)
  })

  it('async loads no-op when isDisposed() is true (stale canvas after teardown)', async () => {
    const canvas = makeCanvas()
    const applyObjectControls = vi.fn()
    buildScene(canvas, {
      ...baseOpts,
      isDisposed: () => true,
      applyObjectControls,
      shapeLayers: [groupLayer],
      textLayers: [],
    })
    await flush()
    expect(applyObjectControls).not.toHaveBeenCalled()
    expect(canvas.getObjects().some((o) => o instanceof fabric.Group)).toBe(false)
  })
})
