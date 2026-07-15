import * as fabric from 'fabric'
import { BalloonKind } from '../types/common'
import { BalloonObjectLayer } from '../types/layers'

/**
 * Fabric.js balloon (speech-bubble) conversion layer.
 *
 * A balloon is a single `fabric.Path` — the bubble outline — positioned with a centred origin,
 * exactly like the shape converter (`fabricShapes.ts`). The path for each balloon *kind* is
 * produced by a parametric generator that draws the full outline (body + tail) inside a `w × h`
 * box centred at (0,0); Fabric then provides move/scale/rotate/serialisation for free. Resize is
 * captured as `scaleX/scaleY` against the stored box size, mirroring shapes.
 *
 * Adding a new kind (thought, shout, angry, …) is one entry in `BALLOON_KINDS` + one path fn.
 * The tool is shape-only for now: the caption fields on the layer are carried through (for a
 * future editable caption) but not rendered.
 */

export const BALLOON_ID_KEY = 'balloonId'
export const BALLOON_KIND_KEY = 'balloonKind'
const BALLOON_BOX_W_KEY = 'balloonBoxW' // intended drag-box width (path bbox == box here, but keep parallel to shapes)
const BALLOON_BOX_H_KEY = 'balloonBoxH'
const BALLOON_META_KEY = 'balloonMeta' // caption fields (text/font/fontSize), stashed so they survive a round-trip

const RAD_TO_DEG = 180 / Math.PI
const DEG_TO_RAD = Math.PI / 180

/**
 * SVG path for a classic comic speech bubble: a rounded rectangle body with a curved triangular
 * tail hanging from the bottom (slightly left of centre). The whole outline fits a `w × h` box
 * centred at (0,0), so a centred-origin `fabric.Path` sits neatly at the layer centre.
 */
const speechPathData = (w: number, h: number): string => {
  const left = -w / 2
  const right = w / 2
  const top = -h / 2
  const tailH = h * 0.22
  const bottom = h / 2 - tailH // body's bottom edge; the tail hangs from here to the box bottom
  const bodyH = bottom - top
  const r = Math.max(2, Math.min(Math.min(w, bodyH) * 0.18, w / 2 - 1, bodyH / 2 - 1))
  // Tail base sits on the bottom edge; tip reaches the box bottom, a touch left of centre.
  const tailBaseRightX = -w * 0.03
  const tailBaseLeftX = -w * 0.2
  const tipX = -w * 0.11
  const tipY = h / 2

  return [
    `M ${left + r} ${top}`,
    `L ${right - r} ${top}`,
    `Q ${right} ${top} ${right} ${top + r}`,
    `L ${right} ${bottom - r}`,
    `Q ${right} ${bottom} ${right - r} ${bottom}`,
    `L ${tailBaseRightX} ${bottom}`,
    `Q ${tipX + w * 0.04} ${bottom + tailH * 0.55} ${tipX} ${tipY}`,
    `Q ${tipX - w * 0.04} ${bottom + tailH * 0.55} ${tailBaseLeftX} ${bottom}`,
    `L ${left + r} ${bottom}`,
    `Q ${left} ${bottom} ${left} ${bottom - r}`,
    `L ${left} ${top + r}`,
    `Q ${left} ${top} ${left + r} ${top}`,
    'Z',
  ].join(' ')
}

/** Registry of balloon kinds. Add a kind here (+ a path generator) to expand the tool. */
export const BALLOON_KINDS: Record<BalloonKind, { label: string; icon: string; pathData: (w: number, h: number) => string }> = {
  speech: { label: 'Speech', icon: '🗨️', pathData: speechPathData },
}

const pathDataFor = (kind: BalloonKind, w: number, h: number): string =>
  (BALLOON_KINDS[kind] ?? BALLOON_KINDS.speech).pathData(w, h)

/**
 * Build a `fabric.Path` bubble from a BalloonObjectLayer. Centred origin at the layer centre;
 * white fill, coloured outline. Mirrors `shapeLayerToFabricObject` (no `scale` arg — shape only).
 */
export const balloonLayerToFabricObject = (layer: BalloonObjectLayer): fabric.Path => {
  const kind = layer.kind ?? 'speech'
  const path = new fabric.Path(pathDataFor(kind, layer.width, layer.height), {
    originX: 'center',
    originY: 'center',
    left: layer.x + layer.width / 2,
    top: layer.y + layer.height / 2,
    angle: layer.rotation * RAD_TO_DEG,
    fill: 'white',
    stroke: layer.color,
    strokeWidth: 3,
    strokeUniform: true, // keep the outline constant while the bubble is scaled
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
  })
  path.set({
    [BALLOON_ID_KEY]: layer.id,
    [BALLOON_KIND_KEY]: kind,
    [BALLOON_BOX_W_KEY]: layer.width,
    [BALLOON_BOX_H_KEY]: layer.height,
    [BALLOON_META_KEY]: { text: layer.text ?? '', font: layer.font, fontSize: layer.fontSize },
  })
  path.setCoords()
  return path
}

/** True if a Fabric object is a balloon bubble. */
export const isFabricBalloon = (obj: fabric.Object): boolean => Boolean(obj[BALLOON_ID_KEY])

/**
 * Read a balloon back into a BalloonObjectLayer after a move/rotate/resize. Width/height come
 * from the stored box × scale (like shapes); position from the centred origin. Caption fields are
 * recovered from the stashed meta (unused by the shape-only renderer, but preserved).
 */
export const fabricBalloonToLayer = (obj: fabric.Path): BalloonObjectLayer => {
  const kind = obj[BALLOON_KIND_KEY] ?? 'speech'
  const meta = obj[BALLOON_META_KEY] ?? {}
  const boxW = obj[BALLOON_BOX_W_KEY] ?? obj.width ?? 1
  const boxH = obj[BALLOON_BOX_H_KEY] ?? obj.height ?? 1
  const width = boxW * (obj.scaleX ?? 1)
  const height = boxH * (obj.scaleY ?? 1)
  const left = obj.left ?? 0
  const top = obj.top ?? 0

  return {
    type: 'balloon',
    id: obj[BALLOON_ID_KEY] ?? `balloon-${Math.round(left)}-${Math.round(top)}`,
    kind,
    x: left - width / 2,
    y: top - height / 2,
    width,
    height,
    rotation: (obj.angle ?? 0) * DEG_TO_RAD,
    text: meta.text ?? '',
    font: meta.font ?? 'Arial',
    fontSize: meta.fontSize ?? 24,
    color: typeof obj.stroke === 'string' ? obj.stroke : '#000000',
  }
}
