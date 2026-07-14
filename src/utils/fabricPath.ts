import * as fabric from 'fabric'
import { PathObjectLayer } from '../types/layers'

/**
 * Fabric.js migration — path (freehand pen) conversion layer.
 *
 * Maps between `PathObjectLayer` (a polyline produced by the pen tool) and `fabric.Path` so
 * the pen can draw with a native `PencilBrush` and paths become selectable/movable on the
 * Fabric overlay, while save/load, history and export keep working against `PathObjectLayer`.
 *
 * Coordinate model (inherited from the pre-Fabric 2D renderer): the layer stores `points`
 * in an UNROTATED local bbox frame (0..width, 0..height), a top-left `x/y`, and a `rotation`
 * applied about the bbox centre. Objects use a centered origin so Fabric's native rotation
 * matches that model.
 */

// Custom property stashed on the Fabric object so a pen path round-trips (and so it can be
// told apart from a `fabric.Path`-backed heart shape, which carries SHAPE_KIND_KEY instead).
export const PATH_ID_KEY = 'pathId'

const RAD_TO_DEG = 180 / Math.PI
const DEG_TO_RAD = Math.PI / 180

type Point = { x: number; y: number }

/** Extract the anchor point (last coordinate pair) from each path command; skips `Z`. */
const anchorsFromPath = (path: any[]): Point[] => {
  const pts: Point[] = []
  for (const seg of path ?? []) {
    if (!Array.isArray(seg) || seg.length < 3) continue // 'Z' or malformed → no anchor
    const x = seg[seg.length - 2]
    const y = seg[seg.length - 1]
    if (typeof x === 'number' && typeof y === 'number') pts.push({ x, y })
  }
  return pts
}

/** Build a `fabric.Path` from a PathObjectLayer, positioned/rotated to match the renderer. */
export const pathLayerToFabricPath = (layer: PathObjectLayer): fabric.Path => {
  const pts = layer.points.length > 0 ? layer.points : [{ x: 0, y: 0 }]
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  return new fabric.Path(d, {
    originX: 'center',
    originY: 'center',
    left: layer.x + layer.width / 2,
    top: layer.y + layer.height / 2,
    angle: layer.rotation * RAD_TO_DEG,
    stroke: layer.strokeColor,
    strokeWidth: layer.strokeWidth,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    strokeUniform: true, // keep stroke width constant while scaling
    // Filling a pen loop (via the fill tool) sets the path's own fill so the colour moves
    // with the stroke; unfilled strokes keep `null` and just draw the outline.
    fill: layer.fillColor ?? null,
    [PATH_ID_KEY]: layer.id,
  } as any)
}

/**
 * Read a `fabric.Path` back into a PathObjectLayer. Works whether the path came from a brush
 * (default origin) or from `pathLayerToFabricPath` (centered origin), and correctly separates
 * rotation from the unrotated bbox by baking scale into the path anchors relative to
 * `pathOffset` (the path-space bbox centre) and recovering the absolute centre via
 * `getCenterPoint()`.
 */
export const fabricPathToLayer = (obj: fabric.Path): PathObjectLayer => {
  const id = (obj as any)[PATH_ID_KEY] as string | undefined
  const scaleX = obj.scaleX ?? 1
  const scaleY = obj.scaleY ?? 1
  const offset = obj.pathOffset ?? { x: 0, y: 0 }

  // Anchor points expressed as scaled offsets from the object centre in the UNROTATED frame.
  const anchors = anchorsFromPath(obj.path as any[])
  const rel = anchors.map((p) => ({
    x: (p.x - offset.x) * scaleX,
    y: (p.y - offset.y) * scaleY,
  }))

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  rel.forEach((p) => {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  })
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0 }

  const width = Math.max(maxX - minX, 1)
  const height = Math.max(maxY - minY, 1)
  // pathOffset is the path bbox centre, so `rel` is centred on the object centre.
  const center = typeof obj.getCenterPoint === 'function'
    ? obj.getCenterPoint()
    : { x: obj.left ?? 0, y: obj.top ?? 0 }
  const x = center.x - width / 2
  const y = center.y - height / 2
  const points = rel.map((p) => ({ x: p.x - minX, y: p.y - minY }))

  return {
    type: 'path',
    id: id ?? `path-${Math.round(x)}-${Math.round(y)}`,
    x,
    y,
    width,
    height,
    rotation: (obj.angle ?? 0) * DEG_TO_RAD,
    strokeColor: typeof obj.stroke === 'string' ? obj.stroke : '#000000',
    strokeWidth: obj.strokeWidth ?? 2,
    fillColor: typeof obj.fill === 'string' ? obj.fill : null,
    points,
  }
}
