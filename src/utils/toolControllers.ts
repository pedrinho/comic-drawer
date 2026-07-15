import * as fabric from 'fabric'
import { Shape, BalloonKind, Tool, Mode } from '../types/common'
import { shapeLayerToFabricObject } from './fabricShapes'
import { textLayerToFabricIText } from './fabricText'
import { balloonLayerToFabricObject } from './fabricBalloon'
import { fabricObjectKind, IMAGE_ID_KEY, IMAGE_DATA_KEY } from './fabricImage'
import { floodFillImageData } from './floodFill'
import { makeWhiteTransparent, imageDataToBase64 } from './canvasUtils'
import { generateLayerId } from './id'

/**
 * Per-tool pointer strategy for the Fabric overlay.
 *
 * Each interaction `Mode` that owns pointer behaviour resolves to one `ToolController`; the render
 * effect wires `mouse:down/move/up` straight to the active controller's methods and calls its
 * `teardown` on tool switch. Modes with no bespoke pointer behaviour (`select`, `pen`) resolve to
 * `null` — `select` lets Fabric handle picking/moving natively and `pen` uses the native brush.
 *
 * Controllers hold their own transient gesture state (the in-flight shape, eraser stroke, or
 * scissor marquee) in closures, so the effect no longer juggles it. Shared services — the canvas,
 * sync/commit callbacks, controls application, the size pill, pointer resolution — arrive via
 * `ToolContext`. Object-management (duplicate/delete/merge/ungroup) and `applyObjectControls`
 * itself remain owned by the effect (Phase 4 moves them out); controllers only receive
 * `applyObjectControls` as a callback.
 */

/** Base shape geometry; the final on-canvas size comes from scaleX/scaleY set during the drag. */
const BASE = 100

interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}

const normalizeRect = (start: { x: number; y: number }, end: { x: number; y: number }): SelectionRect => {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  const width = Math.abs(start.x - end.x)
  const height = Math.abs(start.y - end.y)
  return { x, y, width, height }
}

/** Shared services + current tool params handed to every controller. */
export interface ToolContext {
  canvas: fabric.Canvas
  /** Display px per internal px, used to convert CSS font sizes for placed text. */
  scale: number
  shape: Shape
  balloonKind: BalloonKind
  color: string
  font: string
  fontSize: number
  /** The emoji glyph to place in `text` mode, or null for plain text (which enters editing). */
  placeEmoji: string | null
  /** Raster substrate handles the raster tools paint against. */
  rasterImage: fabric.FabricImage
  rasterBacking: HTMLCanvasElement
  /** Rebuild the layer model from the canvas (one sync = one history entry). */
  syncToLayers: (skipHistory?: boolean) => void
  /** Give a freshly-created object its on-selection controls + mode-gated interactivity. */
  applyObjectControls: (obj: fabric.FabricObject) => void
  /** Live "W × H" pill shown while drag-creating. */
  showSizeLabel: (w: number, h: number, sceneCenterX: number, sceneBottomY: number) => void
  hideSizeLabel: () => void
  /** Push the current raster backing back into panelData (App snapshots history + re-renders). */
  commitRaster: () => void
  /** Scene-space pointer for a Fabric pointer event. */
  getPoint: (opt: any) => { x: number; y: number }
  onToolChange?: (tool: Tool) => void
}

export interface ToolController {
  onDown?(opt: any): void
  onMove?(opt: any): void
  onUp?(): void
}

/**
 * Drag-to-size creation, shared by the shape and balloon tools: press to seed a BASE-sized object
 * at 0.001 scale, drag to grow it via scaleX/scaleY (with the live size pill), release to commit —
 * or discard if the drag was too small to be intentional.
 */
const dragCreateController = (ctx: ToolContext, kind: 'shape' | 'balloon'): ToolController => {
  const { canvas } = ctx
  let creating: { obj: fabric.FabricObject; start: { x: number; y: number } } | null = null
  return {
    onDown(opt) {
      if (opt.target) return // clicking an existing object → let Fabric select/move it
      const p = ctx.getPoint(opt)
      const obj =
        kind === 'shape'
          ? shapeLayerToFabricObject({
              type: 'shape',
              id: generateLayerId(),
              shape: ctx.shape,
              x: p.x,
              y: p.y,
              width: BASE,
              height: BASE,
              rotation: 0,
              strokeColor: ctx.color,
              strokeWidth: 2,
              fillColor: null,
            })
          : balloonLayerToFabricObject({
              type: 'balloon',
              id: generateLayerId(),
              kind: ctx.balloonKind,
              x: p.x,
              y: p.y,
              width: BASE,
              height: BASE,
              rotation: 0,
              text: '',
              font: ctx.font,
              fontSize: ctx.fontSize,
              color: ctx.color,
            })
      obj.set({ scaleX: 0.001, scaleY: 0.001, left: p.x, top: p.y })
      ctx.applyObjectControls(obj)
      canvas.add(obj)
      creating = { obj, start: { x: p.x, y: p.y } }
    },
    onMove(opt) {
      if (!creating) return
      const p = ctx.getPoint(opt)
      const w = Math.max(1, Math.abs(p.x - creating.start.x))
      const h = Math.max(1, Math.abs(p.y - creating.start.y))
      creating.obj.set({
        scaleX: w / BASE,
        scaleY: h / BASE,
        left: (creating.start.x + p.x) / 2,
        top: (creating.start.y + p.y) / 2,
      })
      ctx.showSizeLabel(w, h, (creating.start.x + p.x) / 2, Math.max(creating.start.y, p.y))
      canvas.requestRenderAll()
    },
    onUp() {
      if (!creating) return
      const obj = creating.obj
      const tooSmall = (obj.width ?? 0) * (obj.scaleX ?? 1) < 3 || (obj.height ?? 0) * (obj.scaleY ?? 1) < 3
      creating = null
      if (tooSmall) {
        canvas.remove(obj)
        canvas.requestRenderAll()
        return
      }
      canvas.setActiveObject(obj)
      canvas.requestRenderAll()
      ctx.syncToLayers(false)
    },
  }
}

/**
 * Text / emoji: click to place a fabric.IText. Plain text enters in-place editing immediately;
 * an emoji places its glyph and commits without editing.
 */
const textController = (ctx: ToolContext): ToolController => {
  const { canvas } = ctx
  return {
    onDown(opt) {
      if (opt.target) return // clicking an existing object → let Fabric select/move it
      const p = ctx.getPoint(opt)
      const obj = textLayerToFabricIText(
        {
          type: 'text',
          id: generateLayerId(),
          text: ctx.placeEmoji ?? '',
          x: p.x,
          y: p.y,
          width: 1,
          height: 1,
          rotation: 0,
          font: ctx.font,
          fontSize: ctx.fontSize,
          color: ctx.color,
        },
        ctx.scale
      )
      obj.set({ left: p.x, top: p.y })
      ctx.applyObjectControls(obj)
      canvas.add(obj)
      canvas.setActiveObject(obj)
      if (ctx.placeEmoji) {
        canvas.requestRenderAll()
        ctx.syncToLayers(false)
      } else {
        ;(obj as fabric.IText).enterEditing()
        canvas.requestRenderAll()
      }
    },
  }
}

/**
 * Fill: colour the clicked shape or pen path (or grouped child) by setting the object's own fill,
 * so the colour moves with it; otherwise flood-fill the raster backing.
 */
const fillController = (ctx: ToolContext): ToolController => {
  const { canvas, rasterBacking, rasterImage } = ctx

  // Flood the COMPOSITE scene (so the fill respects ink / grid / shape boundaries), then stamp only
  // the newly-filled pixels onto the raster backing.
  const floodRaster = (x: number, y: number, colorHex: string) => {
    const before = canvas.toCanvasElement(1) as HTMLCanvasElement
    const bctx = before.getContext('2d')
    const backCtx = rasterBacking.getContext('2d')
    if (!bctx || !backCtx) return
    const beforeData = bctx.getImageData(0, 0, before.width, before.height)
    // Flood a copy so `beforeData` stays the pre-fill reference for the diff below.
    bctx.globalCompositeOperation = 'source-over'
    const fillData = bctx.getImageData(0, 0, before.width, before.height)
    floodFillImageData(fillData, Math.round(x), Math.round(y), colorHex)
    const after = fillData.data
    const back = backCtx.getImageData(0, 0, rasterBacking.width, rasterBacking.height)
    const b = beforeData.data
    const d = back.data
    let changed = false
    for (let i = 0; i < after.length; i += 4) {
      if (after[i] !== b[i] || after[i + 1] !== b[i + 1] || after[i + 2] !== b[i + 2] || after[i + 3] !== b[i + 3]) {
        d[i] = after[i] ?? 0
        d[i + 1] = after[i + 1] ?? 0
        d[i + 2] = after[i + 2] ?? 0
        d[i + 3] = 255
        changed = true
      }
    }
    if (!changed) return
    backCtx.putImageData(back, 0, 0)
    rasterImage.dirty = true
    canvas.requestRenderAll()
    ctx.commitRaster()
  }

  return {
    onDown(opt) {
      const target = (opt.subTargets && opt.subTargets[0]) || opt.target
      const targetKind = target && fabricObjectKind(target)
      if (target && (targetKind === 'shape' || targetKind === 'path')) {
        target.set('fill', ctx.color)
        canvas.requestRenderAll()
        ctx.syncToLayers(false)
        return
      }
      const p2 = ctx.getPoint(opt)
      floodRaster(p2.x, p2.y, ctx.color)
    },
  }
}

/** Eraser: wipe a round segment out of the raster backing (destination-out) while dragging. */
const eraserController = (ctx: ToolContext): ToolController => {
  const { canvas, rasterBacking, rasterImage } = ctx
  let erasing: { last: { x: number; y: number } } | null = null

  const eraseSegment = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const c = rasterBacking.getContext('2d')
    if (!c) return
    c.save()
    c.globalCompositeOperation = 'destination-out'
    c.lineWidth = 20
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.beginPath()
    c.moveTo(from.x, from.y)
    c.lineTo(to.x, to.y)
    c.stroke()
    c.restore()
    rasterImage.dirty = true
    canvas.requestRenderAll()
  }

  return {
    onDown(opt) {
      const p = ctx.getPoint(opt)
      erasing = { last: { x: p.x, y: p.y } }
    },
    onMove(opt) {
      if (!erasing) return
      const p = ctx.getPoint(opt)
      eraseSegment(erasing.last, p)
      erasing.last = { x: p.x, y: p.y }
    },
    onUp() {
      if (!erasing) return
      erasing = null
      ctx.commitRaster() // one history entry per stroke (App snapshots the pre-stroke state)
    },
  }
}

/**
 * Scissor: drag a marquee, then lift the enclosed raster pixels into a movable Fabric image
 * (leaving a hole behind) and switch to the select tool.
 */
const scissorController = (ctx: ToolContext): ToolController => {
  const { canvas, rasterBacking, rasterImage } = ctx
  let scissorSel: { start: { x: number; y: number }; rect: fabric.Rect } | null = null
  return {
    onDown(opt) {
      const p = ctx.getPoint(opt)
      const rect = new fabric.Rect({
        left: p.x,
        top: p.y,
        width: 0,
        height: 0,
        originX: 'left',
        originY: 'top',
        fill: 'rgba(0,120,255,0.08)',
        stroke: '#0078ff',
        strokeWidth: 1,
        strokeDashArray: [6, 4],
        selectable: false,
        evented: false,
      })
      canvas.add(rect)
      scissorSel = { start: { x: p.x, y: p.y }, rect }
    },
    onMove(opt) {
      if (!scissorSel) return
      const p = ctx.getPoint(opt)
      const r = normalizeRect(scissorSel.start, p)
      scissorSel.rect.set({ left: r.x, top: r.y, width: r.width, height: r.height })
      canvas.requestRenderAll()
    },
    onUp() {
      if (!scissorSel) return
      const rect = scissorSel.rect
      const rx = Math.round(rect.left ?? 0)
      const ry = Math.round(rect.top ?? 0)
      const rw = Math.round(rect.width ?? 0)
      const rh = Math.round(rect.height ?? 0)
      canvas.remove(rect)
      scissorSel = null
      // Clamp the cut region to the canvas bounds.
      const cx = Math.max(0, rx)
      const cy = Math.max(0, ry)
      const cw = Math.min(rw - (cx - rx), 1200 - cx)
      const ch = Math.min(rh - (cy - ry), 800 - cy)
      if (cw < 5 || ch < 5) {
        canvas.requestRenderAll()
        return
      }
      const backCtx = rasterBacking.getContext('2d')
      if (!backCtx) return
      const region = backCtx.getImageData(cx, cy, cw, ch)
      makeWhiteTransparent(region)
      const base64 = imageDataToBase64(region)
      backCtx.clearRect(cx, cy, cw, ch) // leave a hole where the pixels were lifted
      rasterImage.dirty = true
      // Build the cut-out as a Fabric image SYNCHRONOUSLY (from a backing canvas) and add it to the
      // overlay, so the tool-switch cleanup's syncToLayers preserves it (a layer only in shapeLayers
      // but not on the canvas is lost).
      const cutEl = document.createElement('canvas')
      cutEl.width = cw
      cutEl.height = ch
      cutEl.getContext('2d')?.putImageData(region, 0, 0)
      const img = new fabric.FabricImage(cutEl, {
        originX: 'center',
        originY: 'center',
        left: cx + cw / 2,
        top: cy + ch / 2,
        [IMAGE_ID_KEY]: generateLayerId(),
        [IMAGE_DATA_KEY]: base64,
      })
      ctx.applyObjectControls(img)
      canvas.add(img)
      canvas.setActiveObject(img)
      canvas.requestRenderAll()
      ctx.commitRaster() // snapshots history (pre-cut data + layers) and updates panelData
      ctx.syncToLayers(true) // lift the cut image into shapeLayers (commitRaster already snapshotted)
      ctx.onToolChange?.('select')
    },
  }
}

/**
 * Resolve the pointer strategy for the active `Mode`. Returns `null` for modes with no bespoke
 * pointer behaviour: `select` (Fabric handles picking/moving) and `pen` (native brush). `null`
 * (no Fabric-owned mode) also yields `null`.
 */
export const createToolController = (mode: Mode, ctx: ToolContext): ToolController | null => {
  switch (mode) {
    case 'shape':
      return dragCreateController(ctx, 'shape')
    case 'balloon':
      return dragCreateController(ctx, 'balloon')
    case 'text':
      return textController(ctx)
    case 'fill':
      return fillController(ctx)
    case 'eraser':
      return eraserController(ctx)
    case 'scissor':
      return scissorController(ctx)
    case 'select':
    case 'pen':
    default:
      return null
  }
}
