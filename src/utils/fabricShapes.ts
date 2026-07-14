import * as fabric from 'fabric'
import { Shape } from '../types/common'
import { ShapeObjectLayer } from '../types/layers'

/**
 * Fabric.js migration — shape conversion layer.
 *
 * Maps between the app's data model (`ShapeObjectLayer`) and Fabric.js objects so the
 * `objectShapes` tool can create/select/transform shapes on a Fabric canvas while the
 * rest of the app (save/load `.cd` files, history) keeps working against `ShapeObjectLayer`.
 *
 * Geometry mirrors `traceShapePath` in `canvasUtils.ts`. All objects use a centered origin
 * so Fabric's native rotation matches the legacy 2D renderer (which rotated around the center).
 */

// Custom properties we stash on Fabric objects to round-trip back to a ShapeObjectLayer.
export const SHAPE_ID_KEY = 'shapeId'
export const SHAPE_KIND_KEY = 'shapeKind'
// The intended bounding box (the drag rect). Polygonal shapes don't fill their box, and
// fabric.Polygon collapses width/height to the points' natural extent — so we keep the
// intended box here to preserve it across save/load round-trips.
export const SHAPE_BOX_W_KEY = 'shapeBoxW'
export const SHAPE_BOX_H_KEY = 'shapeBoxH'

const RAD_TO_DEG = 180 / Math.PI
const DEG_TO_RAD = Math.PI / 180

type Point = { x: number; y: number }

/**
 * Points for polygonal shapes in local bbox coordinates (0..width, 0..height).
 * Mirrors the non-curve branches of `traceShapePath`. Returns null for shapes that are
 * not polygons (rectangle, circle, heart) — those are built as dedicated Fabric types.
 */
export const computeShapePoints = (shape: Shape, width: number, height: number): Point[] | null => {
  const w = width
  const h = height
  const cx = w / 2
  const cy = h / 2
  const rx = w / 2
  const ry = h / 2
  const minR = Math.min(rx, ry)

  switch (shape) {
    case 'triangle':
      return [{ x: cx, y: 0 }, { x: 0, y: h }, { x: w, y: h }]
    case 'diamond':
      return [{ x: cx, y: 0 }, { x: w, y: cy }, { x: cx, y: h }, { x: 0, y: cy }]
    case 'star': {
      const spikes = 5
      const outer = minR
      const inner = outer * 0.5
      const pts: Point[] = []
      for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outer : inner
        const angle = (i * Math.PI) / spikes - Math.PI / 2
        pts.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })
      }
      return pts
    }
    case 'hexagon': {
      const pts: Point[] = []
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3
        pts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) })
      }
      return pts
    }
    case 'pentagon': {
      const pts: Point[] = []
      for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2
        pts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) })
      }
      return pts
    }
    case 'heptagon': {
      const pts: Point[] = []
      for (let i = 0; i < 7; i++) {
        const angle = (i * 2 * Math.PI) / 7 - Math.PI / 2
        pts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) })
      }
      return pts
    }
    case 'octagon': {
      const pts: Point[] = []
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4
        pts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) })
      }
      return pts
    }
    case 'arrow': {
      const notch = w - rx * 0.3
      return [
        { x: 0, y: cy },
        { x: notch, y: cy },
        { x: notch, y: 0 },
        { x: w, y: cy },
        { x: notch, y: h },
        { x: notch, y: cy },
      ]
    }
    case 'cross': {
      const arm = minR * 0.2
      return [
        { x: cx - arm, y: 0 },
        { x: cx + arm, y: 0 },
        { x: cx + arm, y: cy - arm },
        { x: w, y: cy - arm },
        { x: w, y: cy + arm },
        { x: cx + arm, y: cy + arm },
        { x: cx + arm, y: h },
        { x: cx - arm, y: h },
        { x: cx - arm, y: cy + arm },
        { x: 0, y: cy + arm },
        { x: 0, y: cy - arm },
        { x: cx - arm, y: cy - arm },
      ]
    }
    default:
      return null
  }
}

/** SVG path data for the heart, mirroring the bezier curves in `traceShapePath`. */
const heartPathData = (width: number, height: number): string => {
  const cx = width / 2
  const cy = height / 2
  const s = Math.min(width, height) / 2
  return [
    `M ${cx} ${cy}`,
    `C ${cx} ${cy - s * 0.25}, ${cx - s * 0.25} ${cy - s * 0.5}, ${cx - s * 0.5} ${cy - s * 0.5}`,
    `C ${cx - s * 0.75} ${cy - s * 0.5}, ${cx - s * 0.75} ${cy}, ${cx - s * 0.5} ${cy + s * 0.25}`,
    `C ${cx - s * 0.25} ${cy + s * 0.5}, ${cx} ${cy + s * 0.6}, ${cx} ${cy + s * 0.6}`,
    `C ${cx} ${cy + s * 0.6}, ${cx + s * 0.25} ${cy + s * 0.5}, ${cx + s * 0.5} ${cy + s * 0.25}`,
    `C ${cx + s * 0.75} ${cy}, ${cx + s * 0.75} ${cy - s * 0.5}, ${cx + s * 0.5} ${cy - s * 0.5}`,
    `C ${cx + s * 0.25} ${cy - s * 0.5}, ${cx} ${cy - s * 0.25}, ${cx} ${cy}`,
    'Z',
  ].join(' ')
}

const commonProps = (layer: ShapeObjectLayer): Partial<fabric.FabricObject> => ({
  originX: 'center',
  originY: 'center',
  left: layer.x + layer.width / 2,
  top: layer.y + layer.height / 2,
  angle: layer.rotation * RAD_TO_DEG,
  stroke: layer.strokeColor,
  strokeWidth: layer.strokeWidth,
  strokeUniform: true, // keep stroke width constant while scaling
  fill: layer.fillColor ?? 'transparent',
})

/**
 * Build a Fabric object from a ShapeObjectLayer. The returned object carries the layer's
 * id and shape kind as custom props so it can be round-tripped back via
 * `fabricObjectToShapeLayer`.
 */
export const shapeLayerToFabricObject = (layer: ShapeObjectLayer): fabric.FabricObject => {
  const { shape, width, height } = layer
  const base = commonProps(layer)
  const meta = {
    [SHAPE_ID_KEY]: layer.id,
    [SHAPE_KIND_KEY]: shape,
    [SHAPE_BOX_W_KEY]: width,
    [SHAPE_BOX_H_KEY]: height,
  }

  if (shape === 'rectangle') {
    return new fabric.Rect({ ...base, width, height, ...meta })
  }

  if (shape === 'circle') {
    return new fabric.Ellipse({ ...base, rx: width / 2, ry: height / 2, ...meta })
  }

  if (shape === 'heart') {
    // fabric.Path derives its own bbox from the path data; the path already spans
    // width×height, so it lines up with the layer bounds.
    return new fabric.Path(heartPathData(width, height), { ...base, ...meta })
  }

  const points = computeShapePoints(shape, width, height)
  if (points) {
    return new fabric.Polygon(points, { ...base, ...meta })
  }

  // Fallback: treat unknown kinds as a rectangle so nothing is silently dropped.
  return new fabric.Rect({ ...base, width, height, ...meta })
}

/**
 * Read a Fabric object back into a ShapeObjectLayer. Recovers the bounding box, rotation,
 * and style; the shape kind and id come from the custom props set at creation time.
 */
export const fabricObjectToShapeLayer = (obj: fabric.FabricObject): ShapeObjectLayer => {
  const kind = (obj as any)[SHAPE_KIND_KEY] as Shape | undefined
  const id = (obj as any)[SHAPE_ID_KEY] as string | undefined

  // Prefer the stored intended box (drag rect) over the object's natural extent, so
  // polygonal shapes keep their box across round-trips. Fall back to the object's own
  // dimensions for objects created outside this module.
  const boxW = (obj as any)[SHAPE_BOX_W_KEY] as number | undefined
  const boxH = (obj as any)[SHAPE_BOX_H_KEY] as number | undefined
  const width = (boxW ?? obj.width ?? 0) * (obj.scaleX ?? 1)
  const height = (boxH ?? obj.height ?? 0) * (obj.scaleY ?? 1)
  // Objects use a centered origin, so left/top is the center point.
  const x = (obj.left ?? 0) - width / 2
  const y = (obj.top ?? 0) - height / 2

  const fill = obj.fill
  const fillColor = typeof fill === 'string' && fill !== 'transparent' ? fill : null

  return {
    type: 'shape',
    id: id ?? `shape-${Math.round(x)}-${Math.round(y)}`,
    shape: kind ?? 'rectangle',
    x,
    y,
    width,
    height,
    rotation: (obj.angle ?? 0) * DEG_TO_RAD,
    strokeColor: typeof obj.stroke === 'string' ? obj.stroke : '#000000',
    strokeWidth: obj.strokeWidth ?? 2,
    fillColor,
  }
}
