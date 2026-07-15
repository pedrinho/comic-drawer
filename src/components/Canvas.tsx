import { useEffect, useRef, useCallback } from 'react'
import * as fabric from 'fabric'
import { Tool, Shape, PenType, BalloonKind } from '../types/common'
import { toolToMode } from '../utils/toolMode'
import { TextLayer, ObjectLayer, GroupObjectLayer } from '../types/layers'
import { debugLog } from '../utils/canvasUtils'
import { shapeLayerToFabricObject, fabricObjectToShapeLayer } from '../utils/fabricShapes'
import { textLayerToFabricIText, fabricITextToTextLayer } from '../utils/fabricText'
import { imageLayerToFabricImage, fabricImageToLayer, fabricObjectKind } from '../utils/fabricImage'
import { layerToFabricGroup, fabricGroupToLayer, GROUP_ID_KEY } from '../utils/fabricGroup'
import { pathLayerToFabricPath, fabricPathToLayer, PATH_ID_KEY } from '../utils/fabricPath'
import { isActiveSelection, isEditingText, getScenePoint } from '../utils/fabricMeta'
import { backingToImageData, isChromeObject } from '../utils/fabricRaster'
import { balloonLayerToFabricObject, fabricBalloonToLayer, isFabricBalloon } from '../utils/fabricBalloon'
import { canvasObjectsToLayers, buildScene } from '../utils/fabricScene'
import { createToolController } from '../utils/toolControllers'
import { generateLayerId } from '../utils/id'
import './Canvas.css'

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
    const mode = toolToMode(tool)
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
    // Load from the render-synced refs (== current props, plus any value the cleanup just
    // wrote when committing an in-progress text edit). shapeLayers/textLayers stay OUT of the
    // effect deps so our own live edits don't trigger a rebuild that clobbers the active
    // selection; external model changes (undo/redo/load) re-run the effect via panelData/layout.
    fabricOwnedRef.current = new Set(['shape', 'text', 'image', 'group', 'path', 'balloon'])
    // `applyObjectControls` is defined further down the effect body; wrap it so buildScene's
    // async loads read it lazily (they resolve after the whole body has run) rather than at the
    // TDZ point of this call.
    const { rasterImage, rasterBacking } = buildScene(canvas, {
      shapeLayers: shapeLayersRef.current ?? [],
      textLayers: textLayersRef.current ?? [],
      panelData,
      layout,
      scale,
      applyObjectControls: (o) => applyObjectControls(o),
      isDisposed: () => disposed,
    })

    const syncToLayers = (skipHistory = false) => {
      // Single canvas: every object type lives on the overlay, so rebuild the whole layer model
      // from it in one pass (chrome — raster + grid — excluded via canvasObjectsToLayers).
      const { shapeLayers: shapeResult, textLayers: texts } = canvasObjectsToLayers(canvas.getObjects(), scale)
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
      } else if (kind === 'path') {
        // A pen path is a fabric.Path with no SHAPE_KIND_KEY; without this branch it would fall
        // through to fabricObjectToShapeLayer and come back as a rectangle (the "squared" bug).
        const l = fabricPathToLayer(obj as fabric.Path)
        clone = pathLayerToFabricPath({ ...l, id: generateLayerId(), x: l.x + OFFSET, y: l.y + OFFSET })
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
      const sel = canvas.getActiveObject()
      if (!isActiveSelection(sel)) return
      const objs = sel.removeAll()
      if (objs.length < 2) return
      canvas.remove(...objs)
      const group = new fabric.Group(objs, { originX: 'center', originY: 'center' })
      group[GROUP_ID_KEY] = generateLayerId()
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
        if (obj instanceof fabric.Group) obj.subTargetCheck = true
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
      return getScenePoint(canvas, opt.e)
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

    // Push the current raster backing back into panelData (App snapshots history + re-renders).
    const commitRaster = () => onCanvasChange(backingToImageData(rasterBacking))

    // Resolve the per-tool pointer strategy and wire the raw Fabric pointer events to it. Modes
    // with no bespoke pointer behaviour — `select` (Fabric handles picking/moving) and `pen`
    // (native brush) — resolve to null, so the wrappers below no-op. The controller owns its own
    // transient gesture state (in-flight shape / eraser stroke / scissor marquee); object-management
    // (`applyObjectControls` et al.) stays owned by this effect and is passed in as a callback.
    const controller = createToolController(mode, {
      canvas,
      scale,
      shape: currentShape,
      balloonKind: currentBalloonKind,
      color: currentColor,
      font: currentFont,
      fontSize: currentFontSize,
      placeEmoji,
      rasterImage,
      rasterBacking,
      syncToLayers,
      applyObjectControls,
      showSizeLabel,
      hideSizeLabel,
      commitRaster,
      getPoint,
      onToolChange,
    })

    const onDown = (opt: any) => controller?.onDown?.(opt)
    const onMove = (opt: any) => controller?.onMove?.(opt)
    // hideSizeLabel always runs on release — it also backs the object:scaling pill in select mode —
    // then the active tool's release logic runs.
    const onUp = () => {
      hideSizeLabel()
      controller?.onUp?.()
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
      p[PATH_ID_KEY] = generateLayerId()
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
      if (isEditingText(obj)) return // typing in a text object — let it handle the key
      canvas.remove(obj)
      canvas.discardActiveObject()
      canvas.requestRenderAll()
      syncToLayers(false)
    }

    // Show the ⊕ merge button whenever 2+ objects are multi-selected.
    const onSelection = () => {
      const a = canvas.getActiveObject()
      if (isActiveSelection(a) && a.getObjects().length >= 2) {
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
      if (isEditingText(editing)) {
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
