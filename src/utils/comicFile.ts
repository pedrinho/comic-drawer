import { PanelData, SavedPanel, ComicFile } from '../types/common'
import { ShapeLayer, TextLayer, migrateLayers } from '../types/layers'
import { imageDataToBase64, base64ToImageData } from './canvasUtils'

/**
 * `.cd` (Comic Drawer) file persistence — the pure serialize/deserialize seam.
 *
 * Extracted from App's `handleSave`/`handleLoad` so the round-trip (panels → JSON → panels) can be
 * unit-tested without the Blob-download / FileReader DOM plumbing. App keeps the DOM glue; the
 * data transform lives here.
 */

export const COMIC_FILE_VERSION = '0.1.0'

/** Build the serializable `ComicFile` from live panels (ImageData → base64 PNG). */
export const serializeComic = (panels: PanelData[]): ComicFile => ({
  version: COMIC_FILE_VERSION,
  panels: panels.map((panel): SavedPanel => ({
    id: panel.id,
    name: panel.name,
    data: panel.data ? imageDataToBase64(panel.data) : null,
    layout: panel.layout,
    shapeLayers: panel.shapeLayers,
    textLayers: panel.textLayers,
  })),
})

/**
 * Rebuild live panels from a parsed `ComicFile`. Reassigns fresh ids, backfills panel-name
 * fallbacks, decodes base64 back to ImageData, and runs `migrateLayers` so old files (missing the
 * `type` discriminator) load correctly.
 */
export const deserializeComic = async (comicFile: ComicFile): Promise<PanelData[]> =>
  Promise.all(
    comicFile.panels.map(async (panel, index) => ({
      // Reassign unique timestamp-based IDs
      id: Date.now() + index,
      name: panel.name || `Panel ${index + 1}`, // fallback for backward compatibility
      data: panel.data ? await base64ToImageData(panel.data) : null,
      layout: panel.layout,
      shapeLayers: migrateLayers(panel.shapeLayers ?? []) as ShapeLayer[],
      textLayers: migrateLayers(panel.textLayers ?? []) as TextLayer[],
    })),
  )
