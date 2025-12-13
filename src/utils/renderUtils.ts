import { PathObjectLayer, ShapeLayer, TextLayer, ObjectLayer, isPathObjectLayer, isShapeObjectLayer } from '../types/layers'
import { traceShapePath } from './canvasUtils'

export const renderPathLayer = (ctx: CanvasRenderingContext2D, layer: PathObjectLayer) => {
    const { x, y, width, height, rotation, strokeColor, strokeWidth, points } = layer
    const centerX = x + width / 2
    const centerY = y + height / 2

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(rotation)

    ctx.strokeStyle = strokeColor
    ctx.lineWidth = strokeWidth
    ctx.beginPath()

    if (points.length > 0 && points[0]) {
        // Offset points to center them around (0,0) in the rotated context
        const offsetX = -width / 2
        const offsetY = -height / 2

        ctx.moveTo(points[0].x + offsetX, points[0].y + offsetY)
        for (let i = 1; i < points.length; i++) {
            const p = points[i]
            if (p) ctx.lineTo(p.x + offsetX, p.y + offsetY)
        }
    }

    ctx.stroke()
    ctx.restore()
}

export const renderShapeLayer = (ctx: CanvasRenderingContext2D, layer: ShapeLayer) => {
    const { x, y, width, height, rotation, strokeColor, strokeWidth, fillColor, shape } = layer
    const centerX = x + width / 2
    const centerY = y + height / 2
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(rotation)
    traceShapePath(ctx, shape, -width / 2, -height / 2, width / 2, height / 2)
    if (fillColor) {
        ctx.fillStyle = fillColor
        ctx.fill()
    }
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = strokeWidth
    ctx.stroke()
    ctx.restore()
}

export const renderTextLayer = (ctx: CanvasRenderingContext2D, layer: TextLayer) => {
    const canvas = ctx.canvas
    const { x, y, width, height, rotation, text, font: layerFont, fontSize: layerFontSize, color: layerColor } = layer
    const centerX = x + width / 2
    const centerY = y + height / 2

    // Calculate current scale factor for consistent rendering
    // In test environment, getBoundingClientRect may not be available
    let scale = 1
    try {
        const rect = canvas.getBoundingClientRect()
        if (rect && rect.width && rect.height) {
            const scaleX = rect.width / canvas.width
            const scaleY = rect.height / canvas.height
            scale = (scaleX + scaleY) / 2
        }
    } catch {
        // In test environment, use default scale
        scale = 1
    }

    // Scale fontSize to match visual size (layerFontSize is stored in CSS pixels, need to scale up for canvas)
    const scaledFontSize = layerFontSize / scale

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(rotation)
    ctx.fillStyle = layerColor
    ctx.font = `${scaledFontSize}px ${layerFont}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 0, 0)
    ctx.restore()
}

export const renderObjectLayer = (ctx: CanvasRenderingContext2D, layer: ObjectLayer) => {
    if (isPathObjectLayer(layer)) {
        renderPathLayer(ctx, layer)
    } else if (isShapeObjectLayer(layer)) {
        renderShapeLayer(ctx, layer)
    }
}
