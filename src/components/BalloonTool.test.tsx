import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import Canvas from './Canvas'
import { BalloonObjectLayer } from '../types/layers'

// Mock getBoundingClientRect to ensure consistent coordinate mapping
// This is crucial for JSDOM where layout defaults to 0x0
beforeAll(() => {
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
        width: 1000,
        height: 1000,
        top: 0,
        left: 0,
        bottom: 1000,
        right: 1000,
        x: 0,
        y: 0,
        toJSON: () => { },
    }))
})

const balloonLayer: BalloonObjectLayer = {
    type: 'balloon',
    id: 'balloon-1',
    kind: 'speech',
    x: 100,
    y: 100,
    width: 100,
    height: 100,
    rotation: 0,
    text: 'Test',
    font: 'Arial',
    fontSize: 20,
    color: '#000000',
}

const baseProps = {
    color: '#000000',
    font: 'Arial',
    fontSize: 20,
    panelData: null,
    layout: { rows: 1, columns: [1] },
    onCanvasChange: vi.fn(),
}

describe('Balloon Tool', () => {
    // Fabric's pointer pipeline can't be driven faithfully in jsdom, so (like the shape tests)
    // we exercise the deterministic wiring rather than a real drag-to-draw gesture.

    it('mounts with the balloon tool and an existing balloon without crashing', () => {
        const { container } = render(
            <Canvas
                {...baseProps}
                tool="balloon"
                balloonKind="speech"
                shapeLayers={[balloonLayer]}
                onShapeLayersChange={vi.fn()}
            />
        )
        expect(container.querySelectorAll('canvas').length).toBeGreaterThanOrEqual(1)
    })

    // Guard the same non-clobber invariant the shape tests cover: switching tools with no edit
    // must not wipe the balloon out of shapeLayers.
    const wipedTo = (fn: ReturnType<typeof vi.fn>) =>
        fn.mock.calls.some((c) => Array.isArray(c[0]) && c[0].length === 0)

    it('does not clobber balloons when switching tools (no edit)', async () => {
        const onShapeLayersChange = vi.fn()
        const { rerender } = render(
            <Canvas {...baseProps} tool="balloon" balloonKind="speech" shapeLayers={[balloonLayer]} onShapeLayersChange={onShapeLayersChange} />
        )
        rerender(
            <Canvas {...baseProps} tool="select" shapeLayers={[balloonLayer]} onShapeLayersChange={onShapeLayersChange} />
        )
        await waitFor(() => {})
        expect(wipedTo(onShapeLayersChange)).toBe(false)
    })

    it('keeps the canvas mounted and the balloon intact through pointer interaction', () => {
        const onShapeLayersChange = vi.fn()
        render(
            <Canvas
                {...baseProps}
                tool="select"
                onShapeLayersChange={onShapeLayersChange}
                shapeLayers={[balloonLayer]}
            />
        )

        const canvas = screen.getByTestId('canvas') as HTMLCanvasElement
        Object.defineProperty(canvas, 'width', { value: 1000 })
        Object.defineProperty(canvas, 'height', { value: 1000 })
        fireEvent.mouseDown(canvas, { clientX: 150, clientY: 150 })
        fireEvent.mouseUp(canvas)
        fireEvent.mouseDown(canvas, { clientX: 150, clientY: 150 })

        // jsdom can't resolve Fabric hit-testing, but the interaction must not crash the
        // component or wipe the balloon out of the model.
        expect(screen.getByTestId('canvas')).toBeInTheDocument()
        expect(wipedTo(onShapeLayersChange)).toBe(false)
    })
})
