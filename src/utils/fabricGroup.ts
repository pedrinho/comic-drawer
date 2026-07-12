import * as fabric from 'fabric'
import { ObjectLayer, GroupObjectLayer } from '../types/layers'
import { shapeLayerToFabricObject, fabricObjectToShapeLayer } from './fabricShapes'
import { textLayerToFabricIText, fabricITextToTextLayer } from './fabricText'
import { imageLayerToFabricImage, fabricImageToLayer, fabricObjectKind } from './fabricImage'

/**
 * Fabric.js migration — group ("merge") conversion layer.
 *
 * A `GroupObjectLayer` is several objects merged into one movable/duplicable unit. Children
 * are stored in GROUP-LOCAL coordinates (Fabric keeps a group's children relative to its
 * centre), and the group's own x/y/width/height/rotation give its absolute placement — so
 * the existing per-child converters can be reused directly. v1 children are shape/text/image
 * (no nested groups, no paths/balloons).
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
    default:
      return null // path / balloon / nested group not supported as children in v1
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
    default:
      return null // nested group not supported in v1
  }
}

/** Build a fabric.Group from a GroupObjectLayer, placed absolutely on the canvas. */
export const layerToFabricGroup = async (layer: GroupObjectLayer, scale: number): Promise<fabric.Group> => {
  const children = (await Promise.all(layer.children.map((c) => childLayerToFabric(c, scale)))).filter(
    Boolean
  ) as fabric.FabricObject[]

  const group = new fabric.Group(children, { originX: 'center', originY: 'center' })
  ;(group as any)[GROUP_ID_KEY] = layer.id

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
  return group
}

/** Read a fabric.Group back into a GroupObjectLayer. */
export const fabricGroupToLayer = (group: fabric.Group, scale: number): GroupObjectLayer => {
  const center = group.getCenterPoint()
  const width = (group.width ?? 0) * (group.scaleX ?? 1)
  const height = (group.height ?? 0) * (group.scaleY ?? 1)
  const children = group
    .getObjects()
    .map((o) => fabricChildToLayer(o, scale))
    .filter(Boolean) as ObjectLayer[]

  return {
    type: 'group',
    id: ((group as any)[GROUP_ID_KEY] as string | undefined) ?? `group-${Math.round(center.x)}-${Math.round(center.y)}`,
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
    rotation: (group.angle ?? 0) * DEG_TO_RAD,
    children,
  }
}
