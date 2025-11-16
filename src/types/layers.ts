import { Shape } from '../App'

export interface ShapeLayer {
  id: string
  shape: Shape
  x: number
  y: number
  width: number
  height: number
  rotation: number
  strokeColor: string
  strokeWidth: number
  fillColor: string | null
}

export interface TextLayer {
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  font: string
  fontSize: number
  color: string
}

