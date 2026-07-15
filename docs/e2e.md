# End-to-end tests (Playwright)

The `e2e/` suite drives the real Fabric pointer pipeline in headless Chromium — the interactive
gestures jsdom/vitest can't simulate (drawing, resizing, in-place text editing, undo/redo, the
on-selection controls). It's the browser-level half of the Canvas test strategy; the unit/component
tests under `src/` are the jsdom half.

## Running

```bash
npm run e2e                 # runs the whole suite (starts its own dev server on :5178)
npx playwright test --ui    # interactive UI mode
npx playwright test -g undo # filter by title
npx playwright show-report  # open the HTML report after a run
```

The Playwright config (`playwright.config.ts`) starts `npm run dev -- --port 5178 --strictPort`
itself via `webServer`, so you don't need a server running (it reuses one already on :5178 locally).

## First-time setup

`@playwright/test` is a devDependency, but the browser binary is downloaded separately:

```bash
npx playwright install chromium
```

## How the assertions work

Fabric doesn't expose its canvas instance on the DOM, so the specs assert on the canvas's own
pixels: they read the Fabric lower-canvas via `toDataURL()` and check that a gesture changes it
(drawing), that undo reverts it, and redo restores it. Every test also fails if any `pageerror` or
unexpected `console.error` fires during the flow. Coordinates are mapped from the fixed internal
1200×800 space to page pixels via the canvas bounding box.

Note: the pre-existing React "duplicate key" warning from `EmojiPicker` is filtered out of the
error assertion — it's unrelated to the canvas.

## Relationship to vitest

`e2e/**` is excluded from the vitest run (`vitest.config.ts`), and `e2e/` is outside the app
tsconfig's `include`, so `npm run type-check` and `npm run test:run` don't touch it. Run the two
layers separately: `npm run test:run` (unit/component) and `npm run e2e` (browser).
