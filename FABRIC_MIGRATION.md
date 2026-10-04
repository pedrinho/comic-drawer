# Fabric.js Migration — Complete

The canvas core was migrated from a hand-rolled HTML5 Canvas 2D implementation to
[Fabric.js](http://fabricjs.com/), incrementally, one tool per commit. It ended as a **single
Fabric canvas** that renders the whole scene and owns every tool. The layer model
(`ObjectLayer` / `TextLayer` in `src/types/layers.ts` + each panel's raster `ImageData`) stays the
source of truth for save/load, undo/redo, PDF export and the presentation.

## Architecture (current)

- **Component → hooks.** `src/components/Canvas.tsx` (~100 lines) wires three hooks:
  `useFabricCanvas` (creates the `fabric.Canvas`), `useOverlaySizing` (fits it to its container at
  3:2 via `fitOverlay`; the internal resolution stays 1200×800) and `useCanvasController`.
- **One atomic effect.** `src/hooks/useCanvasController.ts` rebuilds the scene from the model on
  every tool- or model-driven change (`buildScene` in `fabricScene.ts`), syncs edits back
  (`canvasObjectsToLayers`, one sync = one history entry), and binds every canvas and window event.
  Its load-bearing invariants (refs assigned during render, no blanket sync on teardown, …) are
  documented in `CANVAS_REFACTOR_PLAN.md`. Read that before changing the effect.
- **Tools.** `toolToMode` (`toolMode.ts`) maps a `Tool` to a `Mode`
  (`shape | balloon | text | select | fill | pen | eraser | scissor`). `createToolController`
  (`toolControllers.ts`) returns the mode's pointer controller. `select` uses Fabric's own
  picking; `pen` and `eraser` are native free-drawing brushes (`eraserTool.ts` installs the
  eraser's).
- **Converters.** One module per layer type maps model ↔ Fabric: `fabricShapes.ts`,
  `fabricPath.ts`, `fabricText.ts`, `fabricImage.ts`, `fabricGroup.ts`, `fabricBalloon.ts`. Each also
  attaches and reads the object's eraser `erasures` via `fabricErase.ts`.
- **Chrome.** The raster substrate (a bottom `fabric.Image` over an offscreen backing canvas) and
  the panel grid (non-interactive `fabric.Rect`s) come from `fabricRaster.ts`. They're tagged
  (`isChromeObject`) and excluded from sync.
- **Object management.** The on-selection controls ⧉ duplicate, ✕ delete, ⊕ merge (on a
  multi-selection) and ⊖ un-merge (on a group) are built by `createObjectControls`
  (`fabricControls.ts`) and run the ops in `createObjectOps` (`objectOps.ts`). Delete/Backspace also
  deletes. `applyObjectControls` gates interactivity per mode.
- **Rendering outside the editor.** `renderPanelToStaticCanvas` (`exportPanel.ts`) draws a panel
  through a `fabric.StaticCanvas` using the same converters. Both PDF export and `Presentation.tsx`
  use it, so they match the editor.

## Tools — all on Fabric

- [x] **pen** — `fabric.PencilBrush` → `fabric.Path` ↔ `PathObjectLayer`. Strokes are real objects
  (select, move, resize, rotate, duplicate, merge).
- [x] **eraser** — erase2d's `EraserBrush` (`@erase2d/fabric`, by Fabric's maintainer) as a
  free-drawing brush. Fabric ≥6 has no eraser in core, and erase2d is the successor to v5's
  `EraserBrush`. We use only its brush (stroke + live preview) and `ClippingGroup` (the mask
  object), so it's swappable. The stroke is committed by us (`src/utils/eraserTool.ts`): raster
  pixels are wiped (`destination-out` on the backing), and every object the stroke crosses gets it
  in a per-object mask, an erase2d `ClippingGroup` as its `clipPath`, so it stays a movable object.
  The masks are persisted in the layer model as `erasures` (`src/utils/fabricErase.ts`) in the
  object's *frame* (scaled, unrotated, centred local plane), because the converters rebuild objects
  at a different scale than they were edited at. Fully erased objects are deleted; un-merge hands a
  group's strokes to its children (`pushGroupEraseMaskToChildren`); one history entry per stroke.
  Size picker small/medium/large = 10/20/40 canvas px (`ERASER_WIDTHS`, `EraserPicker.tsx`) with a
  ring cursor of that size. (Replaced an earlier approach that baked touched shapes/paths into the
  raster, which made them immovable.)
- [x] **Polygon** — one tool, any number of sides (3–1000, `POLYGON_MIN_SIDES`/`POLYGON_MAX_SIDES`)
  chosen in `PolygonPicker`. 3 is a triangle, 4 a rectangle; the polygon stretches to fill the
  dragged box. Legacy fixed shape kinds in saved comics (rectangle, triangle, pentagon, …) still load
  with their geometry.
- [x] **Objects** — star, heart, arrow, cross, circle, diamond (`OBJECT_SHAPES` in
  `ShapePicker.tsx`). Like polygons, they store the intended drag box so they don't shrink on
  round-trip.
- [x] **text** — `fabric.IText` in-place editing with scale-aware font size. The toolbar keeps the
  font controls open while typing; switching tools mid-edit commits the text.
- [x] **emoji** — a `fabric.IText` holding the glyph (a text-mode variant).
- [x] **balloon** — drag to draw a speech bubble: a `fabric.Path` from a per-kind generator
  (`BALLOON_KINDS` registry in `fabricBalloon.ts`). Behaves like a shape. Shape only for now (no
  caption); the registry is ready for more kinds (thought, shout, …).
- [x] **fill** — clicking a shape or a pen path recolours that object's own fill (it moves with it).
  Otherwise a composite-snapshot flood is stamped onto the raster backing, respecting
  ink/grid/object bounds.
- [x] **scissor** — a marquee cuts the raster region into a `fabric.Image` (built synchronously so
  the sync keeps it), leaves a hole, and switches to select.
- [x] **image** — `ImageObjectLayer` ↔ `fabric.FabricImage` (async load from base64). Produced by
  scissor cuts and by **pasting a clipboard image** (`createImageFromDataUrl` / `fitPasteScale`:
  centred, at most 66% of the canvas, never upscaled; the tool switches to select with the image
  selected).
- [x] **select** — native pick/move/resize/rotate for every object type; double-click edits text.
  Objects are also pickable in the creation modes (a drag on empty canvas still creates).
- [x] **merge / un-merge** — `fabric.Group` ↔ `GroupObjectLayer` (`fabricGroup.ts`), children stored
  in group-local coordinates. Children may be shapes, text, images, pen paths, speech balloons and
  nested groups. (A merged balloon used to come back as a rectangle, and pen paths and nested
  groups were dropped. `fabricChildToLayer` must route balloons through their own converter,
  because `fabricObjectKind` reads a balloon's `fabric.Path` as a plain shape.)
- [x] **undo/redo** — one history entry per action, snapshotted outside the `setPanels` updaters
  (`panelsRef`, StrictMode-safe). The effect cleanup never clobbers a restored model.
- [x] **export + presentation** — both through `renderPanelToStaticCanvas` (see Architecture).
  Presentation renders at screen resolution, so slides stay crisp.

## Known behaviours / limitations

- The eraser rubs out **everything under it**, including objects stacked below other objects.
- Text scaled non-uniformly round-trips with a uniform font size (`fontSize × scaleY`), so it
  reflows. Its eraser marks follow the same approximation.
- The presentation draws the panel grid in canvas units, so the border scales with the slide (it
  used to be a fixed 3px line).

## Verification

Fabric's correctness is largely visual, so it's covered at two levels:

- **Unit:** `npm test` (vitest + jsdom) — 264 tests across the converters, scene build/sync,
  controllers, object ops, eraser masks (`fabricErase.test.ts`), file round-trip and components.
- **Browser:** `npm run e2e` — a committed Playwright suite (`e2e/canvas.spec.ts`, 15 tests,
  headless Chromium; setup and tips in `docs/e2e.md`). It drives real gestures and asserts on the
  rendered pixels: drawing, undo/redo, polygon sides, text commit, the eraser flows (move after
  erase, resize/rebuild, typing into erased text, auto-delete, size picker), duplicate, paste.
- `npm run type-check` and `npm run build` must pass (Vercel build).

## History

- **Overlay phase:** while tools were being ported, a Fabric overlay sat above the legacy 2D
  canvas and took pointer events only for the tools it owned. Objects were synced back to the layer
  model on every tool switch.
- **Raster phase + teardown:** pen, eraser, fill and scissor moved onto Fabric (with the raster
  substrate as a bottom `fabric.Image`). The legacy `<canvas>`, the HTML text `<input>`, the DOM
  duplicate/delete buttons and ~2,750 lines of hand-rolled selection/rendering machinery
  (`SelectionHandle`/`getHandleAtPoint`, repaint helpers, legacy effects) were deleted.
- **Refactor:** the remaining god-effect was split into converters, per-tool controllers, object
  ops and hooks (`CANVAS_REFACTOR_PLAN.md`). `Canvas.tsx` went from ~3,745 lines to ~100.
