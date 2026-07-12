import { Shape } from './common'

/**
 * Base properties shared by all object layers
 */
export interface BaseObjectLayer {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

/**
 * Shape object layer
 */
export interface ShapeObjectLayer extends BaseObjectLayer {
  type: 'shape'
  shape: Shape
  strokeColor: string
  strokeWidth: number
  fillColor: string | null
}

/**
 * Text object layer
 */
export interface TextObjectLayer extends BaseObjectLayer {
  type: 'text'
  text: string
  font: string
  fontSize: number
  color: string
}

/**
 * Path object layer (for freehand drawing)
 */
export interface PathObjectLayer extends BaseObjectLayer {
  type: 'path'
  points: { x: number; y: number }[]
  strokeColor: string
  strokeWidth: number
}

/**
 * Image object layer (created by scissor tool)
 */
export interface ImageObjectLayer extends BaseObjectLayer {
  type: 'image'
  data: string // base64 encoded image data
}

/**
 * Balloon object layer
 */
export interface BalloonObjectLayer extends BaseObjectLayer {
  type: 'balloon'
  text: string
  font: string
  fontSize: number
  color: string
}

/**
 * Group object layer — several objects merged into one unit.
 * `children` are stored in GROUP-LOCAL coordinates (relative to the group centre); the
 * group's own x/y/width/height/rotation describe its absolute placement on the canvas.
 */
export interface GroupObjectLayer extends BaseObjectLayer {
  type: 'group'
  children: ObjectLayer[]
}

/**
 * Union type for all object layers
 * Add new object types here as discriminated union members
 */
export type ObjectLayer = ShapeObjectLayer | TextObjectLayer | PathObjectLayer | ImageObjectLayer | BalloonObjectLayer | GroupObjectLayer

/**
 * Type guards for object layers
 */
export function isShapeObjectLayer(layer: ObjectLayer): layer is ShapeObjectLayer {
  return layer.type === 'shape'
}

export function isTextObjectLayer(layer: ObjectLayer): layer is TextObjectLayer {
  return layer.type === 'text'
}

export function isPathObjectLayer(layer: ObjectLayer): layer is PathObjectLayer {
  return layer.type === 'path'
}

export function isImageObjectLayer(layer: ObjectLayer): layer is ImageObjectLayer {
  return layer.type === 'image'
}

export function isBalloonObjectLayer(layer: ObjectLayer): layer is BalloonObjectLayer {
  return layer.type === 'balloon'
}

export function isGroupObjectLayer(layer: ObjectLayer): layer is GroupObjectLayer {
  return layer.type === 'group'
}

/**
 * Legacy type aliases for backward compatibility during migration
 * @deprecated Use ObjectLayer with type guards instead
 */
export type ShapeLayer = ShapeObjectLayer
export type TextLayer = TextObjectLayer
export type PathLayer = PathObjectLayer

/**
 * Migration helper: ensures old layers have the 'type' field
 * This is useful when loading old files that don't have the type discriminator
 */
export function migrateLayer(layer: Partial<ObjectLayer> & { id: string; x: number; y: number; width: number; height: number; rotation: number }): ObjectLayer {
  // Group: recursively migrate children, then return.
  if ('type' in layer && layer.type === 'group') {
    return {
      ...layer,
      type: 'group',
      children: migrateLayers((layer as any).children ?? []),
    } as GroupObjectLayer
  }

  // If type is already set, return as-is
  if ('type' in layer && (layer.type === 'shape' || layer.type === 'text' || layer.type === 'path' || layer.type === 'image')) {
    return layer as ObjectLayer
  }

  // Check for path properties
  if ('points' in layer) {
    return {
      ...layer,
      type: 'path',
      points: (layer as any).points || [],
      strokeColor: (layer as any).strokeColor || '#000000',
      strokeWidth: (layer as any).strokeWidth || 2,
    } as PathObjectLayer
  }

  // Otherwise, infer type from properties
  if ('shape' in layer || 'strokeColor' in layer || 'strokeWidth' in layer) {
    return {
      ...layer,
      type: 'shape',
      shape: (layer as any).shape || 'rectangle',
      strokeColor: (layer as any).strokeColor || '#000000',
      strokeWidth: (layer as any).strokeWidth || 2,
      fillColor: (layer as any).fillColor ?? null,
    } as ShapeObjectLayer
  }

  if ('text' in layer || 'font' in layer || 'fontSize' in layer || 'color' in layer) {
    return {
      ...layer,
      type: 'text',
      text: (layer as any).text || '',
      font: (layer as any).font || 'Arial',
      fontSize: (layer as any).fontSize || 24,
      color: (layer as any).color || '#000000',
    } as TextObjectLayer
  }

  // Default to shape if we can't determine
  return {
    ...layer,
    type: 'shape',
    shape: 'rectangle',
    strokeColor: '#000000',
    strokeWidth: 2,
    fillColor: null,
  } as ShapeObjectLayer
}

/**
 * Migrate an array of layers (useful when loading old files)
 */
export function migrateLayers(layers: Array<Partial<ObjectLayer> & { id: string; x: number; y: number; width: number; height: number; rotation: number }>): ObjectLayer[] {
  return layers.map(migrateLayer)
}

