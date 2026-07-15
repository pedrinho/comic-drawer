import * as fabric from 'fabric'
import { GroupObjectLayer } from '../types/layers'
import { shapeLayerToFabricObject, fabricObjectToShapeLayer } from './fabricShapes'
import { textLayerToFabricIText, fabricITextToTextLayer } from './fabricText'
import { imageLayerToFabricImage, fabricImageToLayer, fabricObjectKind } from './fabricImage'
import { layerToFabricGroup, fabricGroupToLayer, GROUP_ID_KEY } from './fabricGroup'
import { pathLayerToFabricPath, fabricPathToLayer } from './fabricPath'
import { balloonLayerToFabricObject, fabricBalloonToLayer, isFabricBalloon } from './fabricBalloon'
import { isActiveSelection } from './fabricMeta'
import { generateLayerId } from './id'

/**
 * Object-management operations wired to the on-selection Fabric controls (see `fabricControls.ts`):
 * duplicate, delete, merge-into-group, and ungroup. Each rebuilds the layer model via `syncToLayers`
 * so one gesture = one history entry.
 *
 * These are mutually recursive with `applyObjectControls`: an op applies controls to the object it
 * creates, and a control's handler invokes an op. The op side takes that as the `applyControls`
 * callback (late-bound by the caller) rather than importing the controls module, keeping the
 * dependency one-directional at module load.
 */

const OFFSET = 30 // px offset for a duplicate (mirrors legacy handleDuplicate)

export interface ObjectOpsDeps {
  /** Rebuild the layer model from the canvas (one sync = one history entry). */
  syncToLayers: (skipHistory?: boolean) => void
  /** Display px per internal px, for converting text CSS font sizes on clone. */
  scale: number
  /** Async clone paths (image/group) bail when this returns true (the effect was torn down). */
  isDisposed: () => boolean
  /** Apply on-selection controls + mode-gated interactivity to a newly-added object. */
  applyControls: (obj: fabric.FabricObject) => void
}

export interface ObjectOps {
  duplicateObject: (obj?: fabric.FabricObject | null) => void
  deleteObject: (obj?: fabric.FabricObject | null) => void
  mergeSelection: () => void
  ungroupObject: (obj?: fabric.FabricObject | null) => void
}

export const createObjectOps = (canvas: fabric.Canvas, deps: ObjectOpsDeps): ObjectOps => {
  const { syncToLayers, scale, isDisposed, applyControls } = deps

  const duplicateObject = (obj?: fabric.FabricObject | null) => {
    if (!obj) return
    // Balloons are a fabric.Path; fabricObjectKind would mis-read them as a plain shape, so
    // clone them through the balloon converter first.
    if (isFabricBalloon(obj)) {
      const l = fabricBalloonToLayer(obj as fabric.Path)
      const clone = balloonLayerToFabricObject({ ...l, id: generateLayerId(), x: l.x + OFFSET, y: l.y + OFFSET })
      applyControls(clone)
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
          if (isDisposed()) return
          applyControls(g)
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
          if (isDisposed()) return
          applyControls(img)
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
    applyControls(clone)
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
    applyControls(group)
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
      applyControls(o)
      canvas.add(o)
    })
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    syncToLayers(false)
  }

  return { duplicateObject, deleteObject, mergeSelection, ungroupObject }
}
