import { describe, it, expect } from 'vitest'
import * as fabric from 'fabric'
import { GroupObjectLayer, ShapeObjectLayer, TextObjectLayer, BalloonObjectLayer, migrateLayer, isGroupObjectLayer } from '../types/layers'
import { layerToFabricGroup, fabricGroupToLayer } from './fabricGroup'
import { balloonLayerToFabricObject, isFabricBalloon } from './fabricBalloon'
import { shapeLayerToFabricObject } from './fabricShapes'

const shapeChild = (id: string, x: number): ShapeObjectLayer => ({
  type: 'shape', id, shape: 'rectangle', x, y: -20, width: 40, height: 40,
  rotation: 0, strokeColor: '#000000', strokeWidth: 2, fillColor: null,
})
const textChild = (id: string, x: number): TextObjectLayer => ({
  type: 'text', id, text: 'hi', x, y: 0, width: 30, height: 20,
  rotation: 0, font: 'Arial', fontSize: 20, color: '#000000',
})

const groupLayer = (): GroupObjectLayer => ({
  type: 'group', id: 'g1', x: 100, y: 80, width: 120, height: 60, rotation: 0,
  children: [shapeChild('c1', -50), textChild('c2', 10)],
})

describe('fabricGroup conversion', () => {
  it('round-trips a group: child count, ids, kinds, and group id preserved', async () => {
    const group = await layerToFabricGroup(groupLayer(), 1)
    expect(group.getObjects().length).toBe(2)

    const back = fabricGroupToLayer(group, 1)
    expect(back.type).toBe('group')
    expect(back.id).toBe('g1')
    expect(back.children.length).toBe(2)
    expect(back.children.map((c) => c.type).sort()).toEqual(['shape', 'text'])
    expect(back.children.map((c) => c.id).sort()).toEqual(['c1', 'c2'])
  })

  it('migrateLayer recursively migrates group children (adds missing type)', () => {
    const raw: any = {
      type: 'group', id: 'g', x: 0, y: 0, width: 10, height: 10, rotation: 0,
      children: [{ id: 'c', x: 0, y: 0, width: 5, height: 5, rotation: 0, shape: 'circle', strokeColor: '#000', strokeWidth: 2 }],
    }
    const migrated = migrateLayer(raw)
    expect(isGroupObjectLayer(migrated)).toBe(true)
    if (isGroupObjectLayer(migrated)) {
      expect(migrated.children).toHaveLength(1)
      expect(migrated.children[0].type).toBe('shape')
    }
  })

  it('keeps a merged speech balloon a balloon (it used to come back as a rectangle)', async () => {
    const balloon: BalloonObjectLayer = {
      type: 'balloon', id: 'b1', kind: 'speech', x: 100, y: 100, width: 160, height: 100, rotation: 0,
      text: '', font: 'Arial', fontSize: 24, color: '#ff0000',
    }
    // Merge exactly as the ⊕ control does: a fabric.Group of the live canvas objects.
    const merged = new fabric.Group(
      [balloonLayerToFabricObject(balloon), shapeLayerToFabricObject(shapeChild('s1', 400))],
      { originX: 'center', originY: 'center' }
    )
    const layer = fabricGroupToLayer(merged, 1)
    const child = layer.children.find((c) => c.id === 'b1')
    expect(child?.type).toBe('balloon')
    expect((child as BalloonObjectLayer).kind).toBe('speech')
    expect((child as BalloonObjectLayer).color).toBe('#ff0000')

    // Rebuild (tool switch / undo / reload) → still a balloon, at the same place on screen.
    const rebuilt = await layerToFabricGroup(layer, 1)
    const before = merged.getObjects().find(isFabricBalloon)!.getCenterPoint()
    const after = rebuilt.getObjects().find(isFabricBalloon)
    expect(after).toBeDefined()
    expect(after!.getCenterPoint().x).toBeCloseTo(before.x, 3)
    expect(after!.getCenterPoint().y).toBeCloseTo(before.y, 3)
  })
})
