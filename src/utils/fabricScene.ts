import * as fabric from 'fabric'
import {
  TextLayer,
  ObjectLayer,
  isPathObjectLayer,
  isShapeObjectLayer,
  isImageObjectLayer,
  isBalloonObjectLayer,
  isGroupObjectLayer,
} from '../types/layers'
import { shapeLayerToFabricObject, fabricObjectToShapeLayer } from './fabricShapes'
import { textLayerToFabricIText, fabricITextToTextLayer } from './fabricText'
import { imageLayerToFabricImage, fabricImageToLayer, fabricObjectKind } from './fabricImage'
import { layerToFabricGroup, fabricGroupToLayer } from './fabricGroup'
import { pathLayerToFabricPath, fabricPathToLayer } from './fabricPath'
import { buildRasterImage, buildGridObjects, isChromeObject } from './fabricRaster'
import { balloonLayerToFabricObject, fabricBalloonToLayer, isFabricBalloon } from './fabricBalloon'

/**
 * Read a Fabric canvas's objects back into the layer model — the reader half of `syncToLayers`.
 *
 * Chrome (raster substrate + grid) is excluded. Canvas z-order is preserved within `shapeLayers`;
 * texts are collected separately (they render on top, matching the model/export). Pure: it neither
 * reads nor mutates the canvas beyond the object list it's handed.
 */
export const canvasObjectsToLayers = (
  objects: fabric.FabricObject[],
  scale: number
): { shapeLayers: ObjectLayer[]; textLayers: TextLayer[] } => {
  const objs = objects.filter((o) => !isChromeObject(o))
  const shapeLayers: ObjectLayer[] = []
  const textLayers: TextLayer[] = []
  objs.forEach((o) => {
    if (isFabricBalloon(o)) {
      shapeLayers.push(fabricBalloonToLayer(o as fabric.Path))
      return
    }
    const kind = fabricObjectKind(o)
    if (kind === 'text') textLayers.push(fabricITextToTextLayer(o as fabric.IText, scale))
    else if (kind === 'image') shapeLayers.push(fabricImageToLayer(o as fabric.FabricImage))
    else if (kind === 'group') shapeLayers.push(fabricGroupToLayer(o as fabric.Group, scale))
    else if (kind === 'path') shapeLayers.push(fabricPathToLayer(o as fabric.Path))
    else shapeLayers.push(fabricObjectToShapeLayer(o))
  })
  return { shapeLayers, textLayers }
}

interface BuildSceneOptions {
  shapeLayers: ObjectLayer[]
  textLayers: TextLayer[]
  panelData: ImageData | null
  layout: { rows: number; columns: number[] }
  scale: number
  /** Applied to async-loaded (image/group) objects as they resolve. */
  applyObjectControls: (obj: fabric.FabricObject) => void
  /** Async loads bail when this returns true (the effect was torn down). */
  isDisposed: () => boolean
}

/**
 * Build the whole overlay scene onto `canvas` — the writer half of the render effect.
 *
 * Clears the canvas, lays down the white page + raster substrate + grid (chrome, at the back),
 * then adds every vector object from the layer model on top. Synchronous object types are added
 * immediately; image/group layers load asynchronously and bail via `isDisposed()` if the effect
 * was torn down, applying their own controls on arrival. Returns the raster handles the raster
 * tools paint against. Does NOT own the caller's ref bookkeeping or the post-build controls sweep.
 */
export const buildScene = (
  canvas: fabric.Canvas,
  { shapeLayers, textLayers, panelData, layout, scale, applyObjectControls, isDisposed }: BuildSceneOptions
): { rasterImage: fabric.FabricImage; rasterBacking: HTMLCanvasElement } => {
  canvas.backgroundColor = '#ffffff'
  canvas.getObjects().slice().forEach((o) => canvas.remove(o))
  const { image: rasterImage, backing: rasterBacking } = buildRasterImage(panelData)
  canvas.add(rasterImage)
  buildGridObjects(layout).forEach((g) => canvas.add(g))

  shapeLayers.forEach((l) => {
    if (isShapeObjectLayer(l)) canvas.add(shapeLayerToFabricObject(l))
    else if (isPathObjectLayer(l)) canvas.add(pathLayerToFabricPath(l))
    else if (isBalloonObjectLayer(l)) canvas.add(balloonLayerToFabricObject(l))
    else if (isImageObjectLayer(l)) {
      imageLayerToFabricImage(l)
        .then((img) => {
          if (isDisposed()) return
          applyObjectControls(img)
          canvas.add(img)
          canvas.requestRenderAll()
        })
        .catch(() => {
          /* skip images that fail to decode */
        })
    } else if (isGroupObjectLayer(l)) {
      layerToFabricGroup(l, scale)
        .then((group) => {
          if (isDisposed()) return
          applyObjectControls(group)
          canvas.add(group)
          canvas.requestRenderAll()
        })
        .catch(() => {
          /* skip groups that fail to build */
        })
    }
  })
  textLayers.forEach((l) => canvas.add(textLayerToFabricIText(l, scale)))
  canvas.requestRenderAll()

  return { rasterImage, rasterBacking }
}
