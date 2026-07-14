import { ObjectLayer, TextLayer } from './layers'

export type Tool = 'select' | 'scissor' | 'pen' | 'eraser' | 'objectShapes' | 'text' | 'fill' | 'balloon' | 'emoji'
export type Shape = 'rectangle' | 'circle' | 'triangle' | 'star' | 'heart' | 'diamond' | 'hexagon' | 'pentagon' | 'arrow' | 'cross' | 'heptagon' | 'octagon'
export type PenType = 'fine' | 'small' | 'medium' | 'large' | 'thick' | 'verythick'
// Balloon (speech-bubble) variants. Only 'speech' exists today; the tool and converter are
// structured so adding 'thought' | 'shout' | 'angry' | … is one registry entry + one path fn.
export type BalloonKind = 'speech'

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
