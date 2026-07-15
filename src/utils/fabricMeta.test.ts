import { describe, it, expect } from 'vitest'
import * as fabric from 'fabric'
import { isActiveSelection, isEditingText, getScenePoint } from './fabricMeta'

describe('isActiveSelection', () => {
  it('is true for a multi-select ActiveSelection', () => {
    const sel = new fabric.ActiveSelection([new fabric.Rect(), new fabric.Rect()])
    expect(isActiveSelection(sel)).toBe(true)
  })

  it('is false for a plain object and for null', () => {
    expect(isActiveSelection(new fabric.Rect())).toBe(false)
    expect(isActiveSelection(null)).toBe(false)
    expect(isActiveSelection(undefined)).toBe(false)
  })
})

describe('isEditingText', () => {
  it('is true only for an IText in edit mode', () => {
    const text = new fabric.IText('hi')
    expect(isEditingText(text)).toBe(false)
    text.isEditing = true
    expect(isEditingText(text)).toBe(true)
  })

  it('is false for non-text objects and null', () => {
    expect(isEditingText(new fabric.Rect())).toBe(false)
    expect(isEditingText(null)).toBe(false)
  })
})

describe('getScenePoint', () => {
  const pt = new fabric.Point(3, 4)

  it('prefers getScenePoint when available', () => {
    const canvas = { getScenePoint: () => pt } as unknown as fabric.Canvas
    expect(getScenePoint(canvas, {} as fabric.TPointerEvent)).toBe(pt)
  })

  it('falls back to getPointer for the legacy API', () => {
    const canvas = { getPointer: () => pt } as unknown as fabric.Canvas
    expect(getScenePoint(canvas, {} as fabric.TPointerEvent)).toBe(pt)
  })
})
