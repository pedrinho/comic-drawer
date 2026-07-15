# Canvas.tsx refactor plan

**Status:** Phases 1 & 2 complete (2026-07-15, branch `refactor/canvas-phase-1-2-extractions`);
Phase 3 complete (2026-07-15, branch `refactor/canvas-phase-3-tool-controllers`); Phase 4 complete
(2026-07-15, branch `refactor/canvas-phase-4-object-ops`); Phases 5–6 not started. Originally
deferred from the non-functional review (2026-07-14).

## Why

`src/components/Canvas.tsx` is a ~1033-line god-component. A single `useEffect`
(`Canvas.tsx:311-1012`, 13-item dependency array) owns mode resolution, overlay sizing, brush
setup, the full scene rebuild, `syncToLayers`, ~10 object-management closures, the raster
operations, every pointer handler, and a subtle teardown. There is no tool abstraction — behavior
is a nested-ternary mode dispatch plus imperative branches — so adding or changing a tool means
surgery across this one effect. It is also the single biggest coverage gap (~44%), because its
Fabric pointer pipeline can't be driven in jsdom.

The goal: decompose it into pure helpers + per-tool controllers + small hooks, each independently
testable, **without changing runtime behavior**.

## Must-preserve invariants (the landmines)

These are load-bearing and subtle. Any refactor MUST keep them intact; write characterization
notes/tests around them before moving code.

1. **Refs updated during render** (`Canvas.tsx:98-101`): `shapeLayersRef`/`textLayersRef` mirror
   props and are set *during render* so the effect (and its cleanup) read the current model,
   including a value the cleanup itself writes when committing an abandoned text edit.
2. **`shapeLayers`/`textLayers` are deliberately NOT in the effect deps** (`Canvas.tsx:1012`,
   381-384): live edits must not trigger a rebuild that clobbers the active selection. External
   model changes (undo/redo/load/panel-switch) re-run the effect via `panelData`/`layout`.
3. **Teardown does NOT blanket-sync canvas→model** (`Canvas.tsx:996-1005`): on a model-driven
   re-run the canvas is stale; syncing would clobber the just-restored model. The teardown commits
   *only* an in-place text edit the user abandoned by switching tools.
4. **One sync = one history entry** (`Canvas.tsx:436-441`): `syncToLayers` calls the shape update
   with the history flag and the text update with `skipHistory=true`, so a single action pushes one
   entry (not two near-identical ones that make undo appear to no-op).
5. **Chrome tagging** (`isChromeObject`): the raster substrate + grid rects are excluded from the
   canvas→model sync. Keep them excluded everywhere the object list is read.
6. **`disposed` guard** (`Canvas.tsx:335`, 393/404/473/487): async image/group loads must bail if
   the effect was torn down, or they add objects to a disposed canvas.

## Phases (incremental, each independently shippable)

### Phase 1 — Extract pure helpers (no behavior change, high test value) — ✅ DONE
Landed as `utils/floodFill.ts` (`floodFillImageData`, pure over `ImageData`), `utils/toolMode.ts`
(`toolToMode` + a `Mode` type in `types/common.ts`), `utils/id.ts` (`generateLayerId`), and
`utils/fabricScene.ts` (`canvasObjectsToLayers` + `buildScene`, with `isDisposed`/`applyObjectControls`
passed in as callbacks). Each has a co-located unit test.

Move logic that doesn't need React/effect scope out to `src/utils/`, and unit-test it:
- `floodFill` (`Canvas.tsx:190-275`) → `utils/floodFill.ts`. Pure pixel algorithm; test with real
  `ImageData` arrays (matches boundaries, respects tolerance, handles transparent target).
- `toolToMode(tool)` — replace the nested ternary (`Canvas.tsx:315-332`) with a pure map; unit-test
  every `Tool` → mode.
- `generateLayerId` (`Canvas.tsx:298-303`) → `utils/id.ts`.
- **`canvasObjectsToLayers(objects, scale)`** — extract the reader half of `syncToLayers`
  (`Canvas.tsx:421-435`) into a pure function returning `{ shapeLayers, textLayers }`. Highly
  testable with real Fabric objects, exactly like the existing `fabric*.test.ts` suite. This is the
  highest-value extraction — it pins the canvas→model contract.
- **`buildScene(canvas, { shapeLayers, textLayers, panelData, layout, scale })`** — extract the
  scene builder (`Canvas.tsx:376-414`), returning the raster handles it creates.

### Phase 2 — Type the Fabric custom-prop boundary — ✅ DONE
Killed the seam casts (Canvas.tsx 9→0, utils 41→1) via module augmentation in
`types/fabric-augment.d.ts` (types both reads and constructor-embedded keys — no `WeakMap`/accessor
churn needed) plus `utils/fabricMeta.ts` (`isActiveSelection`/`isEditingText`/`getScenePoint`) for
the Fabric-API gaps; also fixed `groupId` to use the `GROUP_ID_KEY` constant. The two surviving
casts (`obj.path as any[]`, `document.fonts`) are unrelated Fabric/DOM-shape gaps, left as-is.

### Phase 3 — Tool-strategy abstraction (the core change) — ✅ DONE
Landed as `utils/toolControllers.ts`: a `ToolController` interface (`{ onDown?, onMove?, onUp? }`),
a `ToolContext` for the shared services + tool params, per-tool factories holding their own gesture
state in closures (`dragCreateController` shared by shape+balloon, `textController`, `fillController`
owning `floodRaster`, `eraserController` owning `eraseSegment`, `scissorController` owning the cut
path), and `createToolController(mode, ctx)` — `select`/`pen`/`null` resolve to `null` (Fabric
handles picking; pen uses the native brush). `normalizeRect`/`BASE` moved here too. The effect now
builds the controller once and wires thin `mouse:down/move/up` wrappers to it; `hideSizeLabel()`
stays an effect-level `mouse:up` prefix (it also backs the select-mode scaling pill). Object-
management + `applyObjectControls` stay in the effect (Phase 4 moves them). Canvas.tsx shrank ~256
net lines. Co-located `toolControllers.test.ts` covers factory dispatch + shape/fill/text behaviors;
a Playwright/Chromium pass drove real gestures for every tool (create/move/text-edit/balloon/pen/
fill/eraser/emoji/scissor-cut→auto-select/undo) with objects preserved across all tool switches and
zero Canvas/Fabric errors.

### Phase 4 — Extract object-management (controls) concern — ✅ DONE
Landed as `utils/objectOps.ts` (`createObjectOps(canvas, deps)` returning duplicate/delete/merge/
ungroup, with `syncToLayers`/`scale`/`isDisposed`/`applyControls` as deps) and `utils/fabricControls.ts`
(`createObjectControls(ops, { mode, isCreationMode })` returning `applyObjectControls` + the
`mergeControl` instance; `iconControl` is module-private, and the mode-gated interactivity rules live
here). The two are mutually recursive (an op applies controls to the object it creates; a control
invokes an op), so the effect late-binds `applyObjectControls` via the same wrapper `buildScene`
already used. Co-located `objectOps.test.ts` (7) + `fabricControls.test.ts` (7) cover the ops, the
mode gating, and control→op wiring; a Playwright/Chromium pass drove all four on-selection buttons
(duplicate/delete/merge/ungroup) end-to-end with zero page errors. Canvas.tsx shrank ~170 net lines.

### Phase 5 — Decompose the component into hooks
- `useFabricCanvas(ref)` — init/dispose (`Canvas.tsx:130-152`).
- `useOverlaySizing(containerRef)` — the CSS-size sync effects (`Canvas.tsx:154-176`, `sizeOverlay`).
- `useSceneSync(...)` — `buildScene` + `syncToLayers` wiring, owning the render-synced refs and the
  teardown-commit rule (invariant #3).
- `useActiveTool(tool, services)` — resolves and wires the Phase-3 controller.
Result: `Canvas` becomes a thin orchestrator (~100-150 lines) + the JSX at `Canvas.tsx:1018-1032`.

### Phase 6 — Testing & verification
- Unit tests for every Phase-1/2/4 extraction (`floodFill`, `toolToMode`, `canvasObjectsToLayers`,
  `buildScene`, `objectOps`, prop accessors).
- Browser-level (Playwright/Chromium) smoke for the interactive gestures jsdom can't drive:
  draw shape, drag-resize, place+edit text, pen stroke, eraser, fill, scissor cut, group/ungroup,
  undo/redo. See `memory/fabric-migration-verification-gap.md` for how to run a browser pass.
- After each phase: `npm run type-check`, `npm run test:run`, and a manual `npm run dev` smoke.
  Un-exclude nothing was re-added to `vitest.config.ts`; watch Canvas.tsx coverage climb.

## Sequencing rationale
Pure extractions first (safe, immediately add coverage to the untested core), then type the
boundary, then the structural tool-strategy split (the risky part — now guarded by the tests added
in Phases 1-2), then the hook decomposition, then browser verification. Each phase leaves `main`
green and shippable.
