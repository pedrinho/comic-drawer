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
- Integration tests: `src/components/CanvasFabricShapes.test.tsx`.

## TODO — remaining object tools (low risk, same pattern)

- [ ] **balloon** — `BalloonObjectLayer` → a `fabric.Group` (merged ellipse+tail outline as
  a `fabric.Path` mirroring `renderBalloonLayer`, plus an editable `fabric.IText`). Needs
  create-by-drag then in-place text edit; sync to `shapeLayers`.
- [ ] **scissor / image** — `ImageObjectLayer` → `fabric.Image` (base64 `data`). Cleanest of
  the three; the cut itself still produces the base64 on the legacy raster.
- [ ] **emoji** — route emoji creation through a `fabric.IText` instead of the legacy text
  layer (largely reuses the text mode).

## TODO — raster phase (HIGH RISK, deferred — plan separately)

This is not an isolated tool; it reworks the bitmap/undo core and the shared selection
system, so it carries real stall risk and must be verified in a browser.

- [ ] **pen / eraser / fill** — currently rasterize into a per-panel `ImageData` with
  frame-based undo (`App.tsx`). Decide: model strokes as `fabric.Path` objects, or keep a
  raster layer under the Fabric object layer. Rework undo/redo accordingly.
- [ ] **unify `select`** — move the select tool onto Fabric for all object types and delete
  the hand-rolled `SelectionHandle` / `getHandleAtPoint` / rotation machinery.
- [ ] **export** — rewire the `jspdf` export to render from the Fabric canvas.
- [ ] **remove legacy canvas** — once all tools are migrated.

## Verification note

⚠️ Fabric's correctness here is largely **visual** and must be confirmed in a real browser
(`npm run dev`): shape/cursor alignment, balloon outline fidelity, in-place text editing,
and (later) fill/eraser/scissor behavior. The automated environment has no headless browser,
so unit tests cover only data conversion + enter/exit sync — not rendering or interaction.

Manual pass per tool: draw → select → move → resize → rotate → delete → save → reload →
confirm it persists, and check it renders under the cursor at different window sizes.
