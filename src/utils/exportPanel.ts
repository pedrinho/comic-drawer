import * as fabric from 'fabric'
import { PanelData } from '../types/common'
import {
  isShapeObjectLayer,
  isPathObjectLayer,
  isImageObjectLayer,
  isBalloonObjectLayer,
  isGroupObjectLayer,
} from '../types/layers'
import { shapeLayerToFabricObject } from './fabricShapes'
import { pathLayerToFabricPath } from './fabricPath'
import { imageLayerToFabricImage } from './fabricImage'
import { layerToFabricGroup } from './fabricGroup'
import { balloonLayerToFabricObject } from './fabricBalloon'
import { textLayerToFabricIText } from './fabricText'
import { buildRasterImage, buildGridObjects } from './fabricRaster'

const CANVAS_W = 1200
const CANVAS_H = 800

/**
 * Render one panel to a flat canvas via a Fabric `StaticCanvas`, reusing the SAME converters
 * the editor overlay uses — so exported PDFs match the editor pixel-for-pixel (paths, shapes,
 * text, deprecated balloons, and the raster substrate all go through one code path).
 *
 * `scale = 1` matches the previous offscreen renderer: an offscreen canvas has no layout, so
 * the legacy renderer used the CSS font size directly, and `textLayerToFabricIText(l, 1)` does
 * the same.
 *
 * `multiplier` scales the output (1 → 1200x800); the presentation passes its on-screen scale ×
 * devicePixelRatio so the slide stays crisp instead of upscaling a 1200x800 bitmap.
 */
export const renderPanelToStaticCanvas = async (panel: PanelData, multiplier = 1): Promise<HTMLCanvasElement> => {
  const el = document.createElement('canvas')
  const canvas = new fabric.StaticCanvas(el, {
    width: CANVAS_W,
    height: CANVAS_H,
    backgroundColor: '#ffffff',
  })

  // Bottom: raster substrate, then the grid.
  canvas.add(buildRasterImage(panel.data).image)
  buildGridObjects(panel.layout).forEach((g) => canvas.add(g))

  // Vector objects, in layer order (async image/group/balloon builds are awaited).
  for (const l of panel.shapeLayers ?? []) {
    if (isShapeObjectLayer(l)) canvas.add(shapeLayerToFabricObject(l))
    else if (isPathObjectLayer(l)) canvas.add(pathLayerToFabricPath(l))
    else if (isBalloonObjectLayer(l)) canvas.add(balloonLayerToFabricObject(l))
    else if (isImageObjectLayer(l)) canvas.add(await imageLayerToFabricImage(l))
    else if (isGroupObjectLayer(l)) canvas.add(await layerToFabricGroup(l, 1))
  }
  for (const l of panel.textLayers ?? []) canvas.add(textLayerToFabricIText(l, 1))

  // Ensure custom fonts are loaded before rasterizing text.
  const fonts = (document as any).fonts
  if (fonts?.ready) {
    try {
      await fonts.ready
    } catch {
      /* ignore font loading errors */
    }
  }

  canvas.renderAll()
  const out = canvas.toCanvasElement(multiplier)
  canvas.dispose()
  return out
}
