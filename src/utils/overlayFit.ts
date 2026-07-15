/**
 * Fit the fixed 1200x800 internal canvas into its container at a 3:2 aspect ratio.
 *
 * Returns the display size and the scale (display px per internal px) — used both to CSS-size the
 * Fabric overlay and to convert CSS font sizes to canvas-internal units. Falls back to 1:1 (and the
 * full internal size) when the container isn't measurable yet, e.g. in jsdom where layout is 0x0.
 */
export const fitOverlay = (
  container: { clientWidth: number; clientHeight: number } | null
): { width: number; height: number; scale: number } => {
  const cw = container?.clientWidth ?? 0
  const ch = container?.clientHeight ?? 0
  if (!cw || !ch) return { width: 1200, height: 800, scale: 1 }
  const scale = Math.min(cw / 1200, ch / 800)
  return { width: 1200 * scale, height: 800 * scale, scale }
}
