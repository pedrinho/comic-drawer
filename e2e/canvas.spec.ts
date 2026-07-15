import { test, expect, Page, BoundingBox } from '@playwright/test'

/**
 * Browser-level smoke for the interactive Fabric pipeline. jsdom can't drive Fabric's pointer
 * events, so these assert real behaviour: the canvas's own pixels (via `toDataURL`) change when you
 * draw, revert on undo, and come back on redo — plus that every tool and the on-selection controls
 * run without a runtime error.
 */

// Collected per test (serial run, workers:1) and asserted empty in afterEach. The pre-existing
// EmojiPicker duplicate-key warning is unrelated to the canvas and filtered out.
let errors: string[] = []

test.beforeEach(async ({ page }) => {
  errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/two children with the same key|EmojiPicker/.test(t)) return
    errors.push('console: ' + t.split('\n')[0])
  })
  await page.goto('/')
  await page.waitForSelector('[data-testid="canvas"] canvas')
  await page.waitForTimeout(300)
})

test.afterEach(() => {
  expect(errors, 'no runtime errors during the flow').toEqual([])
})

// --- helpers: map internal 1200x800 coords to page coords via the canvas bounding box ---

const canvasBox = async (page: Page): Promise<BoundingBox> => {
  const b = await page.locator('[data-testid="canvas"] canvas').first().boundingBox()
  if (!b) throw new Error('canvas has no bounding box')
  return b
}
const mapper = (b: BoundingBox) => {
  const s = b.width / 1200
  return { s, P: (x: number, y: number) => ({ x: b.x + x * s, y: b.y + y * s }) }
}
const selectTool = async (page: Page, title: string) => {
  await page.click(`button[title="${title}"]`)
  await page.waitForTimeout(120)
}
const dragScene = async (
  page: Page,
  P: (x: number, y: number) => { x: number; y: number },
  a: [number, number],
  c: [number, number],
  steps = 12
) => {
  const pa = P(a[0], a[1])
  const pc = P(c[0], c[1])
  await page.mouse.move(pa.x, pa.y)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(pa.x + ((pc.x - pa.x) * i) / steps, pa.y + ((pc.y - pa.y) * i) / steps)
  }
  await page.mouse.up()
  await page.waitForTimeout(150)
}
// The Fabric lower-canvas holds the rendered scene (controls/cursor live on the upper-canvas).
const canvasPixels = (page: Page) =>
  page.locator('[data-testid="canvas"] canvas').first().evaluate((el) => (el as HTMLCanvasElement).toDataURL())

test('renders the interactive canvas', async ({ page }) => {
  await expect(page.locator('[data-testid="canvas"] canvas').first()).toBeVisible()
})

test('every tool activates without a runtime error', async ({ page }) => {
  for (const t of ['Select', 'Scissor', 'Pen', 'Eraser', 'Object Shapes', 'Fill', 'Text', 'Balloon', 'Emoji']) {
    await selectTool(page, t)
  }
  // errors asserted in afterEach
})

test('drawing a shape changes the canvas; undo reverts and redo restores', async ({ page }) => {
  const { P } = mapper(await canvasBox(page))
  const blank = await canvasPixels(page)

  await selectTool(page, 'Object Shapes')
  await dragScene(page, P, [200, 150], [450, 380])
  const drawn = await canvasPixels(page)
  expect(drawn, 'shape should change the canvas').not.toBe(blank)

  await page.click('button[title="Undo (Ctrl+Z)"]')
  await page.waitForTimeout(250)
  expect(await canvasPixels(page), 'undo should revert to blank').toBe(blank)

  await page.click('button[title="Redo (Ctrl+Shift+Z)"]')
  await page.waitForTimeout(250)
  // The shape round-trips through the layer model (drag scaleX/scaleY → baked width/height), so a
  // rebuilt shape can differ from the original draw by sub-pixels; assert it's restored, not blank.
  expect(await canvasPixels(page), 'redo should restore the shape').not.toBe(blank)
})

test('text typed then abandoned by a tool switch is committed (teardown-commit)', async ({ page }) => {
  const { P } = mapper(await canvasBox(page))
  const blank = await canvasPixels(page)

  await selectTool(page, 'Text')
  const q = P(720, 200)
  await page.mouse.click(q.x, q.y)
  await page.waitForTimeout(150)
  await page.keyboard.type('POW')
  await page.waitForTimeout(120)
  // Switch tools mid-edit — no text:editing:exited fires, so the effect teardown must commit it.
  await selectTool(page, 'Select')
  await page.waitForTimeout(200)

  expect(await canvasPixels(page), 'committed text should be on the canvas').not.toBe(blank)
})

test('the duplicate control clones the selected object', async ({ page }) => {
  const { s, P } = mapper(await canvasBox(page))

  await selectTool(page, 'Object Shapes')
  await dragScene(page, P, [200, 150], [400, 320]) // bounds ~[200,400]x[150,320]
  await selectTool(page, 'Select')
  const center = P(300, 235)
  await page.mouse.click(center.x, center.y) // select it
  await page.waitForTimeout(150)
  const before = await canvasPixels(page)

  // ⧉ duplicate control: top-right corner (400,150) + offset (16,-16) in canvas px (CSS-scaled).
  const corner = P(400, 150)
  await page.mouse.click(corner.x + 16 * s, corner.y - 16 * s)
  await page.waitForTimeout(200)

  expect(await canvasPixels(page), 'a duplicate should add pixels').not.toBe(before)
})
