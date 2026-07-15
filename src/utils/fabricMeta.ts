import * as fabric from 'fabric'

/**
 * Small typed helpers for Fabric object/canvas gaps that TypeScript can't narrow at the call site
 * — the boundary the pointer pipeline in Canvas.tsx used to bridge with `as any`.
 */

/** True (and narrows) when the object is a multi-select `ActiveSelection`. */
export const isActiveSelection = (
  obj: fabric.FabricObject | null | undefined
): obj is fabric.ActiveSelection => !!obj && obj.type === 'activeselection'

/** True when the object is a text object currently in in-place edit mode. */
export const isEditingText = (obj: fabric.FabricObject | null | undefined): boolean =>
  obj instanceof fabric.IText && obj.isEditing === true

/**
 * Scene-space pointer for an event, tolerant of Fabric API drift: prefers `getScenePoint`
 * (current) and falls back to the older `getPointer`. Centralises the one unavoidable structural
 * cast (a narrow shape, not `any`).
 */
export const getScenePoint = (canvas: fabric.Canvas, e: fabric.TPointerEvent): fabric.Point => {
  const c = canvas as unknown as {
    getScenePoint?: (e: fabric.TPointerEvent) => fabric.Point
    getPointer?: (e: fabric.TPointerEvent) => fabric.Point
  }
  if (typeof c.getScenePoint === 'function') return c.getScenePoint(e)
  if (typeof c.getPointer === 'function') return c.getPointer(e)
  throw new Error('canvas has no scene-point method')
}
