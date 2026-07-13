import * as fabric from 'fabric'

/**
 * Fabric.js migration — raster substrate + grid "chrome".
 *
 * In the single-canvas end state the Fabric overlay is the only canvas, so the per-panel
 * raster bitmap (`panelData`) and the panel grid must live on it too. This module builds them
 * as non-interactive Fabric objects that sit at the BACK of the stack, beneath every vector
 * object:
 *   - the raster substrate is a `fabric.Image` backed by an offscreen canvas the raster tools
 *     (eraser / fill fallback / scissor) paint on directly;
 *   - the grid is one non-evented `fabric.Rect` per panel cell.
 *
 * Both are tagged so the sync-back logic can tell them apart from real object layers and skip
 * them (`isChromeObject`).
 */

export const RASTER_KEY = 'isRaster'
export const GRID_KEY = 'isGrid'

const CANVAS_W = 1200
const CANVAS_H = 800
const GUTTER = 12 // mirrors drawGrid in canvasUtils.ts

type Cell = { x: number; y: number; w: number; h: number }

/** Compute the grid cell rectangles for a layout — mirrors the geometry in `drawGrid`. */
export const computeGridCells = (
  layout: { rows: number; columns: number[] },
  canvasWidth: number = CANVAS_W,
  canvasHeight: number = CANVAS_H
): Cell[] => {
  const cells: Cell[] = []
  const totalRows = layout.rows
  for (let row = 0; row < totalRows; row++) {
    const columnsInRow = layout.columns[row] || 1
    const totalVerticalGutters = GUTTER * 2 + (totalRows - 1) * GUTTER
    const totalHorizontalGutters = GUTTER * 2 + (columnsInRow - 1) * GUTTER
    const panelHeight = (canvasHeight - totalVerticalGutters) / totalRows
    const panelWidth = (canvasWidth - totalHorizontalGutters) / columnsInRow
    let currentX = GUTTER
    const currentY = GUTTER + row * (panelHeight + GUTTER)
    for (let col = 0; col < columnsInRow; col++) {
      cells.push({ x: currentX, y: currentY, w: panelWidth, h: panelHeight })
      currentX += panelWidth + GUTTER
    }
  }
  return cells
}

/**
 * Build the bottom raster layer from panelData. Returns the Fabric image AND its backing
 * canvas — the raster tools paint on the backing ctx, then set `image.dirty = true` and
 * re-render. Undrawn areas stay transparent so the white page shows through erasures.
 */
export const buildRasterImage = (
  panelData: ImageData | null
): { image: fabric.FabricImage; backing: HTMLCanvasElement } => {
  const backing = document.createElement('canvas')
  backing.width = CANVAS_W
  backing.height = CANVAS_H
  if (panelData) {
    const ctx = backing.getContext('2d')
    ctx?.putImageData(panelData, 0, 0)
  }
  const image = new fabric.FabricImage(backing, {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    selectable: false,
    evented: false,
    hasControls: false,
    hoverCursor: 'default',
    [RASTER_KEY]: true,
  } as any)
  return { image, backing }
}

/** Build the panel grid as non-interactive Fabric rects (one per cell). */
export const buildGridObjects = (layout: { rows: number; columns: number[] }): fabric.Object[] =>
  computeGridCells(layout).map(
    (c) =>
      new fabric.Rect({
        left: c.x,
        top: c.y,
        width: c.w,
        height: c.h,
        originX: 'left',
        originY: 'top',
        fill: 'transparent',
        stroke: '#000000',
        strokeWidth: 3,
        selectable: false,
        evented: false,
        hoverCursor: 'default',
        [GRID_KEY]: true,
      } as any)
  )

/** Read the current pixels of a backing canvas back into an ImageData (for onCanvasChange). */
export const backingToImageData = (backing: HTMLCanvasElement): ImageData => {
  const ctx = backing.getContext('2d')
  if (!ctx) throw new Error('backing canvas has no 2d context')
  return ctx.getImageData(0, 0, backing.width, backing.height)
}

/** True for the raster substrate or grid rects — the non-layer "chrome" on the overlay. */
export const isChromeObject = (obj: fabric.Object): boolean =>
  Boolean((obj as any)[RASTER_KEY]) || Boolean((obj as any)[GRID_KEY])
