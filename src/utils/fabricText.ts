import * as fabric from 'fabric'
import { TextObjectLayer } from '../types/layers'

/**
 * Fabric.js migration — text conversion layer.
 *
 * Maps between the app's `TextObjectLayer` and `fabric.IText` (which gives in-place editing
 * for free, replacing the old HTML `<input>` overlay).
 *
 * Font-size note: `TextObjectLayer.fontSize` is stored in CSS pixels, and the legacy 2D
 * renderer divided it by the canvas display scale to get the on-canvas size. We
 * mirror that here — the Fabric object's `fontSize` is in canvas-internal units
 * (`cssFontSize / scale`) — so text keeps a constant on-screen size, matching the old
 * behaviour. `scale` is `(rect.width/1200 + rect.height/800) / 2`; pass 1 when unavailable.
 */

export const TEXT_ID_KEY = 'textId'

const RAD_TO_DEG = 180 / Math.PI
const DEG_TO_RAD = Math.PI / 180

/** Build a fabric.IText from a TextObjectLayer. Uses a centered origin so rotation matches. */
export const textLayerToFabricIText = (layer: TextObjectLayer, scale: number): fabric.IText => {
  const s = scale || 1
  return new fabric.IText(layer.text, {
    originX: 'center',
    originY: 'center',
    left: layer.x + layer.width / 2,
    top: layer.y + layer.height / 2,
    angle: layer.rotation * RAD_TO_DEG,
    fontFamily: layer.font,
    fontSize: layer.fontSize / s,
    fill: layer.color,
    [TEXT_ID_KEY]: layer.id,
  })
}

/** Read a fabric.IText back into a TextObjectLayer. */
export const fabricITextToTextLayer = (obj: fabric.IText, scale: number): TextObjectLayer => {
  const s = scale || 1
  const id = obj[TEXT_ID_KEY]
  const width = (obj.width ?? 0) * (obj.scaleX ?? 1)
  const height = (obj.height ?? 0) * (obj.scaleY ?? 1)
  const x = (obj.left ?? 0) - width / 2
  const y = (obj.top ?? 0) - height / 2
  // Scaling the object visually scales its font too; fold scaleY back into fontSize.
  const effectiveFontSize = (obj.fontSize ?? 0) * (obj.scaleY ?? 1)

  return {
    type: 'text',
    id: id ?? `text-${Math.round(x)}-${Math.round(y)}`,
    text: obj.text ?? '',
    x,
    y,
    width,
    height,
    rotation: (obj.angle ?? 0) * DEG_TO_RAD,
    font: typeof obj.fontFamily === 'string' ? obj.fontFamily : 'Arial',
    fontSize: effectiveFontSize * s, // convert canvas-internal units back to CSS pixels
    color: typeof obj.fill === 'string' ? obj.fill : '#000000',
  }
}
