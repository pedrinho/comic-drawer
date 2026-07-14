# Fabric.js Migration — Status & TODO

Migrating the canvas core from the hand-rolled HTML5 Canvas 2D implementation to
[Fabric.js](http://fabricjs.com/). Strategy: **incremental, one tool per commit**, keeping
the legacy canvas working alongside a Fabric overlay until every tool is ported.

## Architecture (how the overlay works today)

- The Fabric canvas is an overlay (`fabricRef`) sized to match the legacy canvas.
- While a **Fabric-owned tool** is active, the overlay becomes the interactive top layer
  (`zIndex`/`pointerEvents` toggled by `tool` in `Canvas.tsx`), the owned layer type is
  loaded as Fabric objects, and the legacy canvas stops drawing that type
  (`shapesOnFabricRef` / `textOnFabricRef`). On tool change the objects are synced back into
  the layer model (`shapeLayers` / `textLayers`) so save/load, undo/redo and the `select`
  tool keep working unchanged.
- Conversion layers live in `src/utils/`: `fabricShapes.ts`, `fabricText.ts`.
- The generalized overlay effect in `Canvas.tsx` drives one `mode` at a time
  (`'shape' | 'text' | null`); adding a tool = add a mode branch + a conversion module.

## Done

- [x] **objectShapes** — all 12 shapes, native create/select/move/resize/rotate, round-trip
  serialization. (`src/utils/fabricShapes.ts`, tests `fabricShapes.test.ts`)
- [x] **text** — `fabric.IText` in-place editing, scale-aware font size.
  (`src/utils/fabricText.ts`, tests `fabricText.test.ts`)
- [x] **emoji** — places the selected emoji as a `fabric.IText` (text-mode variant).
- [x] **balloon** — **deprecated** (removed from the toolbar; type + rendering kept so old
  comics still load). Not migrated to Fabric.
- Integration tests: `src/components/CanvasFabricShapes.test.tsx`.

## Image + select unification (done on branch `feature/fabric-select-unification` — NEEDS BROWSER VERIFICATION)

- [x] **image** — `ImageObjectLayer` ↔ `fabric.FabricImage` (`src/utils/fabricImage.ts`,
  async load from base64). The scissor cut still produces base64 on the legacy raster; the
  resulting object is manipulated on Fabric. Tests: `fabricImage.test.ts` (pure read-back +
  kind discrimination; async decode is browser-only).
- [x] **unify `select`** — the `select` tool now loads all object types (shape/text/image)
  onto Fabric and uses native selection/move/resize/rotate. Text edits in place on
  double-click. Legacy object rendering is skipped for the owned types via `fabricOwnedRef`.
  Export is unaffected — it renders from the layer arrays (`App.tsx` `renderObjectLayer`).

### Browser verification (Playwright, headless Chromium) — PASSED
Ran a scripted pass driving real mouse gestures + screenshots. All green, zero page errors:
- Shapes render correctly and land **under the cursor** (overlay alignment confirmed — the
  Fabric and legacy canvases share the same box).
- `select`: loads all objects onto Fabric; click-select, **move, resize (corner handle),
  rotate (rotation handle)** all work with native controls.
- **Undo** while in `select` refreshes correctly (App restores the panel's `data` reference
  on undo/redo, which re-triggers the overlay reload — so the earlier concern was unfounded).
- Text: place + type + commit renders; emoji places on Fabric.
- **PDF export** produces a valid multi-hundred-KB file (renders from the layer arrays).

### Remaining minor limitations (non-blocking)
- **Duplicate button** is gone in Fabric select (the old on-canvas 📋 button keyed off the
  legacy selection). Delete works via Delete/Backspace. Consider Cmd/Ctrl+D later.
- **Old balloons** (deprecated) render on the legacy canvas and are not selectable while the
  Fabric overlay is on top in select mode.
- The hand-rolled `SelectionHandle` / `getHandleAtPoint` machinery is now **unused** in
  select mode but left in place (safe to delete in a later cleanup).
- **Scissor → image** was not driven in the automated pass (needs a raster cut first);
  the conversion is unit-tested and the object path is the same as other objects.

## Raster phase + teardown — DONE (single-canvas end state)

The migration is **complete**: the Fabric overlay is now the ONLY canvas. `Canvas.tsx` went
from ~3745 to ~994 lines.

- [x] **pen** — native `fabric.PencilBrush` → `fabric.Path` ↔ `PathObjectLayer`
  (`src/utils/fabricPath.ts`). Paths are selectable/movable in select/fill.
- [x] **raster substrate + grid** — the per-panel `panelData` bitmap is a bottom
  `fabric.Image` over an offscreen backing canvas, and the grid is non-interactive
  `fabric.Rect`s (`src/utils/fabricRaster.ts`, tagged chrome, excluded from sync).
- [x] **eraser** — `destination-out` on the raster backing; one history entry per stroke.
- [x] **fill** — vector-shape recolor OR a composite-snapshot flood stamped onto the backing
  (respects ink/grid/shape bounds).
- [x] **scissor** — marquee cuts the backing region into a `fabric.Image` (built synchronously
  so the sync preserves it), leaves a hole, switches to select.
- [x] **balloon** (deprecated) — read-only converter so old files still render/move/export
  (`src/utils/fabricBalloon.ts`).
- [x] **single canvas** — the overlay renders raster + grid + ALL object types in every mode;
  interactivity is gated per tool. Legacy `<canvas>`, the HTML text `<input>`, the DOM
  duplicate/delete buttons, and ~2750 lines of dead machinery
  (startDrawing/draw/stopDrawing, SelectionHandle/getHandleAtPoint, repaintCanvas + draw
  helpers, legacy effects/refs) are DELETED. Overlay sizing re-anchored to the container.
- [x] **export** — rendered through a Fabric `StaticCanvas` reusing the same converters
  (`src/utils/exportPanel.ts`), so PDF matches the editor. Layer model stays the persistence
  source of truth; `Presentation.tsx` still renders from it.
- [x] **undo/redo** — fixed for the single-canvas model: one history entry per action, saves
  moved OUT of the `setPanels` updaters (StrictMode-safe, `panelsRef`), model-aware cleanup
  that never clobbers a restored model.

## Verification note

Fabric's correctness is largely **visual** — confirmed via a Playwright + headless Chromium
pass (see `[[fabric-migration-verification-gap]]`): all tools draw under the cursor, eraser
wipes raster, fill/scissor work, undo/redo `[2,1,0]`/`[1,2,3]`, valid multi-panel PDF,
presentation renders, correct 3:2 sizing, zero page errors. 132 unit tests pass; prod build OK.
