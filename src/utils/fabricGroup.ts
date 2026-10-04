import * as fabric from 'fabric'
import { ObjectLayer, GroupObjectLayer } from '../types/layers'
import { shapeLayerToFabricObject, fabricObjectToShapeLayer } from './fabricShapes'
import { textLayerToFabricIText, fabricITextToTextLayer } from './fabricText'
import { imageLayerToFabricImage, fabricImageToLayer, fabricObjectKind } from './fabricImage'
import { pathLayerToFabricPath, fabricPathToLayer } from './fabricPath'
import { applyErasures, erasuresOf } from './fabricErase'

/**
 * Fabric.js migration — group ("merge") conversion layer.
 *
 * A `GroupObjectLayer` is several objects merged into one movable/duplicable unit. Children
 * are stored in GROUP-LOCAL coordinates (Fabric keeps a group's children relative to its
 * centre), and the group's own x/y/width/height/rotation give its absolute placement — so
 * the existing per-child converters can be reused directly. Children may be shapes, text, images,
 * pen paths, or other groups (merging a group with something nests it); deprecated balloons are not
 * supported as children.
 */

export const GROUP_ID_KEY = 'groupId'

const RAD_TO_DEG = 180 / Math.PI
const DEG_TO_RAD = Math.PI / 180

/** child layer → fabric object (in the child's local coordinates). */
const childLayerToFabric = async (child: ObjectLayer, scale: number): Promise<fabric.FabricObject | null> => {
  switch (child.type) {
    case 'shape':
      return shapeLayerToFabricObject(child)
    case 'text':
      return textLayerToFabricIText(child, scale)
    case 'image':
      return imageLayerToFabricImage(child)
    case 'path':
      return pathLayerToFabricPath(child)
    case 'group':
      return layerToFabricGroup(child, scale)
    default:
      return null // deprecated balloons are not supported as children
  }
}

/** grouped fabric child → child layer (local coordinates). */
const fabricChildToLayer = (obj: fabric.FabricObject, scale: number): ObjectLayer | null => {
  switch (fabricObjectKind(obj)) {
    case 'text':
      return fabricITextToTextLayer(obj as fabric.IText, scale)
    case 'image':
      return fabricImageToLayer(obj as fabric.FabricImage)
    case 'shape':
      return fabricObjectToShapeLayer(obj)
    case 'path':
      return fabricPathToLayer(obj as fabric.Path)
    case 'group':
      return fabricGroupToLayer(obj as fabric.Group, scale)
    default:
      return null
  }
}

/** Build a fabric.Group from a GroupObjectLayer, placed absolutely on the canvas. */
export const layerToFabricGroup = async (layer: GroupObjectLayer, scale: number): Promise<fabric.Group> => {
  const children = (await Promise.all(layer.children.map((c) => childLayerToFabric(c, scale)))).filter(
    Boolean
  ) as fabric.FabricObject[]

  const group = new fabric.Group(children, { originX: 'center', originY: 'center' })
  group[GROUP_ID_KEY] = layer.id

  // Scale the local child bounding box up to the stored absolute size, then position it.
  const localW = group.width || layer.width || 1
  const localH = group.height || layer.height || 1
  group.set({
    scaleX: layer.width / localW,
    scaleY: layer.height / localH,
    angle: layer.rotation * RAD_TO_DEG,
    left: layer.x + layer.width / 2,
    top: layer.y + layer.height / 2,
  })
  group.setCoords()
  return applyErasures(group, layer.erasures)
}

/** Read a fabric.Group back into a GroupObjectLayer. */
export const fabricGroupToLayer = (group: fabric.Group, scale: number): GroupObjectLayer => {
  // Centre in the PARENT plane: the canvas for a top-level group, the outer group when nested.
  const center = group.getRelativeCenterPoint()
  const width = (group.width ?? 0) * (group.scaleX ?? 1)
  const height = (group.height ?? 0) * (group.scaleY ?? 1)
  const children = group
    .getObjects()
    .map((o) => fabricChildToLayer(o, scale))
    .filter(Boolean) as ObjectLayer[]

  return {
    type: 'group',
    id: group[GROUP_ID_KEY] ?? `group-${Math.round(center.x)}-${Math.round(center.y)}`,
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
    rotation: (group.angle ?? 0) * DEG_TO_RAD,
    children,
    ...erasuresOf(group),
  }
}
