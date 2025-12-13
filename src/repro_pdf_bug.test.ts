
import { describe, it, expect, vi } from 'vitest'
import { TextLayer } from './types/layers'
import { renderTextLayerOnContext } from './App'


describe('PDF Text Rendering Bug', () => {
    it('calculates font size correctly when getBoundingClientRect returns 0', () => {
        // Mock canvas and context
        const canvas = document.createElement('canvas')
        canvas.width = 1200
        canvas.height = 800

        // Mock getBoundingClientRect to return 0 (simulating off-screen canvas in node/jsdom or during export)
        vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
            width: 0,
            height: 0,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            x: 0,
            y: 0,
            toJSON: () => { }
        })

        const ctx = canvas.getContext('2d')!

        // Track what font is set
        let lastFont = ''
        Object.defineProperty(ctx, 'font', {
            set: (val) => { lastFont = val },
            get: () => lastFont
        })

        const textLayer: TextLayer = {
            id: '1',
            type: 'text',
            x: 100,
            y: 100,
            width: 200,
            height: 50,
            rotation: 0,
            text: 'Test Text',
            font: 'Arial',
            fontSize: 24,
            color: '#000000'
        }

        renderTextLayerOnContext(ctx, textLayer)

        // With the bug, scale is 0/1200 = 0.
        // fontSize / 0 = Infinity
        // So font becomes "Infinitypx Arial"

        // If fixed, it should handle 0 and fallback to scale 1 -> "24px Arial"

        console.log('Resulting font:', lastFont)
        expect(lastFont).not.toContain('Infinity')
        expect(lastFont).toBe('24px Arial')
    })
})
