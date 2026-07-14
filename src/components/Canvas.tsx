import { useEffect, useRef, useCallback } from 'react'
import * as fabric from 'fabric'
import { Tool, Shape, PenType, BalloonKind } from '../types/common'
import { TextLayer, ObjectLayer, GroupObjectLayer, isPathObjectLayer, isShapeObjectLayer, isImageObjectLayer, isBalloonObjectLayer, isGroupObjectLayer } from '../types/layers'
import { debugLog, imageDataToBase64, makeWhiteTransparent } from '../utils/canvasUtils'
import { shapeLayerToFabricObject, fabricObjectToShapeLayer } from '../utils/fabricShapes'
import { textLayerToFabricIText, fabricITextToTextLayer } from '../utils/fabricText'
import { imageLayerToFabricImage, fabricImageToLayer, fabricObjectKind, IMAGE_ID_KEY, IMAGE_DATA_KEY } from '../utils/fabricImage'
import { layerToFabricGroup, fabricGroupToLayer } from '../utils/fabricGroup'
import { pathLayerToFabricPath, fabricPathToLayer, PATH_ID_KEY } from '../utils/fabricPath'
import { buildRasterImage, buildGridObjects, backingToImageData, isChromeObject } from '../utils/fabricRaster'
import { balloonLayerToFabricObject, fabricBalloonToLayer, isFabricBalloon } from '../utils/fabricBalloon'
import './Canvas.css'

interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}


interface CanvasProps {
  tool: Tool
  shape?: Shape
  penType?: PenType
  color: string
  font: string
  fontSize: number
  panelData: ImageData | null
  layout: { rows: number; columns: number[] }
  onCanvasChange: (data: ImageData) => void
  shapeLayers?: ObjectLayer[]
  onShapeLayersChange?: (layers: ObjectLayer[], skipHistory?: boolean) => void
  textLayers?: TextLayer[]
  onTextLayersChange?: (layers: TextLayer[], skipHistory?: boolean) => void
  onTextEditingChange?: (isEditing: boolean) => void
  onToolChange?: (tool: Tool) => void // Added to allow switching tools
  emoji?: string
  balloonKind?: BalloonKind
}

const getPenWidth = (penType?: PenType): number => {
  if (!penType) return 2
  switch (penType) {
    case 'fine': return 1
    case 'small': return 2
    case 'medium': return 4
    case 'large': return 6
    case 'thick': return 8
    case 'verythick': return 12
    default: return 2
  }
}

const normalizeRect = (start: { x: number; y: number }, end: { x: number; y: number }): SelectionRect => {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  const width = Math.abs(start.x - end.x)
  const height = Math.abs(start.y - end.y)
  return { x, y, width, height }
}











export default function Canvas({
  tool,
  shape,
  penType,
  color,
  font,
  fontSize,
  panelData,
  layout,
  onCanvasChange,
  shapeLayers = [],
  onShapeLayersChange,
  textLayers = [],
  onTextLayersChange,
  onTextEditingChange,
  onToolChange, // Destructure new prop
  emoji = '😀',
  balloonKind = 'speech',
}: CanvasProps) {

  // These mirror the layer props but are updated DURING RENDER (below) so the overlay effect
  // always reads the current model — including a value `syncToLayers` writes synchronously in
  // the effect cleanup (committing an in-progress text edit), which the props wouldn't reflect
  // until a later render that wouldn't re-run the effect.
  const shapeLayersRef = useRef<ObjectLayer[]>(shapeLayers)
  const textLayersRef = useRef<TextLayer[]>(textLayers)
  shapeLayersRef.current = shapeLayers
  textLayersRef.current = textLayers

  // Fabric.js Refs
  const fabricRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
  // Wraps the Fabric canvas; the overlay's CSS size is fitted into this box (the old sizing
  // anchor was the now-removed legacy canvas).
  const containerRef = useRef<HTMLDivElement>(null)
  // Live "W × H" pill shown while drawing or resizing an object. Mutated imperatively
  // (not React state) so per-mousemove updates never re-render or re-run this effect.
  const sizeLabelRef = useRef<HTMLDivElement>(null)

  // Fit the 1200x800 canvas into the container at a 3:2 aspect ratio; returns the display size
  // and the scale (display px per internal px), used both to size the overlay and to convert
  // CSS font sizes. Falls back to 1:1 when the container isn't measurable (e.g. jsdom).
  const fitCanvasToContainer = (): { width: number; height: number; scale: number } => {
    const box = containerRef.current
    const cw = box?.clientWidth ?? 0
    const ch = box?.clientHeight ?? 0
    if (!cw || !ch) return { width: 1200, height: 800, scale: 1 }
    const scale = Math.min(cw / 1200, ch / 800)
    return { width: 1200 * scale, height: 800 * scale, scale }
  }
  // The set of layer types currently owned by the Fabric overlay (rendered/edited there
  // instead of on the legacy canvas). Populated while a Fabric-owned tool is active:
  // objectShapes → {shape}, text/emoji → {text}, select → {shape, text, image}.
  const fabricOwnedRef = useRef<Set<ObjectLayer['type']>>(new Set())

  // Initialize Fabric Canvas
  useEffect(() => {
    if (!fabricRef.current) return

    // Dispose if already exists
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose()
    }

    const canvas = new fabric.Canvas(fabricRef.current, {
      width: 1200,
      height: 800,
      selection: true, // Enable selection for Fabric objects
      renderOnAddRemove: true,
    })

    fabricCanvasRef.current = canvas
    debugLog('Canvas', 'Fabric.js initialized')

    return () => {
      canvas.dispose()
      fabricCanvasRef.current = null
    }
  }, [])

  // Keep the Fabric overlay's CSS size matched to the (fluidly-scaled) legacy canvas at all
  // times — in every tool, and on any window/layout resize. Without this the overlay only
  // resized while a Fabric tool was active, so resizing in pen/eraser mode left it mismatched
  // (its edge sticking out past the legacy canvas corner).
  useEffect(() => {
    const box = containerRef.current
    if (!box) return
    const sync = () => {
      const fc = fabricCanvasRef.current
      if (!fc) return
      const { width, height } = fitCanvasToContainer()
      if (width && height) fc.setDimensions({ width, height }, { cssOnly: true })
    }
    sync()
    // ResizeObserver isn't available in jsdom (tests) — fall back to the window resize listener.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null
    ro?.observe(box)
    window.addEventListener('resize', sync)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [])







  // Helper function to get background ImageData without layers
  // This ensures we don't save layers into the ImageData




  const floodFill = (ctx: CanvasRenderingContext2D, x: number, y: number, fillColor: string) => {
    // Ensure we're using source-over for fill
    ctx.globalCompositeOperation = 'source-over'

    const canvas = ctx.canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    const width = canvas.width
    const height = canvas.height

    // Get target color at the clicked point
    const clickedIndex = (Math.floor(y) * width + Math.floor(x)) * 4
    const targetR = data[clickedIndex]
    const targetG = data[clickedIndex + 1]
    const targetB = data[clickedIndex + 2]
    const targetA = data[clickedIndex + 3]

    // Check if target color is valid
    if (targetR === undefined || targetG === undefined || targetB === undefined || targetA === undefined) {
      return
    }

    // Parse fill color
    const fillR = parseInt(fillColor.slice(1, 3), 16)
    const fillG = parseInt(fillColor.slice(3, 5), 16)
    const fillB = parseInt(fillColor.slice(5, 7), 16)

    // Helper function to check if a pixel matches the target color (including alpha for erased areas)
    const matchesTargetColor = (r: number | undefined, g: number | undefined, b: number | undefined, a: number | undefined) => {
      if (r === undefined || g === undefined || b === undefined || a === undefined) {
        return false
      }
      const tolerance = 10 // Allow small differences for antialiasing
      const alphaTolerance = 5 // Tolerance for alpha channel

      // If target is transparent (erased), match transparent pixels
      if (targetA < alphaTolerance) {
        return a < alphaTolerance
      }

      // If target is opaque, match RGB values and ensure alpha is similar
      return Math.abs(r - targetR) <= tolerance &&
        Math.abs(g - targetG) <= tolerance &&
        Math.abs(b - targetB) <= tolerance &&
        Math.abs(a - targetA) <= alphaTolerance
    }

    // Stack-based flood fill
    const stack: Array<[number, number]> = [[Math.floor(x), Math.floor(y)]]
    const visited = new Set<string>()

    while (stack.length > 0) {
      const [px, py] = stack.pop()!
      const key = `${px},${py}`

      if (visited.has(key) || px < 0 || px >= width || py < 0 || py >= height) {
        continue
      }

      visited.add(key)

      const index = (py * width + px) * 4
      const r = data[index]
      const g = data[index + 1]
      const b = data[index + 2]
      const a = data[index + 3]

      // Fill pixels that match the target color (where we clicked)
      if (r !== undefined && g !== undefined && b !== undefined && a !== undefined && matchesTargetColor(r, g, b, a)) {
        // Fill this pixel
        data[index] = fillR
        data[index + 1] = fillG
        data[index + 2] = fillB
        data[index + 3] = 255 // Set alpha to opaque

        // Add neighbors to stack
        stack.push([px + 1, py])
        stack.push([px - 1, py])
        stack.push([px, py + 1])
        stack.push([px, py - 1])
      }
    }

    // Put the modified image data back
    ctx.putImageData(imageData, 0, 0)
  }






  const updateShapeLayers = useCallback((layers: ObjectLayer[], skipHistory = false) => {
    debugLog('Canvas', 'Updating shape layers', { layerCount: layers.length, skipHistory })
    shapeLayersRef.current = layers
    if (onShapeLayersChange) {
      onShapeLayersChange(layers, skipHistory)
    }
  }, [onShapeLayersChange])

  const updateTextLayers = useCallback((layers: TextLayer[], skipHistory = false) => {
    debugLog('Canvas', 'Updating text layers', { layerCount: layers.length, skipHistory })
    textLayersRef.current = layers
    if (onTextLayersChange) {
      onTextLayersChange(layers, skipHistory)
    }
  }, [onTextLayersChange])

  const generateLayerId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  // Fabric.js object mode: while a Fabric-owned tool is active — objectShapes → shapes,
  // text/emoji → text, select → all object types — those objects are created, selected,
  // moved, resized and rotated on the Fabric overlay canvas (which gives us all of that
  // machinery for free), then synced back into the layer model so save/load and the rest of
  // the app keep working. The raster tools (pen/eraser/fill/scissor) keep using the legacy
  // canvas.
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    // Emoji is handled as text mode: it places a fabric.IText holding the emoji character.
    const mode: 'shape' | 'balloon' | 'text' | 'select' | 'fill' | 'pen' | 'eraser' | 'scissor' | null =
      tool === 'objectShapes'
        ? 'shape'
        : tool === 'balloon'
          ? 'balloon'
          : tool === 'text' || tool === 'emoji'
            ? 'text'
            : tool === 'select'
              ? 'select'
              : tool === 'fill'
                ? 'fill'
                : tool === 'pen'
                  ? 'pen'
                  : tool === 'eraser'
                    ? 'eraser'
                    : tool === 'scissor'
                      ? 'scissor'
                      : null
    const placeEmoji = tool === 'emoji' ? emoji ?? '😀' : null
    const isCreationMode = mode === 'shape' || mode === 'balloon' || mode === 'text'
    let disposed = false // guards async image loads against a stale canvas after cleanup

    // Keep the Fabric overlay's CSS size aligned with the (scaled) legacy canvas so their
    // coordinate spaces line up. Internal resolution stays 1200x800 for both.
    const sizeOverlay = () => {
      const { width, height } = fitCanvasToContainer()
      if (width && height) {
        canvas.setDimensions({ width, height }, { cssOnly: true })
      }
    }
    sizeOverlay()

    // Display scale used to convert TextObjectLayer CSS font sizes to canvas-internal units.
    // Defaults to 1 when the container isn't measurable (e.g. jsdom).
    const computeScale = () => fitCanvasToContainer().scale

    const currentShape = shape ?? 'rectangle'
    const currentBalloonKind = balloonKind ?? 'speech'
    const currentColor = color
    const currentFont = font
    const currentFontSize = fontSize
    const scale = computeScale()
    const BASE = 100 // base shape geometry; final size comes from scaleX/scaleY

    // select allows picking/moving existing objects; creation modes disable rubber-band so
    // an empty-canvas drag/click creates a new object instead of starting a selection box.
    canvas.selection = mode === 'select'
    // Pen draws with a native brush; every other mode has drawing off.
    canvas.isDrawingMode = mode === 'pen'
    if (mode === 'pen') {
      const brush = new fabric.PencilBrush(canvas)
      brush.color = currentColor
      brush.width = getPenWidth(penType)
      canvas.freeDrawingBrush = brush
    }

    // Single canvas: the overlay renders the WHOLE scene — white page + raster substrate + grid
    // (chrome, at the back) + every vector object on top. The legacy canvas renders nothing.
    // Interactivity is gated per-mode by applyObjectControls; the raster tools (eraser / fill
    // fallback / scissor) paint on `rasterBacking` and re-render `rasterImage`.
    canvas.backgroundColor = '#ffffff'
    canvas.getObjects().slice().forEach((o) => canvas.remove(o))
    const { image: rasterImage, backing: rasterBacking } = buildRasterImage(panelData)
    canvas.add(rasterImage)
    buildGridObjects(layout).forEach((g) => canvas.add(g))

    // Load from the render-synced refs (== current props, plus any value the cleanup just
    // wrote when committing an in-progress text edit). shapeLayers/textLayers stay OUT of the
    // effect deps so our own live edits don't trigger a rebuild that clobbers the active
    // selection; external model changes (undo/redo/load) re-run the effect via panelData/layout.
    fabricOwnedRef.current = new Set(['shape', 'text', 'image', 'group', 'path', 'balloon'])
    ;(shapeLayersRef.current ?? []).forEach((l) => {
      if (isShapeObjectLayer(l)) canvas.add(shapeLayerToFabricObject(l))
      else if (isPathObjectLayer(l)) canvas.add(pathLayerToFabricPath(l))
      else if (isBalloonObjectLayer(l)) canvas.add(balloonLayerToFabricObject(l))
      else if (isImageObjectLayer(l)) {
        imageLayerToFabricImage(l)
          .then((img) => {
            if (disposed) return
            applyObjectControls(img)
            canvas.add(img)
            canvas.requestRenderAll()
          })
          .catch(() => {
            /* skip images that fail to decode */
          })
      } else if (isGroupObjectLayer(l)) {
        layerToFabricGroup(l, scale)
          .then((group) => {
            if (disposed) return
            applyObjectControls(group)
            canvas.add(group)
            canvas.requestRenderAll()
          })
          .catch(() => {
            /* skip groups that fail to build */
          })
      }
    })
    ;(textLayersRef.current ?? []).forEach((l) => canvas.add(textLayerToFabricIText(l, scale)))
    canvas.requestRenderAll()

    const syncToLayers = (skipHistory = false) => {
      // Single canvas: every object type lives on the overlay, so rebuild the whole layer
      // model from it in one pass (chrome — raster + grid — excluded). Canvas z-order is
      // preserved within shapeLayers; texts render on top, as in the model/export.
      const objs = canvas.getObjects().filter((o) => !isChromeObject(o))
      const shapeResult: ObjectLayer[] = []
      const texts: TextLayer[] = []
      objs.forEach((o) => {
        if (isFabricBalloon(o)) {
          shapeResult.push(fabricBalloonToLayer(o as fabric.Path))
          return
        }
        const kind = fabricObjectKind(o)
        if (kind === 'text') texts.push(fabricITextToTextLayer(o as fabric.IText, scale))
        else if (kind === 'image') shapeResult.push(fabricImageToLayer(o as fabric.FabricImage))
        else if (kind === 'group') shapeResult.push(fabricGroupToLayer(o as fabric.Group, scale))
        else if (kind === 'path') shapeResult.push(fabricPathToLayer(o as fabric.Path))
        else shapeResult.push(fabricObjectToShapeLayer(o))
      })
      // One sync = ONE history entry. Each App handler snapshots the full panel state
      // (shapes + texts), so only the shape update carries the history flag; the text update
      // always skips it. Otherwise a single action (e.g. drawing one shape) would push two
      // near-identical entries and undo would appear to do nothing (it pops a duplicate).
      updateShapeLayers(shapeResult, skipHistory)
      updateTextLayers(texts, true)
    }

    // On-selection buttons (Fabric custom controls): duplicate + delete, so objects can be
    // managed without the keyboard — matches the old on-canvas buttons, kid-friendly.
    const OFFSET = 30 // px offset for a duplicate (mirrors legacy handleDuplicate)
    const duplicateObject = (obj?: fabric.FabricObject | null) => {
      if (!obj) return
      // Balloons are a fabric.Path; fabricObjectKind would mis-read them as a plain shape, so
      // clone them through the balloon converter first.
      if (isFabricBalloon(obj)) {
        const l = fabricBalloonToLayer(obj as fabric.Path)
        const clone = balloonLayerToFabricObject({ ...l, id: generateLayerId(), x: l.x + OFFSET, y: l.y + OFFSET })
        applyObjectControls(clone)
        canvas.add(clone)
        canvas.setActiveObject(clone)
        canvas.requestRenderAll()
        syncToLayers(false)
        return
      }
      const kind = fabricObjectKind(obj)
      if (kind === 'group') {
        const gl = fabricGroupToLayer(obj as fabric.Group, scale)
        const dup: GroupObjectLayer = {
          ...gl,
          id: generateLayerId(),
          x: gl.x + OFFSET,
          y: gl.y + OFFSET,
          children: gl.children.map((c) => ({ ...c, id: generateLayerId() })),
        }
        layerToFabricGroup(dup, scale)
          .then((g) => {
            if (disposed) return
            applyObjectControls(g)
            canvas.add(g)
            canvas.setActiveObject(g)
            canvas.requestRenderAll()
            syncToLayers(false)
          })
          .catch(() => {})
        return
      }
      if (kind === 'image') {
        const layer = fabricImageToLayer(obj as fabric.FabricImage)
        imageLayerToFabricImage({ ...layer, id: generateLayerId(), x: layer.x + OFFSET, y: layer.y + OFFSET })
          .then((img) => {
            if (disposed) return
            applyObjectControls(img)
            canvas.add(img)
            canvas.setActiveObject(img)
            canvas.requestRenderAll()
            syncToLayers(false)
          })
          .catch(() => {})
        return
      }
      let clone: fabric.FabricObject
      if (kind === 'text') {
        const l = fabricITextToTextLayer(obj as fabric.IText, scale)
        clone = textLayerToFabricIText({ ...l, id: generateLayerId(), x: l.x + OFFSET, y: l.y + OFFSET }, scale)
      } else {
        const l = fabricObjectToShapeLayer(obj)
        clone = shapeLayerToFabricObject({ ...l, id: generateLayerId(), x: l.x + OFFSET, y: l.y + OFFSET })
      }
      applyObjectControls(clone)
      canvas.add(clone)
      canvas.setActiveObject(clone)
      canvas.requestRenderAll()
      syncToLayers(false)
    }

    const deleteObject = (obj?: fabric.FabricObject | null) => {
      if (!obj) return
      canvas.remove(obj)
      canvas.discardActiveObject()
      canvas.requestRenderAll()
      syncToLayers(false)
    }

    // Merge the current multi-selection into one group; un-merge a group back into pieces.
    const mergeSelection = () => {
      const sel = canvas.getActiveObject() as fabric.ActiveSelection | null
      if (!sel || (sel as any).type !== 'activeselection') return
      const objs = sel.removeAll()
      if (objs.length < 2) return
      canvas.remove(...objs)
      const group = new fabric.Group(objs, { originX: 'center', originY: 'center' })
      ;(group as any).groupId = generateLayerId()
      applyObjectControls(group)
      canvas.add(group)
      canvas.setActiveObject(group)
      canvas.requestRenderAll()
      syncToLayers(false)
    }
    const ungroupObject = (obj?: fabric.FabricObject | null) => {
      if (!obj || !(obj instanceof fabric.Group)) return
      const objs = obj.removeAll() // Fabric bakes children back to absolute canvas coords
      canvas.remove(obj)
      objs.forEach((o) => {
        applyObjectControls(o)
        canvas.add(o)
      })
      canvas.discardActiveObject()
      canvas.requestRenderAll()
      syncToLayers(false)
    }

    const iconControl = (
      glyph: string,
      bg: string,
      x: number,
      offsetX: number,
      handler: (o?: fabric.FabricObject | null) => void,
      y = -0.5,
      offsetY = -16
    ) =>
      new fabric.Control({
        x,
        y,
        offsetX,
        offsetY,
        cursorStyle: 'pointer',
        sizeX: 24,
        sizeY: 24,
        touchSizeX: 28,
        touchSizeY: 28,
        mouseUpHandler: (_e, transform) => {
          handler(transform?.target)
          return true
        },
        render: (ctx, left, top) => {
          ctx.save()
          ctx.beginPath()
          ctx.arc(left, top, 11, 0, Math.PI * 2)
          ctx.fillStyle = bg
          ctx.fill()
          ctx.lineWidth = 1.5
          ctx.strokeStyle = '#ffffff'
          ctx.stroke()
          ctx.fillStyle = '#ffffff'
          ctx.font = '600 13px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(glyph, left, top + 0.5)
          ctx.restore()
        },
      })

    const dupControl = iconControl('⧉', '#3b82f6', 0.5, 16, duplicateObject)
    const delControl = iconControl('✕', '#ef4444', -0.5, -16, deleteObject)
    // Bottom-centre: ⊕ merge (shown on a multi-selection) and ⊖ un-merge (shown on a group).
    const mergeControl = iconControl('⊕', '#10b981', 0, 0, mergeSelection, 0.5, 18)
    const ungroupControl = iconControl('⊖', '#10b981', 0, 0, ungroupObject, 0.5, 18)
    const applyObjectControls = (obj: fabric.FabricObject) => {
      // Balloons are a fabric.Path, so they fall through here and get the normal duplicate +
      // delete controls (no ungroup — that's group-only).
      obj.controls = { ...obj.controls, dup: dupControl, del: delControl }
      if (obj instanceof fabric.Group) {
        obj.controls = { ...obj.controls, ung: ungroupControl }
      }
      // Interactivity is gated by mode. `select` AND the creation modes (shape/text) let objects
      // be picked/moved/transformed and expose their delete/duplicate controls — creation still
      // wins because onDown only creates when the pointer is NOT over an existing object. `fill`
      // keeps them evented for click-to-colour hit-testing. The raster tools (pen/eraser/scissor)
      // treat objects as a non-interactive backdrop so the gesture (brush/erase/cut) always wins.
      if (mode === 'select' || isCreationMode) {
        obj.selectable = true
        obj.evented = true
      } else if (mode === 'fill') {
        obj.selectable = false
        obj.evented = true
        obj.hoverCursor = 'pointer'
        if (obj instanceof fabric.Group) (obj as any).subTargetCheck = true
      } else {
        obj.selectable = false
        obj.evented = false
      }
    }

    // Give every already-loaded object (not chrome) the on-selection buttons + interactivity.
    canvas.getObjects().forEach((o) => {
      if (!isChromeObject(o)) applyObjectControls(o)
    })

    const getPoint = (opt: any) => {
      if (opt.scenePoint) return opt.scenePoint
      const c = canvas as any
      return typeof c.getScenePoint === 'function' ? c.getScenePoint(opt.e) : c.getPointer(opt.e)
    }

    // Show/hide the live "W × H" pill. Scene coords are converted to display px via the
    // current fit scale; the pill is centered horizontally just below (sceneCenterX, sceneBottomY).
    const showSizeLabel = (w: number, h: number, sceneCenterX: number, sceneBottomY: number) => {
      const el = sizeLabelRef.current
      if (!el) return
      const { scale } = fitCanvasToContainer()
      el.textContent = `${Math.round(w)} × ${Math.round(h)}`
      el.style.left = `${sceneCenterX * scale}px`
      el.style.top = `${sceneBottomY * scale}px`
      el.style.display = 'block'
    }
    const hideSizeLabel = () => {
      const el = sizeLabelRef.current
      if (el) el.style.display = 'none'
    }

    let creating: { obj: fabric.FabricObject; start: { x: number; y: number } } | null = null
    // Raster-tool gesture state (eraser drag / scissor marquee).
    let erasing: { last: { x: number; y: number } } | null = null
    let scissorSel: { start: { x: number; y: number }; rect: fabric.Rect } | null = null

    // Push the current raster backing back into panelData (App snapshots history + re-renders).
    const commitRaster = () => onCanvasChange(backingToImageData(rasterBacking))

    // Eraser: wipe a round segment out of the raster backing (destination-out) and re-render.
    const eraseSegment = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const ctx = rasterBacking.getContext('2d')
      if (!ctx) return
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = 20
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
      ctx.restore()
      rasterImage.dirty = true
      canvas.requestRenderAll()
    }

    // Fill fallback: flood the COMPOSITE scene (so the fill respects ink / grid / shape
    // boundaries), then stamp only the newly-filled pixels onto the raster backing.
    const floodRaster = (x: number, y: number, colorHex: string) => {
      const before = canvas.toCanvasElement(1) as HTMLCanvasElement
      const bctx = before.getContext('2d')
      const backCtx = rasterBacking.getContext('2d')
      if (!bctx || !backCtx) return
      const beforeData = bctx.getImageData(0, 0, before.width, before.height)
      floodFill(bctx, Math.round(x), Math.round(y), colorHex)
      const after = bctx.getImageData(0, 0, before.width, before.height).data
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
      commitRaster()
    }

    const onDown = (opt: any) => {
      if (mode === 'fill') {
        // Colour the clicked shape or pen path (or grouped child) by setting the object's own
        // fill, so the colour moves with it; otherwise flood-fill the raster backing.
        const target = (opt.subTargets && opt.subTargets[0]) || opt.target
        const targetKind = target && fabricObjectKind(target)
        if (target && (targetKind === 'shape' || targetKind === 'path')) {
          target.set('fill', currentColor)
          canvas.requestRenderAll()
          syncToLayers(false)
          return
        }
        const p2 = getPoint(opt)
        floodRaster(p2.x, p2.y, currentColor)
        return
      }
      if (mode === 'eraser') {
        const p = getPoint(opt)
        erasing = { last: { x: p.x, y: p.y } }
        return
      }
      if (mode === 'scissor') {
        const p = getPoint(opt)
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
        return
      }
      if (!isCreationMode) return // select mode: let Fabric handle picking/moving
      if (opt.target) return // clicking an existing object → let Fabric select/move it
      const p = getPoint(opt)
      if (mode === 'shape') {
        const obj = shapeLayerToFabricObject({
          type: 'shape',
          id: generateLayerId(),
          shape: currentShape,
          x: p.x,
          y: p.y,
          width: BASE,
          height: BASE,
          rotation: 0,
          strokeColor: currentColor,
          strokeWidth: 2,
          fillColor: null,
        })
        obj.set({ scaleX: 0.001, scaleY: 0.001, left: p.x, top: p.y })
        applyObjectControls(obj)
        canvas.add(obj)
        creating = { obj, start: { x: p.x, y: p.y } }
      } else if (mode === 'balloon') {
        // Balloon: same drag-to-size gesture as a shape. Built at BASE size, then grown via
        // scaleX/scaleY by onMove — so it shares the resize + live size-readout path.
        const obj = balloonLayerToFabricObject({
          type: 'balloon',
          id: generateLayerId(),
          kind: currentBalloonKind,
          x: p.x,
          y: p.y,
          width: BASE,
          height: BASE,
          rotation: 0,
          text: '',
          font: currentFont,
          fontSize: currentFontSize,
          color: currentColor,
        })
        obj.set({ scaleX: 0.001, scaleY: 0.001, left: p.x, top: p.y })
        applyObjectControls(obj)
        canvas.add(obj)
        creating = { obj, start: { x: p.x, y: p.y } }
      } else {
        // Text: click to place, then edit in place (fabric.IText). Emoji: place the emoji
        // character and don't enter editing.
        const obj = textLayerToFabricIText(
          {
            type: 'text',
            id: generateLayerId(),
            text: placeEmoji ?? '',
            x: p.x,
            y: p.y,
            width: 1,
            height: 1,
            rotation: 0,
            font: currentFont,
            fontSize: currentFontSize,
            color: currentColor,
          },
          scale
        )
        obj.set({ left: p.x, top: p.y })
        applyObjectControls(obj)
        canvas.add(obj)
        canvas.setActiveObject(obj)
        if (placeEmoji) {
          canvas.requestRenderAll()
          syncToLayers(false)
        } else {
          ;(obj as fabric.IText).enterEditing()
          canvas.requestRenderAll()
        }
      }
    }

    const onMove = (opt: any) => {
      if (erasing) {
        const p = getPoint(opt)
        eraseSegment(erasing.last, p)
        erasing.last = { x: p.x, y: p.y }
        return
      }
      if (scissorSel) {
        const p = getPoint(opt)
        const r = normalizeRect(scissorSel.start, p)
        scissorSel.rect.set({ left: r.x, top: r.y, width: r.width, height: r.height })
        canvas.requestRenderAll()
        return
      }
      if (!creating) return
      const p = getPoint(opt)
      const w = Math.max(1, Math.abs(p.x - creating.start.x))
      const h = Math.max(1, Math.abs(p.y - creating.start.y))
      creating.obj.set({
        scaleX: w / BASE,
        scaleY: h / BASE,
        left: (creating.start.x + p.x) / 2,
        top: (creating.start.y + p.y) / 2,
      })
      showSizeLabel(w, h, (creating.start.x + p.x) / 2, Math.max(creating.start.y, p.y))
      canvas.requestRenderAll()
    }

    const onUp = () => {
      hideSizeLabel()
      if (erasing) {
        erasing = null
        commitRaster() // one history entry per stroke (App snapshots the pre-stroke state)
        return
      }
      if (scissorSel) {
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
        // Build the cut-out as a Fabric image SYNCHRONOUSLY (from a backing canvas) and add it to
        // the overlay, so the tool-switch cleanup's syncToLayers preserves it (it rebuilds the
        // layer model from the canvas — a layer only in shapeLayers but not on the canvas is lost).
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
        } as any)
        applyObjectControls(img)
        canvas.add(img)
        canvas.setActiveObject(img)
        canvas.requestRenderAll()
        commitRaster() // snapshots history (pre-cut data + layers) and updates panelData
        syncToLayers(true) // lift the cut image into shapeLayers (commitRaster already snapshotted)
        onToolChange?.('select')
        return
      }
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
      syncToLayers(false)
    }

    const onModified = () => syncToLayers(false)

    // Resizing an existing object via its corner handles: show the live "W × H" pill.
    // getScaledWidth/Height give the object's own size; getBoundingRect gives placement.
    const onScaling = (opt: any) => {
      const t = opt.target as fabric.FabricObject | undefined
      if (!t) return
      const br = t.getBoundingRect()
      showSizeLabel(t.getScaledWidth(), t.getScaledHeight(), br.left + br.width / 2, br.top + br.height)
    }

    // Pen: a brush stroke just finished. Tag it so it round-trips as a path layer, then sync
    // (which snapshots history and lifts the new path into shapeLayers).
    const onPathCreated = (opt: any) => {
      const p = opt.path as fabric.Path | undefined
      if (!p) return
      ;(p as any)[PATH_ID_KEY] = generateLayerId()
      p.set({ strokeLineCap: 'round', strokeLineJoin: 'round', strokeUniform: true })
      syncToLayers(false)
    }

    // When a text edit finishes, drop empty text objects, otherwise sync the new content.
    // Report in-place text editing to the parent (keeps the toolbar's text submenu open).
    const onEditingEntered = () => onTextEditingChange?.(true)
    const onEditingExited = (opt: any) => {
      const obj = opt.target as fabric.IText | undefined
      if (obj && !(obj.text ?? '').trim()) {
        canvas.remove(obj)
        canvas.requestRenderAll()
      }
      onTextEditingChange?.(false)
      syncToLayers(false)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const obj = canvas.getActiveObject()
      if (!obj) return
      if ((obj as any).isEditing) return // typing in a text object — let it handle the key
      canvas.remove(obj)
      canvas.discardActiveObject()
      canvas.requestRenderAll()
      syncToLayers(false)
    }

    // Show the ⊕ merge button whenever 2+ objects are multi-selected.
    const onSelection = () => {
      const a = canvas.getActiveObject() as any
      if (a && a.type === 'activeselection' && typeof a.getObjects === 'function' && a.getObjects().length >= 2) {
        a.controls = { ...a.controls, merge: mergeControl }
        a.setCoords() // recompute oCoords so the new control has render coords
        canvas.requestRenderAll()
      }
    }

    canvas.on('mouse:down', onDown)
    canvas.on('mouse:move', onMove)
    canvas.on('mouse:up', onUp)
    canvas.on('object:modified', onModified)
    canvas.on('object:scaling', onScaling)
    canvas.on('path:created', onPathCreated)
    canvas.on('text:editing:entered', onEditingEntered)
    canvas.on('text:editing:exited', onEditingExited)
    canvas.on('selection:created', onSelection)
    canvas.on('selection:updated', onSelection)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', sizeOverlay)

    return () => {
      disposed = true
      canvas.off('mouse:down', onDown)
      canvas.off('mouse:move', onMove)
      canvas.off('mouse:up', onUp)
      canvas.off('object:modified', onModified)
      canvas.off('object:scaling', onScaling)
      canvas.off('path:created', onPathCreated)
      canvas.off('text:editing:entered', onEditingEntered)
      canvas.off('text:editing:exited', onEditingExited)
      canvas.off('selection:created', onSelection)
      canvas.off('selection:updated', onSelection)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', sizeOverlay)
      // Every gesture already syncs immediately (create / modify / delete / fill / erase / cut
      // / text-commit), so the teardown must NOT do a blanket canvas→model sync: on a
      // model-driven re-run (undo/redo/load/panel-switch) the canvas is stale and syncing it
      // would clobber the just-restored model. The ONE thing not yet committed is an in-place
      // text edit the user abandoned by switching tools (no text:editing:exited fired) — commit
      // just that, with a history entry.
      const editing = canvas.getActiveObject()
      if (editing && (editing as any).isEditing) {
        syncToLayers(false)
      }
      canvas.isDrawingMode = false
      canvas.getObjects().slice().forEach((o) => canvas.remove(o))
      canvas.discardActiveObject()
      canvas.requestRenderAll()
      fabricOwnedRef.current = new Set()
    }
  }, [tool, shape, balloonKind, color, penType, font, fontSize, emoji, layout, panelData, updateShapeLayers, updateTextLayers])





  return (
    <div
      ref={containerRef}
      className="canvas-container"
      style={{ position: 'relative', width: '100%', height: '100%' }}
      data-testid="canvas"
    >
      {/* Fabric.js Canvas — the single interactive canvas. */}
      <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, pointerEvents: 'auto' }}>
        <canvas ref={fabricRef} />
      </div>
      {/* Live size readout, positioned imperatively while drawing/resizing. */}
      <div ref={sizeLabelRef} className="size-label" style={{ display: 'none' }} />
    </div>
  )
}
