import { describe, it, expect, vi } from 'vitest'
import * as fabric from 'fabric'
import { createObjectOps, ObjectOpsDeps } from './objectOps'
import { shapeLayerToFabricObject } from './fabricShapes'
import { pathLayerToFabricPath, PATH_ID_KEY } from './fabricPath'
import { fabricObjectKind } from './fabricImage'
import { GROUP_ID_KEY } from './fabricGroup'

/**
 * Unit tests for the object-management ops (Phase 4 of the Canvas refactor). Driven directly on a
 * real `fabric.Canvas` with stubbed `syncToLayers`/`applyControls`.
 */

const makeCanvas = () => new fabric.Canvas(document.createElement('canvas'), { width: 1200, height: 800 })

const makeDeps = (over: Partial<ObjectOpsDeps> = {}): ObjectOpsDeps => ({
  syncToLayers: vi.fn(),
  scale: 1,
  isDisposed: () => false,
  applyControls: vi.fn(),
  ...over,
})

const rect = () =>
  shapeLayerToFabricObject({
    type: 'shape', id: 's1', shape: 'rectangle', x: 100, y: 100, width: 60, height: 40,
    rotation: 0, strokeColor: '#000000', strokeWidth: 2, fillColor: null,
  })

describe('deleteObject', () => {
  it('removes the object, clears selection, and syncs', () => {
    const canvas = makeCanvas()
    const deps = makeDeps()
    const ops = createObjectOps(canvas, deps)
    const o = rect()
    canvas.add(o)
    canvas.setActiveObject(o)

    ops.deleteObject(o)
    expect(canvas.getObjects()).not.toContain(o)
    expect(canvas.getActiveObject()).toBeFalsy()
    expect(deps.syncToLayers).toHaveBeenCalledWith(false)
  })

  it('no-ops on a null object', () => {
    const canvas = makeCanvas()
    const deps = makeDeps()
    createObjectOps(canvas, deps).deleteObject(null)
    expect(deps.syncToLayers).not.toHaveBeenCalled()
  })
})

describe('duplicateObject', () => {
  it('clones a shape offset by 30px, applies controls, activates it, and syncs', () => {
    const canvas = makeCanvas()
    const deps = makeDeps()
    const ops = createObjectOps(canvas, deps)
    const o = rect()
    canvas.add(o)

    ops.duplicateObject(o)
    expect(canvas.getObjects().length).toBe(2)
    const clone = canvas.getObjects()[1]
    expect(clone).toBe(canvas.getActiveObject())
    expect(deps.applyControls).toHaveBeenCalledWith(clone)
    expect(deps.syncToLayers).toHaveBeenCalledWith(false)
    expect((clone.left ?? 0) - (o.left ?? 0)).toBeCloseTo(30)
  })

  it('clones a pen path as a path (not a squared rectangle)', () => {
    const canvas = makeCanvas()
    const deps = makeDeps()
    const ops = createObjectOps(canvas, deps)
    const path = pathLayerToFabricPath({
      type: 'path', id: 'p1', x: 10, y: 10, width: 50, height: 40, rotation: 0,
      strokeColor: '#ff0000', strokeWidth: 3, fillColor: null, points: [{ x: 0, y: 0 }, { x: 50, y: 40 }],
    })
    canvas.add(path)

    ops.duplicateObject(path)
    const clone = canvas.getObjects()[1]
    expect(clone[PATH_ID_KEY]).toBeTruthy()
    expect(fabricObjectKind(clone)).toBe('path')
  })
})

describe('mergeSelection / ungroupObject', () => {
  it('merges a 2-object active selection into a tagged group and syncs', () => {
    const canvas = makeCanvas()
    const deps = makeDeps()
    const ops = createObjectOps(canvas, deps)
    const a = rect(), b = rect()
    canvas.add(a, b)
    canvas.setActiveObject(new fabric.ActiveSelection([a, b], { canvas }))

    ops.mergeSelection()
    const active = canvas.getActiveObject()
    expect(active).toBeInstanceOf(fabric.Group)
    expect(active?.[GROUP_ID_KEY]).toBeTruthy()
    expect(deps.applyControls).toHaveBeenCalledWith(active)
    expect(deps.syncToLayers).toHaveBeenCalledWith(false)
  })

  it('ungroups a group back into its children, applying controls to each', () => {
    const canvas = makeCanvas()
    const deps = makeDeps()
    const ops = createObjectOps(canvas, deps)
    const group = new fabric.Group([rect(), rect()], { originX: 'center', originY: 'center' })
    canvas.add(group)

    ops.ungroupObject(group)
    expect(canvas.getObjects()).not.toContain(group)
    expect(canvas.getObjects().length).toBe(2)
    expect(deps.applyControls).toHaveBeenCalledTimes(2)
    expect(deps.syncToLayers).toHaveBeenCalledWith(false)
  })

  it('ungroupObject no-ops on a non-group', () => {
    const canvas = makeCanvas()
    const deps = makeDeps()
    createObjectOps(canvas, deps).ungroupObject(rect())
    expect(deps.syncToLayers).not.toHaveBeenCalled()
  })
})
