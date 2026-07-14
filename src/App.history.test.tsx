import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ObjectLayer } from './types/layers'

// The real Canvas is a Fabric component that jsdom can't drive. We replace it with a double that
// (a) reports the shapeLayers App feeds it (via a data attribute) and (b) lets the test invoke the
// onShapeLayersChange callback to simulate a completed edit. That isolates App's undo/redo/history
// logic — the highest-risk untested code — and drives it end-to-end through the real Undo/Redo UI.
const hoisted = vi.hoisted(() => ({ lastProps: null as any }))

vi.mock('./components/Canvas', () => ({
  default: (props: any) => {
    hoisted.lastProps = props
    return (
      <div
        data-testid="canvas-mock"
        data-layer-ids={(props.shapeLayers ?? []).map((l: any) => l.id).join(',')}
      />
    )
  },
}))

import App from './App'

const makeShape = (id: string): ObjectLayer => ({
  type: 'shape',
  id,
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  rotation: 0,
  strokeColor: '#000000',
  strokeWidth: 2,
  fillColor: null,
})

const currentIds = () => screen.getByTestId('canvas-mock').getAttribute('data-layer-ids')

// Simulate the Canvas finishing an edit and pushing the new layer set up to App.
const emit = (ids: string[]) =>
  act(() => {
    hoisted.lastProps.onShapeLayersChange(ids.map(makeShape))
  })

describe('App undo/redo history', () => {
  beforeEach(() => {
    hoisted.lastProps = null
  })

  it('starts empty and reflects edits pushed from the canvas', () => {
    render(<App />)
    expect(currentIds()).toBe('')
    emit(['a'])
    expect(currentIds()).toBe('a')
  })

  it('undo restores the previous layer set, redo re-applies it', async () => {
    const user = userEvent.setup()
    render(<App />)

    emit(['a'])
    emit(['a', 'b'])
    expect(currentIds()).toBe('a,b')

    await user.click(screen.getByTitle(/Undo/))
    expect(currentIds()).toBe('a')

    await user.click(screen.getByTitle(/Undo/))
    expect(currentIds()).toBe('')

    await user.click(screen.getByTitle(/Redo/))
    expect(currentIds()).toBe('a')

    await user.click(screen.getByTitle(/Redo/))
    expect(currentIds()).toBe('a,b')
  })

  it('is a no-op when there is nothing to undo/redo', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByTitle(/Undo/)) // empty undo stack
    expect(currentIds()).toBe('')
    await user.click(screen.getByTitle(/Redo/)) // empty redo stack
    expect(currentIds()).toBe('')
  })

  it('clears the redo stack when a new edit is made after an undo', async () => {
    const user = userEvent.setup()
    render(<App />)

    emit(['a'])
    emit(['b'])
    await user.click(screen.getByTitle(/Undo/)) // back to 'a', redo now holds 'b'
    expect(currentIds()).toBe('a')

    emit(['c']) // new action must discard the redo entry
    expect(currentIds()).toBe('c')

    await user.click(screen.getByTitle(/Redo/)) // nothing to redo
    expect(currentIds()).toBe('c')
  })

  it('caps the undo stack at MAX_HISTORY (10), dropping the oldest states', async () => {
    const user = userEvent.setup()
    render(<App />)

    // 12 edits '1'..'12'. Each edit pushes the PREVIOUS state, so the undo stack receives
    // [empty,1,2,...,11] (12 entries) and is trimmed to the most recent 10 ([2..11]).
    for (let i = 1; i <= 12; i++) emit([String(i)])
    expect(currentIds()).toBe('12')

    // 10 undos are possible; they walk back 11 -> 2. Extra undos are no-ops, never reaching '1' or ''.
    for (let i = 0; i < 15; i++) await user.click(screen.getByTitle(/Undo/))
    expect(currentIds()).toBe('2')
  })
})
