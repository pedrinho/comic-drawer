import * as fabric from 'fabric'
import { ClippingGroup } from '@erase2d/fabric'
import type { EraseStroke } from '../types/layers'

/**
 * Per-object eraser masks — the layer between erase2d's Fabric masks and our layer model.
 *
 * Erasing an object never flattens it: each eraser stroke that crosses it is added to the object's
 * `clipPath`, an erase2d `ClippingGroup` (a keep-rect with `destination-out` strokes punched through
 * it), living in the object's own local plane. Fabric then renders the hole as part of the object,
 * so it moves / rotates / scales / duplicates with it, and the object stays selectable.
 *
 * What erase2d doesn't cover, and this module does:
 *  - Persistence. The model is the source of truth (rebuilt on every tool switch / undo / load /
 *    export), and our converters rebuild objects at a different scale than they were edited at
 *    (a resize is folded into width or fontSize). So strokes are stored in the object's *frame* —
 *    its unrotated local plane at its current size, centred on its centre — and re-projected into
 *    the rebuilt object's local plane (`readErasures` / `applyErasures`).
 *  - Mask sizing. The keep-rect must cover the object (plus miter tips / uniform strokes), and it
 *    must follow an object whose own box changes at runtime — text growing while typing — with the
 *    strokes re-anchored so each hole stays over the same glyphs (`fitEraseMask`).
 *  - Ungroup: a group's strokes are handed down to the children it covered.
 */

type Mat = fabric.TMat2D

const { multiplyTransformMatrices: mul, invertTransform, applyTransformToObject, sendObjectToPlane, joinPath } =
  fabric.util

export const isEraseMask = (o: unknown): o is ClippingGroup => o instanceof ClippingGroup

/** A mask stroke: round, opaque, punched out of the mask's keep-rect. */
const makeStroke = (d: string | fabric.TSimplePathData, width: number): fabric.Path =>
  new fabric.Path(typeof d === 'string' ? d : (d.map((seg) => [...seg]) as fabric.TSimplePathData), {
    fill: null,
    stroke: 'black',
    strokeWidth: width,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    strokeUniform: false,
    globalCompositeOperation: 'destination-out',
    objectCaching: false,
  })

const strokesOf = (mask: ClippingGroup): fabric.Path[] =>
  mask.getObjects().filter((o): o is fabric.Path => o instanceof fabric.Path)

const scaleOf = (obj: fabric.FabricObject): Mat => [obj.scaleX || 1, 0, 0, obj.scaleY || 1, 0, 0]

const round = (m: Mat): EraseStroke['matrix'] =>
  m.map((v) => Math.round(v * 1e4) / 1e4) as EraseStroke['matrix']

/**
 * How far past the owner's own box the keep-rect must reach so nothing the owner draws is cropped:
 * its stroke (in local units — a uniform stroke grows locally when the object is scaled down), its
 * miter tips on sharp corners, plus a little antialiasing slack.
 */
const maskPad = (obj: fabric.FabricObject): number => {
  const sw = obj.stroke ? obj.strokeWidth ?? 0 : 0
  const s = obj.strokeUniform ? Math.min(Math.abs(obj.scaleX || 1), Math.abs(obj.scaleY || 1)) || 1 : 1
  const reach = obj.strokeLineJoin === 'miter' ? (obj.strokeMiterLimit ?? 4) / 2 : 0.5
  return (sw / s) * reach + 4
}

/**
 * Keep `obj`'s mask fitted to it. When the owner's own box changed since the last fit (text grew or
 * shrank while typing) the strokes are shifted by half the change: the plane is centred, but the
 * content is anchored to the box's top-left edge (left-aligned text), so this keeps every hole over
 * the same glyphs. Cheap no-op when nothing changed; returns whether it changed anything.
 */
export const fitEraseMask = (obj: fabric.FabricObject): boolean => {
  const mask = obj.clipPath
  if (!isEraseMask(mask)) return false
  const w = obj.width ?? 0
  const h = obj.height ?? 0
  const prev = mask.maskOwnerSize
  let changed = false
  if (prev && (prev.w !== w || prev.h !== h)) {
    const dx = (prev.w - w) / 2
    const dy = (prev.h - h) / 2
    strokesOf(mask).forEach((p) => p.set({ left: (p.left ?? 0) + dx, top: (p.top ?? 0) + dy }))
    changed = true
  }
  const pad = maskPad(obj)
  const tw = w + pad * 2
  const th = h + pad * 2
  if (changed || !prev || Math.abs(mask.width - tw) > 0.5 || Math.abs(mask.height - th) > 0.5) {
    mask.set({ width: tw, height: th })
    mask.maskOwnerSize = { w, h }
    mask.set('dirty', true)
    obj.set('dirty', true)
    changed = true
  }
  return changed
}

/** `obj`'s erase mask, created (empty, fitted) on first use. */
export const ensureEraseMask = (obj: fabric.FabricObject): ClippingGroup => {
  if (isEraseMask(obj.clipPath)) return obj.clipPath
  const mask = new ClippingGroup([], {})
  obj.clipPath = mask
  fitEraseMask(obj)
  return mask
}

/**
 * Erase `source` — a finished eraser path in the CANVAS plane — out of `obj`: a copy of it is moved
 * into `obj`'s local plane (through any parent group) and added to its mask.
 */
export const commitEraseStroke = (obj: fabric.FabricObject, source: fabric.Path): void => {
  const mask = ensureEraseMask(obj)
  const stroke = makeStroke(source.path, source.strokeWidth ?? 1)
  applyTransformToObject(stroke, source.calcTransformMatrix())
  sendObjectToPlane(stroke, undefined, obj.calcTransformMatrix())
  mask.add(stroke)
  mask.set('dirty', true)
  obj.set('dirty', true)
}

/** Model ← Fabric: `obj`'s mask strokes expressed in its frame, or undefined if never erased. */
export const readErasures = (obj: fabric.FabricObject): EraseStroke[] | undefined => {
  const mask = obj.clipPath
  if (!isEraseMask(mask)) return undefined
  fitEraseMask(obj)
  const strokes = strokesOf(mask)
  if (!strokes.length) return undefined
  const toFrame = mul(scaleOf(obj), mask.calcOwnMatrix())
  return strokes.map((s) => ({
    d: joinPath(s.path, 2),
    width: s.strokeWidth ?? 1,
    matrix: round(mul(toFrame, s.calcOwnMatrix())),
  }))
}

/** Spread into a layer: `{ erasures }` when `obj` has been erased, `{}` otherwise. */
export const erasuresOf = (obj: fabric.FabricObject): { erasures?: EraseStroke[] } => {
  const erasures = readErasures(obj)
  return erasures ? { erasures } : {}
}

/**
 * Fabric ← model: rebuild `obj`'s mask from its layer's strokes. Call once the object has its final
 * size/scale (the frame → local projection reads them). Returns `obj` for chaining.
 */
export const applyErasures = <T extends fabric.FabricObject>(obj: T, erasures?: EraseStroke[]): T => {
  if (!erasures?.length) return obj
  const mask = ensureEraseMask(obj)
  const fromFrame = invertTransform(scaleOf(obj))
  erasures.forEach((e) => {
    const stroke = makeStroke(e.d, e.width)
    // Place it in the owner's local plane; `mask.add` then re-planes it into the mask (like any
    // Group.add, it treats the incoming transform as being in the plane that contains the mask).
    applyTransformToObject(stroke, mul(fromFrame, e.matrix))
    mask.add(stroke)
  })
  mask.set('dirty', true)
  obj.set('dirty', true)
  return obj
}

/**
 * Before un-merging `group`: hand its eraser strokes down to each child they cross (in the child's
 * own plane), then drop the group's mask — otherwise the holes would vanish with the group.
 */
export const pushGroupEraseMaskToChildren = (group: fabric.Group): void => {
  const mask = group.clipPath
  if (!isEraseMask(mask)) return
  const toCanvas = mul(group.calcTransformMatrix(), mask.calcOwnMatrix())
  const sources = strokesOf(mask).map((s) => {
    const src = makeStroke(s.path, s.strokeWidth ?? 1)
    applyTransformToObject(src, mul(toCanvas, s.calcOwnMatrix()))
    src.setCoords()
    return src
  })
  group.getObjects().forEach((child) => {
    sources.forEach((src) => {
      if (child.intersectsWithObject(src)) commitEraseStroke(child, src)
    })
  })
  group.clipPath = undefined
  group.set('dirty', true)
}

/**
 * True when erasing has left nothing of `obj` visible (every pixel's alpha ≤ `alphaThreshold`), so
 * the eraser can delete it rather than leave an invisible-but-grabbable object behind. Renders the
 * object (with its mask) at most 256px on its longest side. Objects never erased are never "empty".
 */
export const isFullyErased = (obj: fabric.FabricObject, alphaThreshold = 16): boolean => {
  if (!isEraseMask(obj.clipPath)) return false
  const longest = Math.max(obj.width ?? 0, obj.height ?? 0) || 1
  const el = obj.toCanvasElement({
    multiplier: Math.min(1, 256 / longest),
    withoutTransform: true,
    withoutShadow: true,
    enableRetinaScaling: false,
    viewportTransform: false,
  })
  const ctx = el.getContext('2d')
  if (!ctx || !el.width || !el.height) return false
  const { data } = ctx.getImageData(0, 0, el.width, el.height)
  for (let i = 3; i < data.length; i += 4) {
    if ((data[i] ?? 0) > alphaThreshold) return false
  }
  return true
}
