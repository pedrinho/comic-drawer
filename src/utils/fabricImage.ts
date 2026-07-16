import * as fabric from 'fabric'
import { ImageObjectLayer } from '../types/layers'
import { PATH_ID_KEY } from './fabricPath'
import { SHAPE_KIND_KEY } from './fabricShapes'

/**
 * Fabric.js migration — image conversion layer.
 *
 * Maps between `ImageObjectLayer` (base64 `data`, produced by the scissor tool on the
 * legacy raster canvas) and `fabric.FabricImage`. Loading is async (the browser decodes the
 * data URL), so `imageLayerToFabricImage` returns a promise.
 *
 * The original base64 is stashed on the object (`IMAGE_DATA_KEY`) so it round-trips back
 * without re-encoding.
 */

export const IMAGE_ID_KEY = 'imageId'
export const IMAGE_DATA_KEY = 'imageData'

const RAD_TO_DEG = 180 / Math.PI
const DEG_TO_RAD = Math.PI / 180

/** A freshly-pasted image is scaled to occupy at most this fraction of the canvas. */
export const MAX_PASTE_FRACTION = 0.66

/**
 * Scale factor that fits a natural-size image within `maxFraction` of the canvas, preserving
 * aspect ratio and never upscaling (a small image keeps its native size). Pure — the paste
 * placement math, split out so it can be unit-tested without decoding an image.
 */
export const fitPasteScale = (
  natWidth: number,
  natHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  maxFraction = MAX_PASTE_FRACTION
): number => {
  const w = natWidth || 1
  const h = natHeight || 1
  return Math.min(1, (canvasWidth * maxFraction) / w, (canvasHeight * maxFraction) / h)
}

/**
 * Build a fabric.FabricImage from a data URL (e.g. a pasted clipboard image), centered on the
 * canvas and scaled to fit via `fitPasteScale`. The id + original data URL are stamped so it
 * round-trips through `fabricImageToLayer` unchanged. Async — the browser decodes the data URL.
 */
export const createImageFromDataUrl = async (
  dataUrl: string,
  opts: { canvasWidth: number; canvasHeight: number; id: string }
): Promise<fabric.FabricImage> => {
  const img = await fabric.FabricImage.fromURL(dataUrl)
  const scale = fitPasteScale(img.width || 1, img.height || 1, opts.canvasWidth, opts.canvasHeight)
  img.set({
    originX: 'center',
    originY: 'center',
    left: opts.canvasWidth / 2,
    top: opts.canvasHeight / 2,
    scaleX: scale,
    scaleY: scale,
    [IMAGE_ID_KEY]: opts.id,
    [IMAGE_DATA_KEY]: dataUrl,
  })
  return img
}

/** Load an ImageObjectLayer as a fabric.FabricImage, sized/positioned to the layer bounds. */
export const imageLayerToFabricImage = async (
  layer: ImageObjectLayer
): Promise<fabric.FabricImage> => {
  const img = await fabric.FabricImage.fromURL(layer.data)
  const natW = img.width || layer.width || 1
  const natH = img.height || layer.height || 1
  img.set({
    originX: 'center',
    originY: 'center',
    left: layer.x + layer.width / 2,
    top: layer.y + layer.height / 2,
    angle: layer.rotation * RAD_TO_DEG,
    scaleX: layer.width / natW,
    scaleY: layer.height / natH,
    [IMAGE_ID_KEY]: layer.id,
    [IMAGE_DATA_KEY]: layer.data,
  })
  return img
}

/** Read a fabric.FabricImage back into an ImageObjectLayer. */
export const fabricImageToLayer = (obj: fabric.FabricImage): ImageObjectLayer => {
  const id = obj[IMAGE_ID_KEY]
  const data =
    obj[IMAGE_DATA_KEY] ??
    (typeof obj.getSrc === 'function' ? obj.getSrc() : '')
  const width = (obj.width ?? 0) * (obj.scaleX ?? 1)
  const height = (obj.height ?? 0) * (obj.scaleY ?? 1)
  const x = (obj.left ?? 0) - width / 2
  const y = (obj.top ?? 0) - height / 2

  return {
    type: 'image',
    id: id ?? `image-${Math.round(x)}-${Math.round(y)}`,
    x,
    y,
    width,
    height,
    rotation: (obj.angle ?? 0) * DEG_TO_RAD,
    data,
  }
}

/** Discriminate a Fabric object's originating layer kind (for select-mode sync-back). */
export const fabricObjectKind = (
  obj: fabric.FabricObject
): 'text' | 'image' | 'shape' | 'group' | 'path' => {
  if (obj instanceof fabric.Group || obj.type === 'group') {
    return 'group'
  }
  if (obj instanceof fabric.IText || obj.type === 'i-text' || obj.type === 'text') {
    return 'text'
  }
  if (obj instanceof fabric.FabricImage || obj.type === 'image' || obj[IMAGE_ID_KEY]) {
    return 'image'
  }
  // A pen path carries PATH_ID_KEY; a heart shape is also a fabric.Path but carries
  // SHAPE_KIND_KEY, so require the path key AND the absence of the shape key.
  if (obj[PATH_ID_KEY] && !obj[SHAPE_KIND_KEY]) {
    return 'path'
  }
  return 'shape'
}
