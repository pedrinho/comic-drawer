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

## TODO — image + select unification (needs browser verification)

These are coupled: images are created by the scissor tool and manipulated by the `select`
tool, so putting images on Fabric requires moving `select` onto Fabric too. That replaces
the hand-rolled selection/handles/delete-duplicate-button UX with Fabric's native controls
— a behavior change that must be verified in a browser before merging.

- [ ] **scissor / image** — `ImageObjectLayer` → `fabric.Image` (async load from base64).
  The cut still produces base64 on the legacy raster; only the resulting object moves to Fabric.
- [ ] **unify `select`** — objects live persistently on Fabric; `select` uses Fabric's native
  selection for shape/text/image; remove the hand-rolled `SelectionHandle` machinery.

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
