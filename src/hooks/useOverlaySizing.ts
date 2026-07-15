import { useEffect, MutableRefObject, RefObject } from 'react'
import * as fabric from 'fabric'
import { fitOverlay } from '../utils/overlayFit'

/**
 * Keep the Fabric overlay's CSS size matched to its container at all times — in every tool, and on
 * any window/layout resize. Without this the overlay only resized while a Fabric tool was active, so
 * resizing in pen/eraser mode left it mismatched (its edge sticking out past the canvas corner).
 * Internal resolution stays 1200x800; only the CSS size changes.
 */
export const useOverlaySizing = (
  containerRef: RefObject<HTMLDivElement>,
  fabricCanvasRef: MutableRefObject<fabric.Canvas | null>
) => {
  useEffect(() => {
    const box = containerRef.current
    if (!box) return
    const sync = () => {
      const fc = fabricCanvasRef.current
      if (!fc) return
      const { width, height } = fitOverlay(containerRef.current)
      if (width && height) fc.setDimensions({ width, height }, { cssOnly: true })
    }
    sync()
    // ResizeObserver isn't available in jsdom (tests) — fall back to the window resize listener.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null
    ro?.observe(box)
    window.addEventListener('resize', sync)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', sync)
    }
    // Refs are stable — this runs once on mount, mirroring the original effect.
  }, [containerRef, fabricCanvasRef])
}
