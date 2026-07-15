import { Tool, Mode } from '../types/common'

/**
 * Resolve the active Fabric overlay `Mode` from the current `Tool`.
 *
 * Fabric-owned tools (objectShapes/balloon/text/emoji/select) create and transform objects on the
 * overlay; the raster tools (fill/pen/eraser/scissor) paint on the raster backing. `emoji` maps to
 * `text` because it places a `fabric.IText` holding the emoji glyph. Any unknown tool → `null`.
 */
export const toolToMode = (tool: Tool): Mode => {
  switch (tool) {
    case 'objectShapes': return 'shape'
    case 'balloon': return 'balloon'
    case 'text':
    case 'emoji': return 'text'
    case 'select': return 'select'
    case 'fill': return 'fill'
    case 'pen': return 'pen'
    case 'eraser': return 'eraser'
    case 'scissor': return 'scissor'
    default: return null
  }
}
