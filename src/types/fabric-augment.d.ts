import 'fabric'
import { Shape, BalloonKind } from './common'

/**
 * Module augmentation for the custom properties comic-drawer stashes on Fabric objects so layers
 * round-trip (see the `*_ID_KEY` / `*_KEY` constants in `src/utils/fabric*.ts`). Declaring them
 * here — merged onto `FabricObject`, from which every concrete type (Path/IText/Group/Image/Rect)
 * inherits — lets the model↔Fabric seam read and write them type-safely instead of via `as any`.
 *
 * These are all optional: any given object only carries the keys for its own kind.
 */
declare module 'fabric' {
  interface FabricObject {
    // shapes
    shapeId?: string
    shapeKind?: Shape
    shapeBoxW?: number
    shapeBoxH?: number
    // text / emoji
    textId?: string
    // images (cut-outs)
    imageId?: string
    imageData?: string
    // groups
    groupId?: string
    // pen paths
    pathId?: string
    // speech balloons
    balloonId?: string
    balloonKind?: BalloonKind
    balloonBoxW?: number
    balloonBoxH?: number
    balloonMeta?: { text?: string; font?: string; fontSize?: number }
    // chrome (raster substrate + grid rects)
    isRaster?: boolean
    isGrid?: boolean
  }
}
