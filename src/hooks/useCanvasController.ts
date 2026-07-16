import { useCallback, useEffect, useRef, MutableRefObject, RefObject } from 'react'
import * as fabric from 'fabric'
import { Tool, Shape, PenType, BalloonKind } from '../types/common'
import { TextLayer, ObjectLayer } from '../types/layers'
import { toolToMode } from '../utils/toolMode'
import { debugLog } from '../utils/canvasUtils'
import { PATH_ID_KEY } from '../utils/fabricPath'
import { isActiveSelection, isEditingText, getScenePoint } from '../utils/fabricMeta'
import { backingToImageData, isChromeObject } from '../utils/fabricRaster'
import { canvasObjectsToLayers, buildScene } from '../utils/fabricScene'
import { createToolController } from '../utils/toolControllers'
import { createObjectOps } from '../utils/objectOps'
import { createObjectControls } from '../utils/fabricControls'
import { fitOverlay } from '../utils/overlayFit'
import { generateLayerId } from '../utils/id'
import { createImageFromDataUrl, IMAGE_ID_KEY } from '../utils/fabricImage'

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

export interface CanvasControllerParams {
  tool: Tool
  shape?: Shape
  penType?: PenType
  color: string
  font: string
  fontSize: number
  panelData: ImageData | null
  layout: { rows: number; columns: number[] }
  emoji: string
  balloonKind: BalloonKind
  shapeLayers: ObjectLayer[]
  textLayers: TextLayer[]
  onCanvasChange: (data: ImageData) => void
  onShapeLayersChange?: (layers: ObjectLayer[], skipHistory?: boolean) => void
  onTextLayersChange?: (layers: TextLayer[], skipHistory?: boolean) => void
  onTextEditingChange?: (isEditing: boolean) => void
  onToolChange?: (tool: Tool) => void
  containerRef: RefObject<HTMLDivElement>
  fabricCanvasRef: MutableRefObject<fabric.Canvas | null>
  sizeLabelRef: RefObject<HTMLDivElement>
}

/**
 * The heart of the Canvas component: on every model- or tool-driven change it rebuilds the Fabric
 * overlay scene, wires `syncToLayers`, resolves the per-tool pointer controller, and binds all the
 * canvas + window event handlers — as ONE atomic effect with a single teardown. Split into more
 * than one effect would create cross-effect ordering/data hazards (the events need the scene's
 * raster handles + control instances, and the teardown must off events before clearing the scene),
 * so the whole unit stays together here.
 *
 * Load-bearing invariants preserved verbatim from the original component:
 *  1. `shapeLayersRef`/`textLayersRef` mirror the props and are updated DURING RENDER (below), so
 *     the effect and its cleanup read the current model — including a value the cleanup itself
 *     writes when committing an abandoned text edit.
 *  2. `shapeLayers`/`textLayers` are deliberately NOT in the effect deps: live edits must not
 *     trigger a rebuild that clobbers the active selection. External model changes re-run via
 *     panelData/layout.
 *  3. The teardown does NOT blanket-sync canvas→model; it commits only an abandoned in-place text
 *     edit.
 *  4. One sync = one history entry (`syncToLayers`).
 */
export const useCanvasController = (params: CanvasControllerParams) => {
  const {
    tool,
    shape,
    penType,
    color,
    font,
    fontSize,
    panelData,
    layout,
    emoji,
    balloonKind,
    shapeLayers,
    textLayers,
    onCanvasChange,
    onShapeLayersChange,
    onTextLayersChange,
    onTextEditingChange,
    onToolChange,
    containerRef,
    fabricCanvasRef,
    sizeLabelRef,
  } = params

  // These mirror the layer props but are updated DURING RENDER (below) so the overlay effect
  // always reads the current model — including a value `syncToLayers` writes synchronously in
  // the effect cleanup (committing an in-progress text edit), which the props wouldn't reflect
  // until a later render that wouldn't re-run the effect.
  const shapeLayersRef = useRef<ObjectLayer[]>(shapeLayers)
  const textLayersRef = useRef<TextLayer[]>(textLayers)
  shapeLayersRef.current = shapeLayers
  textLayersRef.current = textLayers

  // The set of layer types currently owned by the Fabric overlay (rendered/edited there). Populated
  // while a Fabric-owned tool is active; retained from the two-canvas era.
  const fabricOwnedRef = useRef<Set<ObjectLayer['type']>>(new Set())

  // When a paste happens outside select mode we switch to 'select' (so the image is immediately
  // resizable/rotatable), which tears down and rebuilds this effect. This survives that rebuild and
  // holds the pasted image's id so the new scene can re-select it once it finishes loading async.
  const pendingSelectIdRef = useRef<string | null>(null)

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
  // the app keep working. The raster tools (pen/eraser/fill/scissor) paint on the raster backing.
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    // Emoji is handled as text mode: it places a fabric.IText holding the emoji character.
    const mode = toolToMode(tool)
    const placeEmoji = tool === 'emoji' ? emoji ?? '😀' : null
    const isCreationMode = mode === 'shape' || mode === 'balloon' || mode === 'text'
    let disposed = false // guards async image loads against a stale canvas after cleanup

    // Keep the Fabric overlay's CSS size aligned with the container so their coordinate spaces line
    // up. Internal resolution stays 1200x800.
    const sizeOverlay = () => {
      const { width, height } = fitOverlay(containerRef.current)
      if (width && height) {
        canvas.setDimensions({ width, height }, { cssOnly: true })
      }
    }
    sizeOverlay()

    // Display scale used to convert TextObjectLayer CSS font sizes to canvas-internal units.
    // Defaults to 1 when the container isn't measurable (e.g. jsdom).
    const computeScale = () => fitOverlay(containerRef.current).scale

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
    // (chrome, at the back) + every vector object on top. Interactivity is gated per-mode by
    // applyObjectControls; the raster tools (eraser / fill fallback / scissor) paint on
    // `rasterBacking` and re-render `rasterImage`.
    // Load from the render-synced refs (== current props, plus any value the cleanup just wrote
    // when committing an in-progress text edit). shapeLayers/textLayers stay OUT of the effect deps
    // so our own live edits don't trigger a rebuild that clobbers the active selection; external
    // model changes (undo/redo/load) re-run the effect via panelData/layout.
    fabricOwnedRef.current = new Set(['shape', 'text', 'image', 'group', 'path', 'balloon'])
    // `applyObjectControls` is assigned further down the effect body (from createObjectControls);
    // wrap it so buildScene's async loads read it lazily (they resolve after the whole body has
    // run) rather than at the TDZ point of this call.
    let applyObjectControls: (obj: fabric.FabricObject) => void
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

    // Object-management ops (duplicate/delete/merge/ungroup) + the on-selection Fabric controls
    // that trigger them, split out to utils/objectOps.ts + utils/fabricControls.ts. The two are
    // mutually recursive (an op applies controls to the object it creates; a control invokes an
    // op), so `applyObjectControls` is late-bound via the wrapper below — assigned here, but read
    // by ops only when a control fires (long after this body has run).
    const objectOps = createObjectOps(canvas, {
      syncToLayers,
      scale,
      isDisposed: () => disposed,
      applyControls: (o) => applyObjectControls(o),
    })
    const objectControls = createObjectControls(objectOps, { mode, isCreationMode })
    applyObjectControls = objectControls.applyObjectControls
    const mergeControl = objectControls.mergeControl

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
      const { scale } = fitOverlay(containerRef.current)
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
    // (`applyObjectControls` et al.) stays owned here and is passed in as a callback.
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

    // Drop a pasted clipboard image onto the canvas: centered, scaled to fit, then synced into the
    // model (one history entry). Images resize/rotate for free via the select-mode controls, so if
    // we're not already in select mode we switch to it and hand the image's id to the rebuild via
    // pendingSelectIdRef, which re-selects it once the async image load lands (onObjectAdded below).
    const pasteImage = async (dataUrl: string) => {
      const id = generateLayerId()
      let img: fabric.FabricImage
      try {
        img = await createImageFromDataUrl(dataUrl, {
          canvasWidth: canvas.getWidth(),
          canvasHeight: canvas.getHeight(),
          id,
        })
      } catch {
        return // undecodable image data — ignore
      }
      if (disposed) return
      applyObjectControls(img)
      canvas.add(img)
      // syncToLayers reads the canvas objects, so the image must be added before we sync.
      syncToLayers(false)
      if (mode === 'select') {
        canvas.setActiveObject(img)
        canvas.requestRenderAll()
      } else if (onToolChange) {
        pendingSelectIdRef.current = id
        onToolChange('select')
      } else {
        canvas.requestRenderAll()
      }
    }

    // Intercept a paste carrying image data. Text edits keep the native paste (so pasting text into
    // a text object still works); we only claim the event when an image item is present.
    const onPaste = (e: ClipboardEvent) => {
      const active = canvas.getActiveObject()
      if (active && isEditingText(active)) return
      const items = e.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (!item || !item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (!file) continue
        e.preventDefault()
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string') pasteImage(reader.result)
        }
        reader.readAsDataURL(file)
        return
      }
    }

    // After a paste-driven switch into select mode, the scene rebuilds and the image reloads
    // asynchronously; select it the moment it arrives so it's ready to resize/rotate.
    const onObjectAdded = (opt: any) => {
      const id = pendingSelectIdRef.current
      if (!id) return
      const obj = opt.target as fabric.FabricObject | undefined
      if (obj && (obj as any)[IMAGE_ID_KEY] === id) {
        pendingSelectIdRef.current = null
        canvas.setActiveObject(obj)
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
    canvas.on('object:added', onObjectAdded)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('paste', onPaste)
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
      canvas.off('object:added', onObjectAdded)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('paste', onPaste)
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
}
