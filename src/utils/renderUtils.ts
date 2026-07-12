import { PathObjectLayer, ShapeLayer, TextLayer, ObjectLayer, ImageObjectLayer, BalloonObjectLayer, GroupObjectLayer, isPathObjectLayer, isShapeObjectLayer, isImageObjectLayer, isBalloonObjectLayer, isGroupObjectLayer } from '../types/layers'
import { traceShapePath } from './canvasUtils'

// Simple image cache to avoid recreating HTMLImageElements every frame
const imageCache = new Map<string, HTMLImageElement>()
const pendingImages = new Set<string>()

export const preLoadImage = (base64: string): Promise<void> => {
    if (imageCache.has(base64) || pendingImages.has(base64)) return Promise.resolve()

    pendingImages.add(base64)
    return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
            imageCache.set(base64, img)
            pendingImages.delete(base64)
            resolve()
        }
        img.onerror = () => {
            pendingImages.delete(base64)
            resolve() // Resolve anyway to avoid hanging
        }
        img.src = base64
    })
}

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

export const renderImageLayer = (ctx: CanvasRenderingContext2D, layer: ImageObjectLayer) => {
    const { x, y, width, height, rotation, data } = layer

    // Check cache first
    let img = imageCache.get(data)

    // If not in cache and not pending, trigger load (will be ready next frame/repaint)
    if (!img && !pendingImages.has(data)) {
        preLoadImage(data) // We can't await here, so it will blink in for one frame or so
        return
    }

    if (img) {
        const centerX = x + width / 2
        const centerY = y + height / 2

        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate(rotation)

        // Draw image centered at (0,0) with specified dimensions
        // -width/2, -height/2 corresponds to top-left relative to center
        ctx.drawImage(img, -width / 2, -height / 2, width, height)

        ctx.restore()
    }
}

export const renderBalloonLayer = (ctx: CanvasRenderingContext2D, layer: BalloonObjectLayer) => {
    const canvas = ctx.canvas
    const { x, y, width, height, rotation, text, font: layerFont, fontSize: layerFontSize, color: layerColor } = layer
    const centerX = x + width / 2
    const centerY = y + height / 2

    // Calculate scale factor for measurement
    let scale = 1
    try {
        const rect = canvas.getBoundingClientRect()
        if (rect && rect.width && rect.height) {
            const scaleX = rect.width / canvas.width
            const scaleY = rect.height / canvas.height
            scale = (scaleX + scaleY) / 2
        }
    } catch {
        scale = 1
    }

    const scaledFontSize = layerFontSize / scale

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(rotation)

    // Balloon configuration
    const rx = width / 2
    const ry = height / 2
    const strokeWidth = 3 // Thicker stroke for comic look

    // Draw balloon shape with tail merged
    ctx.beginPath()

    // We'll draw the ellipse, but we need to "open" it at the bottom to attach the tail
    // A full ellipse is 0 to 2PI.
    // Let's Put the tail at the bottom (around PI/2 if visual top is -PI/2? No, canvas 0 is right, PI/2 is bottom)
    // Angles in canvas arc: 0 is right, PI/2 is bottom, PI is left, 3PI/2 is top.

    // Tail placement: bottom, slightly left of center? Or dynamic?
    // Let's keep it simple: Bottom left-ish.
    // Angles for gap:
    // Start of gap: PI/2 + 0.2
    // End of gap: PI/2 - 0.2
    // Wait, drawing counter-clockwise or clockwise? ellipse() doesn't easily support gaps with correct start/end points for curves without math.

    // Easier approach: Draw full ellipse filled white. Then draw tail filled white. Then draw outline of both? 
    // No, outlines would overlap. we want a single continuous path or masking.
    // "Composite operations" might help, or just calculating points.

    // Let's use points approximation for the ellipse (Bezier) or just `ellipse` and then overdraw the connection?
    // Overdrawing the connection with white is easiest for "merging", then we need to draw the outline.
    // To draw the outline correctly without inner lines:
    // 1. Draw ellipse + tail filled white.
    // 2. Draw ellipse outline (stroke).
    // 3. Draw tail outline (stroke).
    // This leaves the line between them.

    // Correct approach for continuous outline:
    // Define the path.
    // Ellipse is roughly 4 bezier curves.
    // We can use `arc` segments if we are careful.

    // Let's try the "Fill both, then stroke specific parts" approach? No.
    // Let's try drawing the path manually.

    // Tail parameters
    // Tail Tip Position relative to center: (-20, ry + 40)
    // Tail Base Left on ellipse: slightly left of bottom
    // Tail Base Right on ellipse: slightly right of bottom

    const tailTipX = -rx * 0.3
    const tailTipY = ry * 1.3

    // Find points on ellipse for tail base
    // Angle for right base: PI/2 - 0.2
    // Angle for left base: PI/2 + 0.2
    const angleRight = Math.PI / 2 - 0.3
    const angleLeft = Math.PI / 2 + 0.3

    const baseRightX = rx * Math.cos(angleRight)
    const baseRightY = ry * Math.sin(angleRight)

    const baseLeftX = rx * Math.cos(angleLeft)

    ctx.beginPath()
    // Start at right base
    ctx.moveTo(baseRightX, baseRightY)

    // Draw ellipse segment from right base around to left base (drawing the long way)
    // ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise)
    // We want to go from angleRight to angleLeft in CLOCKWISE direction? No, counter-clockwise is standard?
    // standard is clockwise for positive angle increase?
    // 0 -> PI/2 -> PI
    // We want PI/2-0.3 -> ... -> PI/2+0.3. This is almost the full circle.
    // If we go clockwise (default is false/counterclockwise?), wait.
    // ctx.ellipse(0, 0, rx, ry, 0, angleRight, angleLeft, true) (true = counter-clockwise) => goes "backwards" over the top. Yes.
    ctx.ellipse(0, 0, rx, ry, 0, angleRight, angleLeft, true)

    // Now at baseLeft. Draw curve to tip.
    // Quadratic or Bezier for curved tail.
    // Curve out nicely.

    // Actually, draw FROM left base TO tip
    ctx.quadraticCurveTo(baseLeftX - 10, ry + 20, tailTipX, tailTipY)

    // Draw FROM tip TO right base
    ctx.quadraticCurveTo(baseRightX - 5, ry + 10, baseRightX, baseRightY)

    ctx.closePath()

    // Style
    ctx.fillStyle = 'white'
    ctx.fill()
    ctx.lineWidth = strokeWidth
    ctx.strokeStyle = layerColor // Use layer color for outline (usually black)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Render Text
    ctx.fillStyle = layerColor
    ctx.font = `${scaledFontSize}px ${layerFont}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 0, 0)
    ctx.restore()
}

export const renderGroupLayer = (ctx: CanvasRenderingContext2D, layer: GroupObjectLayer) => {
    const children = layer.children
    if (children.length === 0) return

    // Local bounding box of the children (they're stored relative to the group centre).
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const c of children) {
        minX = Math.min(minX, c.x)
        minY = Math.min(minY, c.y)
        maxX = Math.max(maxX, c.x + c.width)
        maxY = Math.max(maxY, c.y + c.height)
    }
    const localW = maxX - minX || 1
    const localH = maxY - minY || 1
    const centerX = layer.x + layer.width / 2
    const centerY = layer.y + layer.height / 2

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(layer.rotation)
    ctx.scale(layer.width / localW, layer.height / localH)
    ctx.translate(-(minX + localW / 2), -(minY + localH / 2))
    children.forEach((child) => renderObjectLayer(ctx, child))
    ctx.restore()
}

export const renderObjectLayer = (ctx: CanvasRenderingContext2D, layer: ObjectLayer) => {
    if (isPathObjectLayer(layer)) {
        renderPathLayer(ctx, layer)
    } else if (isShapeObjectLayer(layer)) {
        renderShapeLayer(ctx, layer)
    } else if (isImageObjectLayer(layer)) {
        renderImageLayer(ctx, layer)
    } else if (isBalloonObjectLayer(layer)) {
        renderBalloonLayer(ctx, layer)
    } else if (isGroupObjectLayer(layer)) {
        renderGroupLayer(ctx, layer)
    }
}
