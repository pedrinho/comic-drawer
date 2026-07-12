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

## TODO — raster phase (still deferred, high risk)
- [ ] pen / eraser / fill remain on the legacy raster canvas (intentionally — low risk).
  Only migrate if there's a reason to; keeping a raster layer under the Fabric object layer
  is a legitimate end state.

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
