/**
 * Stack-based flood fill over raw `ImageData`.
 *
 * Extracted verbatim from the pre-Fabric raster fill tool. The algorithm is deliberately pure
 * over an `ImageData` buffer (no canvas/context) so it's unit-testable and reusable: it mutates
 * `imageData.data` in place, and the caller is responsible for `getImageData`/`putImageData`.
 *
 * Matching is tolerant (10 for RGB, 5 for alpha) to absorb antialiasing, and a transparent target
 * (an erased region) matches other transparent pixels rather than their stale RGB.
 */
export const floodFillImageData = (
  imageData: ImageData,
  x: number,
  y: number,
  fillColor: string
): void => {
  const data = imageData.data
  const width = imageData.width
  const height = imageData.height

  // Get target color at the clicked point
  const clickedIndex = (Math.floor(y) * width + Math.floor(x)) * 4
  const targetR = data[clickedIndex]
  const targetG = data[clickedIndex + 1]
  const targetB = data[clickedIndex + 2]
  const targetA = data[clickedIndex + 3]

  // Check if target color is valid
  if (targetR === undefined || targetG === undefined || targetB === undefined || targetA === undefined) {
    return
  }

  // Parse fill color
  const fillR = parseInt(fillColor.slice(1, 3), 16)
  const fillG = parseInt(fillColor.slice(3, 5), 16)
  const fillB = parseInt(fillColor.slice(5, 7), 16)

  // Helper function to check if a pixel matches the target color (including alpha for erased areas)
  const matchesTargetColor = (r: number | undefined, g: number | undefined, b: number | undefined, a: number | undefined) => {
    if (r === undefined || g === undefined || b === undefined || a === undefined) {
      return false
    }
    const tolerance = 10 // Allow small differences for antialiasing
    const alphaTolerance = 5 // Tolerance for alpha channel

    // If target is transparent (erased), match transparent pixels
    if (targetA < alphaTolerance) {
      return a < alphaTolerance
    }

    // If target is opaque, match RGB values and ensure alpha is similar
    return Math.abs(r - targetR) <= tolerance &&
      Math.abs(g - targetG) <= tolerance &&
      Math.abs(b - targetB) <= tolerance &&
      Math.abs(a - targetA) <= alphaTolerance
  }

  // Stack-based flood fill
  const stack: Array<[number, number]> = [[Math.floor(x), Math.floor(y)]]
  const visited = new Set<string>()

  while (stack.length > 0) {
    const [px, py] = stack.pop()!
    const key = `${px},${py}`

    if (visited.has(key) || px < 0 || px >= width || py < 0 || py >= height) {
      continue
    }

    visited.add(key)

    const index = (py * width + px) * 4
    const r = data[index]
    const g = data[index + 1]
    const b = data[index + 2]
    const a = data[index + 3]

    // Fill pixels that match the target color (where we clicked)
    if (r !== undefined && g !== undefined && b !== undefined && a !== undefined && matchesTargetColor(r, g, b, a)) {
      // Fill this pixel
      data[index] = fillR
      data[index + 1] = fillG
      data[index + 2] = fillB
      data[index + 3] = 255 // Set alpha to opaque

      // Add neighbors to stack
      stack.push([px + 1, py])
      stack.push([px - 1, py])
      stack.push([px, py + 1])
      stack.push([px, py - 1])
    }
  }
}
