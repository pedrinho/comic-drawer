import { useEffect, useRef, MutableRefObject, RefObject } from 'react'
import * as fabric from 'fabric'
import { debugLog } from '../utils/canvasUtils'

export interface FabricCanvasHandles {
  /** ref for the <canvas> DOM element the Fabric canvas mounts onto. */
  fabricRef: RefObject<HTMLCanvasElement>
  /** the live fabric.Canvas instance — null before init and after dispose. */
  fabricCanvasRef: MutableRefObject<fabric.Canvas | null>
}

/**
 * Own the single interactive Fabric canvas: create it on mount at the fixed 1200x800 internal
 * resolution, dispose it on unmount. Returns the element ref (for the JSX `<canvas>`) and the
 * instance ref that the sizing + controller hooks read.
 */
export const useFabricCanvas = (): FabricCanvasHandles => {
  const fabricRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null)

  useEffect(() => {
    if (!fabricRef.current) return

    // Dispose if already exists
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose()
    }

    const canvas = new fabric.Canvas(fabricRef.current, {
      width: 1200,
      height: 800,
      selection: true, // Enable selection for Fabric objects
      renderOnAddRemove: true,
    })

    fabricCanvasRef.current = canvas
    debugLog('Canvas', 'Fabric.js initialized')

    return () => {
      canvas.dispose()
      fabricCanvasRef.current = null
    }
  }, [])

  return { fabricRef, fabricCanvasRef }
}
