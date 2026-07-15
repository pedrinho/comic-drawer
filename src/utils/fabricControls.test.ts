import { describe, it, expect, vi } from 'vitest'
import * as fabric from 'fabric'
import { createObjectControls } from './fabricControls'
import { ObjectOps } from './objectOps'

/**
 * Unit tests for the on-selection controls + mode-gated interactivity (Phase 4 of the Canvas
 * refactor).
 */

const makeOps = (): ObjectOps => ({
  duplicateObject: vi.fn(),
  deleteObject: vi.fn(),
  mergeSelection: vi.fn(),
  ungroupObject: vi.fn(),
})

describe('createObjectControls — applyObjectControls', () => {
  it('stamps duplicate + delete controls and makes objects interactive in select mode', () => {
    const { applyObjectControls } = createObjectControls(makeOps(), { mode: 'select', isCreationMode: false })
    const o = new fabric.Rect({})
    applyObjectControls(o)
    expect(o.controls.dup).toBeInstanceOf(fabric.Control)
    expect(o.controls.del).toBeInstanceOf(fabric.Control)
    expect(o.selectable).toBe(true)
    expect(o.evented).toBe(true)
  })

  it('adds the ungroup control only to groups', () => {
    const { applyObjectControls } = createObjectControls(makeOps(), { mode: 'select', isCreationMode: false })
    const rectO = new fabric.Rect({})
    const groupO = new fabric.Group([])
    applyObjectControls(rectO)
    applyObjectControls(groupO)
    expect(rectO.controls.ung).toBeUndefined()
    expect(groupO.controls.ung).toBeInstanceOf(fabric.Control)
  })

  it('makes objects a non-interactive backdrop in raster modes (pen)', () => {
    const { applyObjectControls } = createObjectControls(makeOps(), { mode: 'pen', isCreationMode: false })
    const o = new fabric.Rect({})
    applyObjectControls(o)
    expect(o.selectable).toBe(false)
    expect(o.evented).toBe(false)
  })

  it('keeps objects evented (not selectable) in fill mode for click-to-colour hit-testing', () => {
    const { applyObjectControls } = createObjectControls(makeOps(), { mode: 'fill', isCreationMode: false })
    const o = new fabric.Rect({})
    applyObjectControls(o)
    expect(o.selectable).toBe(false)
    expect(o.evented).toBe(true)
    expect(o.hoverCursor).toBe('pointer')
  })

  it('exposes objects during creation modes so existing objects can still be picked', () => {
    const { applyObjectControls } = createObjectControls(makeOps(), { mode: 'shape', isCreationMode: true })
    const o = new fabric.Rect({})
    applyObjectControls(o)
    expect(o.selectable).toBe(true)
    expect(o.evented).toBe(true)
  })
})

describe('createObjectControls — control handlers invoke ops', () => {
  it('routes the duplicate/delete controls to their ops with the control target', () => {
    const ops = makeOps()
    const { applyObjectControls } = createObjectControls(ops, { mode: 'select', isCreationMode: false })
    const o = new fabric.Rect({})
    applyObjectControls(o)

    o.controls.dup.mouseUpHandler?.({} as any, { target: o } as any, 0, 0)
    o.controls.del.mouseUpHandler?.({} as any, { target: o } as any, 0, 0)
    expect(ops.duplicateObject).toHaveBeenCalledWith(o)
    expect(ops.deleteObject).toHaveBeenCalledWith(o)
  })

  it('routes the merge control to mergeSelection', () => {
    const ops = makeOps()
    const { mergeControl } = createObjectControls(ops, { mode: 'select', isCreationMode: false })
    expect(mergeControl).toBeInstanceOf(fabric.Control)
    mergeControl.mouseUpHandler?.({} as any, { target: new fabric.Rect({}) } as any, 0, 0)
    expect(ops.mergeSelection).toHaveBeenCalled()
  })
})
