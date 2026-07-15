import * as fabric from 'fabric'
import { Mode } from '../types/common'
import { ObjectOps } from './objectOps'

/**
 * The on-selection Fabric custom controls (duplicate / delete / merge / ungroup buttons) and the
 * `applyObjectControls` function that stamps them onto an object along with the mode-gated
 * interactivity rules. Kid-friendly: objects can be managed with on-canvas buttons, no keyboard.
 *
 * The control handlers are the object-management ops (`objectOps.ts`), passed in — this module
 * builds the buttons and the interactivity gate; the ops module builds the behaviour.
 */

/** A small circular icon button rendered as a Fabric control at a corner/edge of the selection. */
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

export interface ObjectControls {
  /** Stamp the on-selection controls + mode-gated interactivity onto a (non-chrome) object. */
  applyObjectControls: (obj: fabric.FabricObject) => void
  /** ⊕ merge control — added by the effect's selection handler when 2+ objects are selected. */
  mergeControl: fabric.Control
}

/**
 * Build the on-selection controls bound to `ops`, plus `applyObjectControls` gated by the current
 * mode. `mergeControl` is returned separately because it's attached to a multi-selection by the
 * selection handler, not to individual objects.
 */
export const createObjectControls = (
  ops: ObjectOps,
  gate: { mode: Mode; isCreationMode: boolean }
): ObjectControls => {
  const { duplicateObject, deleteObject, mergeSelection, ungroupObject } = ops
  const { mode, isCreationMode } = gate

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

  return { applyObjectControls, mergeControl }
}
