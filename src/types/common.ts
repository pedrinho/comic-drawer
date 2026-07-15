import { ObjectLayer, TextLayer } from './layers'

export type Tool = 'select' | 'scissor' | 'pen' | 'eraser' | 'objectShapes' | 'text' | 'fill' | 'balloon' | 'emoji'
export type Shape = 'rectangle' | 'circle' | 'triangle' | 'star' | 'heart' | 'diamond' | 'hexagon' | 'pentagon' | 'arrow' | 'cross' | 'heptagon' | 'octagon'
export type PenType = 'fine' | 'small' | 'medium' | 'large' | 'thick' | 'verythick'
// Balloon (speech-bubble) variants. Only 'speech' exists today; the tool and converter are
// structured so adding 'thought' | 'shout' | 'angry' | … is one registry entry + one path fn.
export type BalloonKind = 'speech'

// The active interaction mode of the Fabric overlay, derived from the current `Tool` (see
// `toolToMode`). `emoji` collapses into `text` (it places a fabric.IText holding the glyph);
// `null` means no Fabric-owned mode is active.
export type Mode = 'shape' | 'balloon' | 'text' | 'select' | 'fill' | 'pen' | 'eraser' | 'scissor' | null

export interface PanelData {
    id: number
    name: string
    data: ImageData | null
    layout: {
        rows: number
        columns: number[]
    }
    shapeLayers: ObjectLayer[]
    textLayers: TextLayer[]
}

export interface SavedPanel {
    id: number
    name?: string  // Optional for backward compatibility
    data: string | null  // Base64 encoded ImageData
    layout: {
        rows: number
        columns: number[]
    }
    shapeLayers?: ObjectLayer[]
    textLayers?: TextLayer[]
}

export interface ComicFile {
    version: string
    panels: SavedPanel[]
}

export interface PanelState {
    data: ImageData | null
    shapeLayers: ObjectLayer[]
    textLayers: TextLayer[]
}

export interface PanelHistory {
    undo: PanelState[]
    redo: PanelState[]
}
