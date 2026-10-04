import { describe, it, expect } from 'vitest'
import * as fabric from 'fabric'
import { ShapeObjectLayer, PathObjectLayer, GroupObjectLayer, migrateLayer } from '../types/layers'
import { shapeLayerToFabricObject, fabricObjectToShapeLayer } from './fabricShapes'
import { pathLayerToFabricPath, fabricPathToLayer } from './fabricPath'
import { textLayerToFabricIText } from './fabricText'
import { layerToFabricGroup, fabricGroupToLayer } from './fabricGroup'
import {
  applyErasures,
  commitEraseStroke,
  erasuresOf,
  fitEraseMask,
  isEraseMask,
  pushGroupEraseMaskToChildren,
  readErasures,
} from './fabricErase'

/**
 * The eraser-mask layer: strokes land where they were drawn, survive the model round-trip even when
 * the converters rebuild the object at a different scale, follow text that grows, and are handed to
 * the pieces of an un-merged group. Asserted on each stroke's SCENE transform (where it actually
 * punches the hole), since that's what the user sees.
 */

const mul = fabric.util.multiplyTransformMatrices

/** Canvas-plane eraser stroke, like the one EraserBrush emits on release. */
const brushPath = (d: string, width = 20) =>
  new fabric.Path(d, { stroke: 'black', strokeWidth: width, fill: null, globalCompositeOperation: 'destination-out' })

/** Scene transform of each mask stroke on `obj` (object → mask → stroke). */
const strokeSceneMatrices = (obj: fabric.FabricObject) => {
  const mask = obj.clipPath
  if (!isEraseMask(mask)) return []
  return mask
    .getObjects()
    .map((s) => mul(obj.calcTransformMatrix(), mul(mask.calcOwnMatrix(), s.calcOwnMatrix())))
}

const expectMatClose = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 3))

const rect = (over: Partial<ShapeObjectLayer> = {}): ShapeObjectLayer => ({
  type: 'shape', id: 'r1', shape: 'rectangle', x: 100, y: 100, width: 200, height: 100,
  rotation: 0, strokeColor: '#000000', strokeWidth: 2, fillColor: null, ...over,
})

describe('commitEraseStroke', () => {
  it('adds the stroke to a fresh mask, exactly where it was drawn', () => {
    const obj = shapeLayerToFabricObject(rect({ rotation: Math.PI / 6 }))
    const src = brushPath('M 150 150 L 250 160')
    commitEraseStroke(obj, src)
    expect(isEraseMask(obj.clipPath)).toBe(true)
    const [m] = strokeSceneMatrices(obj)
    expectMatClose(m!, src.calcTransformMatrix())
  })

  it('reuses the mask for later strokes', () => {
    const obj = shapeLayerToFabricObject(rect())
    commitEraseStroke(obj, brushPath('M 150 150 L 160 150'))
    const mask = obj.clipPath
    commitEraseStroke(obj, brushPath('M 200 150 L 210 150'))
    expect(obj.clipPath).toBe(mask)
    expect(strokeSceneMatrices(obj)).toHaveLength(2)
  })
})

describe('readErasures / applyErasures round-trip', () => {
  it('is a no-op for objects never erased', () => {
    const obj = shapeLayerToFabricObject(rect())
    expect(readErasures(obj)).toBeUndefined()
    expect(erasuresOf(obj)).toEqual({})
    expect(applyErasures(obj, undefined).clipPath).toBeUndefined()
    expect(fabricObjectToShapeLayer(obj)).not.toHaveProperty('erasures')
  })

  it('keeps the hole in place across a rebuild', () => {
    const obj = shapeLayerToFabricObject(rect({ rotation: 0.4 }))
    commitEraseStroke(obj, brushPath('M 150 140 L 260 170'))
    const before = strokeSceneMatrices(obj)
    const rebuilt = shapeLayerToFabricObject(fabricObjectToShapeLayer(obj))
    expectMatClose(strokeSceneMatrices(rebuilt)[0]!, before[0]!)
  })

  it('keeps the hole on the same spot of the shape after a resize folded into the rebuilt size', () => {
    // Erase, then resize 2x via scaleX/scaleY (what the corner handles do). The converter bakes the
    // scale into width/height and rebuilds at scale 1 — the hole must scale along with the shape.
    const obj = shapeLayerToFabricObject(rect())
    commitEraseStroke(obj, brushPath('M 150 140 L 260 170'))
    obj.set({ scaleX: 2, scaleY: 1.5 })
    const before = strokeSceneMatrices(obj)
    const layer = fabricObjectToShapeLayer(obj)
    expect(layer.width).toBeCloseTo(400)
    const rebuilt = shapeLayerToFabricObject(layer)
    expect(rebuilt.scaleX).toBe(1)
    expectMatClose(strokeSceneMatrices(rebuilt)[0]!, before[0]!)
    // ...and the keep-rect covers the bigger rebuilt shape (the "cropped after resize" bug).
    expect((rebuilt.clipPath as fabric.Group).width).toBeGreaterThan(rebuilt.width!)
  })

  it('round-trips a resized pen path (scale baked into its points)', () => {
    const pathLayer: PathObjectLayer = {
      type: 'path', id: 'p1', x: 100, y: 100, width: 200, height: 50, rotation: 0,
      strokeColor: '#000', strokeWidth: 4, points: [{ x: 0, y: 0 }, { x: 200, y: 50 }],
    }
    const obj = pathLayerToFabricPath(pathLayer)
    commitEraseStroke(obj, brushPath('M 190 110 L 210 140'))
    obj.set({ scaleX: 1.5, scaleY: 1.5 })
    const before = strokeSceneMatrices(obj)
    const rebuilt = pathLayerToFabricPath(fabricPathToLayer(obj))
    expectMatClose(strokeSceneMatrices(rebuilt)[0]!, before[0]!)
  })

  it('survives save/load (JSON + migrateLayer)', () => {
    const obj = shapeLayerToFabricObject(rect())
    commitEraseStroke(obj, brushPath('M 150 140 L 260 170'))
    const before = strokeSceneMatrices(obj)
    const loaded = migrateLayer(JSON.parse(JSON.stringify(fabricObjectToShapeLayer(obj)))) as ShapeObjectLayer
    expect(loaded.erasures).toHaveLength(1)
    expectMatClose(strokeSceneMatrices(shapeLayerToFabricObject(loaded))[0]!, before[0]!)
  })
})

describe('fitEraseMask', () => {
  it('keeps holes over the same glyphs when text grows while typing', () => {
    const text = textLayerToFabricIText(
      { type: 'text', id: 't1', text: 'HELLO', x: 100, y: 100, width: 100, height: 30, rotation: 0, font: 'Arial', fontSize: 24, color: '#000' },
      1
    )
    commitEraseStroke(text, brushPath('M 105 100 L 105 130'))
    const leftEdgeX = () => text.getCenterPoint().x - text.width! / 2
    const holeX = () => strokeSceneMatrices(text)[0]![4]
    const offsetBefore = holeX() - leftEdgeX()
    // Typing more grows the box symmetrically about the (fixed) centre; the glyphs stay
    // anchored to the left edge, so the hole must keep its offset from that edge.
    text.width = text.width! + 60
    expect(fitEraseMask(text)).toBe(true)
    expect(holeX() - leftEdgeX()).toBeCloseTo(offsetBefore, 3)
    expect((text.clipPath as fabric.Group).width).toBeGreaterThan(text.width)
    expect(fitEraseMask(text)).toBe(false) // nothing changed since → no-op
  })
})

describe('pushGroupEraseMaskToChildren', () => {
  it('hands a group stroke to only the children it crosses, at the same scene spot', async () => {
    const g = await layerToFabricGroup(
      {
        type: 'group', id: 'g', x: 100, y: 100, width: 300, height: 100, rotation: 0,
        children: [rect({ id: 'a', x: -150, y: -50, width: 100, height: 100 }), rect({ id: 'b', x: 50, y: -50, width: 100, height: 100 })],
      },
      1
    )
    const src = brushPath('M 120 150 L 160 150') // over child a (scene x 100..200) only
    commitEraseStroke(g, src)
    pushGroupEraseMaskToChildren(g)
    expect(g.clipPath).toBeUndefined()
    const [a, b] = g.getObjects()
    expect(strokeSceneMatrices(a!)).toHaveLength(1)
    expect(strokeSceneMatrices(b!)).toHaveLength(0)
    expectMatClose(strokeSceneMatrices(a!)[0]!, src.calcTransformMatrix())
    // ...and still there once Fabric re-planes the children out of the group (ungroup).
    g.removeAll()
    expectMatClose(strokeSceneMatrices(a!)[0]!, src.calcTransformMatrix())
  })
})

describe('groups keep erased, pen and nested children', () => {
  const pen: PathObjectLayer = {
    type: 'path', id: 'pen', x: -100, y: -20, width: 80, height: 40, rotation: 0,
    strokeColor: '#000', strokeWidth: 4, points: [{ x: 0, y: 0 }, { x: 80, y: 40 }],
  }

  it('round-trips a pen-path child (was dropped before)', async () => {
    const g = await layerToFabricGroup(
      { type: 'group', id: 'g', x: 100, y: 100, width: 200, height: 60, rotation: 0, children: [pen, rect({ id: 's', x: 20, y: -30, width: 80, height: 60 })] },
      1
    )
    const back = fabricGroupToLayer(g, 1)
    const p = back.children.find((c) => c.id === 'pen') as PathObjectLayer
    expect(p?.type).toBe('path')
    expect(Math.abs(p.x - pen.x)).toBeLessThan(2) // group-local, not canvas coordinates (~0)
    // ...and it doesn't drift on screen across a rebuild.
    const sceneCenter = (grp: fabric.Group) => grp.getObjects().find((o) => o.pathId === 'pen')!.getCenterPoint()
    const again = await layerToFabricGroup(back, 1)
    expect(sceneCenter(again).x).toBeCloseTo(sceneCenter(g).x, 3)
    expect(sceneCenter(again).y).toBeCloseTo(sceneCenter(g).y, 3)
  })

  it('round-trips a nested group child (was dropped before)', async () => {
    const inner: GroupObjectLayer = {
      type: 'group', id: 'inner', x: -100, y: -30, width: 80, height: 60, rotation: 0,
      children: [rect({ id: 'i1', x: -40, y: -30, width: 80, height: 60 })],
    }
    const g = await layerToFabricGroup(
      { type: 'group', id: 'outer', x: 100, y: 100, width: 200, height: 60, rotation: 0, children: [inner, rect({ id: 's', x: 20, y: -30, width: 80, height: 60 })] },
      1
    )
    const back = fabricGroupToLayer(g, 1)
    const n = back.children.find((c) => c.id === 'inner') as GroupObjectLayer
    expect(n?.type).toBe('group')
    expect(n.children.map((c) => c.id)).toEqual(['i1'])
    expect(Math.abs(n.x - inner.x)).toBeLessThan(2) // outer-group-local
    const sceneCenter = (grp: fabric.Group) => grp.getObjects().find((o) => o.groupId === 'inner')!.getCenterPoint()
    const again = await layerToFabricGroup(back, 1)
    expect(sceneCenter(again).x).toBeCloseTo(sceneCenter(g).x, 3)
  })

  it("keeps an erased child's hole through the group round-trip", async () => {
    const child = shapeLayerToFabricObject(rect({ id: 'e', x: 100, y: 100, width: 100, height: 100 }))
    commitEraseStroke(child, brushPath('M 120 150 L 160 150'))
    const other = shapeLayerToFabricObject(rect({ id: 'o', x: 300, y: 100, width: 100, height: 100 }))
    const before = strokeSceneMatrices(child)
    const g = new fabric.Group([child, other], { originX: 'center', originY: 'center' }) // merge
    const rebuilt = await layerToFabricGroup(fabricGroupToLayer(g, 1), 1)
    const e = rebuilt.getObjects().find((o) => o.shapeId === 'e')!
    expectMatClose(strokeSceneMatrices(e)[0]!, before[0]!)
  })
})
