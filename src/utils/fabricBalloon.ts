import * as fabric from 'fabric'
import { BalloonObjectLayer } from '../types/layers'

/**
 * Fabric.js migration — balloon conversion layer (read-only / deprecated).
 *
 * Speech balloons were removed from the toolbar but old comics still contain
 * `BalloonObjectLayer`s, so once the legacy canvas is gone they still need to render (on the
 * overlay and in export) and stay movable/deletable. This builds a `fabric.Group` of the
 * balloon outline (a single continuous path: ellipse + tail, mirroring `renderBalloonLayer`)
 * plus the caption `fabric.IText`. Balloons are not creatable — there is only a builder and a
 * transform-aware read-back; the caption is not editable in place.
 */

export const BALLOON_ID_KEY = 'balloonId'
const BALLOON_LAYER_KEY = 'balloonLayer' // original layer (text/font/size), stashed for read-back
const BALLOON_BC_KEY = 'balloonBboxCenter' // children-bbox centre in local coords (tail offset)

const RAD_TO_DEG = 180 / Math.PI
const DEG_TO_RAD = Math.PI / 180

/**
 * SVG path data for the balloon outline in local coordinates centred on the ellipse centre
 * (0,0) — mirrors the ellipse-arc + quadratic-tail path in `renderBalloonLayer`. The ellipse
 * is sampled the same direction the canvas draws it (the long way, over the top) so the tail
 * gap sits at the bottom.
 */
const balloonPathData = (width: number, height: number): string => {
  const rx = width / 2
  const ry = height / 2
  const angleRight = Math.PI / 2 - 0.3
  const angleLeft = Math.PI / 2 + 0.3
  const brX = rx * Math.cos(angleRight)
  const brY = ry * Math.sin(angleRight)
  const blX = rx * Math.cos(angleLeft)
  const tailTipX = -rx * 0.3
  const tailTipY = ry * 1.3

  const STEPS = 64
  const sweep = 2 * Math.PI - 0.6 // from angleRight around the top to angleLeft
  const cmds: string[] = [`M ${brX} ${brY}`]
  for (let i = 1; i <= STEPS; i++) {
    const a = angleRight - (sweep * i) / STEPS // decreasing angle = the long way (canvas ccw)
    cmds.push(`L ${rx * Math.cos(a)} ${ry * Math.sin(a)}`)
  }
  // Tail: baseLeft → tip → baseRight, matching the two quadraticCurveTo calls.
  cmds.push(`Q ${blX - 10} ${ry + 20} ${tailTipX} ${tailTipY}`)
  cmds.push(`Q ${brX - 5} ${ry + 10} ${brX} ${brY}`)
  cmds.push('Z')
  return cmds.join(' ')
}

/**
 * Build a `fabric.Group` from a BalloonObjectLayer, placed so the ELLIPSE centre sits at the
 * balloon centre (tail hanging below), matching the renderer. `scale` converts the CSS font
 * size to canvas-internal units, like the text converter.
 */
export const balloonLayerToFabricObject = (layer: BalloonObjectLayer, scale: number): fabric.Group => {
  const outline = new fabric.Path(balloonPathData(layer.width, layer.height), {
    fill: 'white',
    stroke: layer.color,
    strokeWidth: 3,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
  })
  const caption = new fabric.IText(layer.text ?? '', {
    originX: 'center',
    originY: 'center',
    left: 0,
    top: 0,
    fontSize: layer.fontSize / scale,
    fontFamily: layer.font,
    fill: layer.color,
    textAlign: 'center',
    editable: false,
  })

  const group = new fabric.Group([outline, caption], { originX: 'center', originY: 'center' })
  // Children-bbox centre in local coords (below the ellipse centre because of the tail).
  const bc = group.getCenterPoint()

  const cx = layer.x + layer.width / 2
  const cy = layer.y + layer.height / 2
  const theta = layer.rotation
  // Position so local (0,0) — the ellipse centre — lands on (cx, cy): P = C + R(theta)·bc.
  group.set({
    angle: layer.rotation * RAD_TO_DEG,
    left: cx + (bc.x * Math.cos(theta) - bc.y * Math.sin(theta)),
    top: cy + (bc.x * Math.sin(theta) + bc.y * Math.cos(theta)),
    [BALLOON_ID_KEY]: layer.id,
    [BALLOON_LAYER_KEY]: layer,
    [BALLOON_BC_KEY]: { x: bc.x, y: bc.y },
  } as any)
  group.setCoords()
  return group
}

/** True if a Fabric object is a converted balloon group. */
export const isFabricBalloon = (obj: fabric.Object): boolean => Boolean((obj as any)[BALLOON_ID_KEY])

/**
 * Read a balloon group back into a BalloonObjectLayer after a move/rotate/resize. Recovers the
 * ellipse-centre position from the group centre minus the (scaled, rotated) tail offset, and
 * keeps the caption text/font from the stashed original layer.
 */
export const fabricBalloonToLayer = (group: fabric.Group): BalloonObjectLayer => {
  const orig = (group as any)[BALLOON_LAYER_KEY] as BalloonObjectLayer | undefined
  const bc = ((group as any)[BALLOON_BC_KEY] as { x: number; y: number } | undefined) ?? { x: 0, y: 0 }
  const sx = group.scaleX ?? 1
  const sy = group.scaleY ?? 1
  const theta = (group.angle ?? 0) * DEG_TO_RAD
  const P = typeof group.getCenterPoint === 'function' ? group.getCenterPoint() : { x: group.left ?? 0, y: group.top ?? 0 }

  // C = P − R(theta)·(scaled bbox-centre offset).
  const ox = bc.x * sx
  const oy = bc.y * sy
  const cx = P.x - (ox * Math.cos(theta) - oy * Math.sin(theta))
  const cy = P.y - (ox * Math.sin(theta) + oy * Math.cos(theta))

  const width = (orig?.width ?? group.width ?? 1) * sx
  const height = (orig?.height ?? group.height ?? 1) * sy

  return {
    type: 'balloon',
    id: ((group as any)[BALLOON_ID_KEY] as string | undefined) ?? orig?.id ?? `balloon-${Math.round(cx)}-${Math.round(cy)}`,
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
    rotation: theta,
    text: orig?.text ?? '',
    font: orig?.font ?? 'Arial',
    fontSize: orig?.fontSize ?? 24,
    color: orig?.color ?? '#000000',
  }
}
