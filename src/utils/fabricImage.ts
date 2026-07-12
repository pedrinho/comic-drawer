import * as fabric from 'fabric'
import { ImageObjectLayer } from '../types/layers'

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
  } as any)
  return img
}

/** Read a fabric.FabricImage back into an ImageObjectLayer. */
export const fabricImageToLayer = (obj: fabric.FabricImage): ImageObjectLayer => {
  const id = (obj as any)[IMAGE_ID_KEY] as string | undefined
  const data =
    ((obj as any)[IMAGE_DATA_KEY] as string | undefined) ??
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
export const fabricObjectKind = (obj: fabric.FabricObject): 'text' | 'image' | 'shape' | 'group' => {
  if (obj instanceof fabric.Group || (obj as any).type === 'group') {
    return 'group'
  }
  if (obj instanceof fabric.IText || (obj as any).type === 'i-text' || (obj as any).type === 'text') {
    return 'text'
  }
  if (obj instanceof fabric.FabricImage || (obj as any).type === 'image' || (obj as any)[IMAGE_ID_KEY]) {
    return 'image'
  }
  return 'shape'
}
