import * as fabric from 'fabric'
import { EraserBrush } from '@erase2d/fabric'
import { EraserSize } from '../types/common'
import { isChromeObject } from './fabricRaster'
import { commitEraseStroke, isFullyErased } from './fabricErase'

/**
 * The eraser tool: erase2d's `EraserBrush` as the canvas's free-drawing brush (like the pen's
 * PencilBrush), giving a live, selective erase preview while dragging. On release we commit the
 * stroke ourselves instead of letting erase2d do it:
 *  - every object it crossed gets the stroke in its own persisted mask (`fabricErase.ts`), so it
 *    stays a movable object with a hole that travels with it;
 *  - the raster substrate gets its pixels really erased (it's persisted as ImageData, not a mask);
 *  - an object erased down to nothing is deleted, so no invisible-but-grabbable object remains;
 *  - then ONE history entry for the whole stroke (`commitRaster` snapshots the pre-stroke panel —
 *    raster AND layers — and the layer sync skips history).
 */

/** Eraser diameter in canvas units for each size in the picker. */
export const ERASER_WIDTHS: Record<EraserSize, number> = { small: 10, medium: 20, large: 40 }

export interface EraserToolOptions {
  canvas: fabric.Canvas
  /** Eraser diameter, canvas units. */
  width: number
  /** Display px per canvas unit — sizes the circle cursor to what the eraser will cover. */
  displayScale: number
  rasterImage: fabric.FabricImage
  rasterBacking: HTMLCanvasElement
  /** Push the raster backing into panelData; App snapshots history from the pre-stroke panel. */
  commitRaster: () => void
  /** Rebuild the layer model from the canvas. */
  syncToLayers: (skipHistory?: boolean) => void
}

/** Rub `path` (canvas plane) out of the raster backing's pixels. */
const eraseRasterPixels = (backing: HTMLCanvasElement, path: fabric.Path) => {
  const c = backing.getContext('2d')
  if (!c) return
  c.save()
  c.globalCompositeOperation = 'destination-out'
  path.render(c) // the brush path is itself destination-out; the canvas plane maps 1:1 onto the backing
  c.restore()
}

/** Apply one finished eraser stroke to the raster and to every object it crossed. */
export const commitErase = (
  { canvas, rasterImage, rasterBacking, commitRaster, syncToLayers }: EraserToolOptions,
  path: fabric.Path,
  targets: fabric.FabricObject[]
): void => {
  eraseRasterPixels(rasterBacking, path)
  rasterImage.set('dirty', true)
  const objects = targets.filter((o) => o !== rasterImage && !isChromeObject(o))
  objects.forEach((o) => commitEraseStroke(o, path))
  objects.filter((o) => isFullyErased(o)).forEach((o) => canvas.remove(o))
  canvas.requestRenderAll()
  commitRaster()
  if (objects.length) syncToLayers(true)
}

/** A CSS cursor: a ring the size of the eraser (display px), centred on the pointer. */
export const eraserCursor = (diameterPx: number): string => {
  const d = Math.max(6, Math.min(120, Math.round(diameterPx)))
  const size = d + 4
  const c = size / 2
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>` +
    `<circle cx='${c}' cy='${c}' r='${d / 2}' fill='rgba(255,255,255,0.35)' stroke='black' stroke-width='1'/>` +
    `<circle cx='${c}' cy='${c}' r='${d / 2 - 1}' fill='none' stroke='white' stroke-width='1'/>` +
    `</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${c} ${c}, crosshair`
}

/**
 * Make the eraser the canvas's free-drawing brush (the caller turns `isDrawingMode` on). Returns a
 * disposer that unhooks it and restores the previous cursor.
 */
export const installEraser = (opts: EraserToolOptions): (() => void) => {
  const { canvas, width, displayScale, rasterImage } = opts
  const brush = new EraserBrush(canvas)
  brush.width = width
  canvas.freeDrawingBrush = brush
  const prevCursor = canvas.freeDrawingCursor
  canvas.freeDrawingCursor = eraserCursor(width * displayScale)

  // Everything visible is erasable except the grid (non-erasable objects are redrawn over the stroke
  // by the preview, so panel borders stay crisp). Marked at stroke start so async-loaded objects
  // (images, groups) are included.
  const markErasable = () =>
    canvas.getObjects().forEach((o) => {
      o.erasable = o === rasterImage || !isChromeObject(o)
    })
  const offStart = brush.on('start', markErasable)
  const offEnd = brush.on('end', (e) => {
    e.preventDefault() // we commit (see commitErase) instead of erase2d's default
    commitErase(opts, e.detail.path, e.detail.targets)
  })

  return () => {
    offStart()
    offEnd()
    brush.dispose()
    canvas.freeDrawingCursor = prevCursor
  }
}
