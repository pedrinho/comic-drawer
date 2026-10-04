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
  for (const t of ['Select', 'Scissor', 'Pen', 'Eraser', 'Polygon', 'Objects', 'Fill', 'Text', 'Balloon', 'Emoji']) {
    await selectTool(page, t)
  }
  // errors asserted in afterEach
})

test('drawing a shape changes the canvas; undo reverts and redo restores', async ({ page }) => {
  const { P } = mapper(await canvasBox(page))
  const blank = await canvasPixels(page)

  await selectTool(page, 'Polygon')
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

test('the polygon draws with the chosen number of sides', async ({ page }) => {
  const { P } = mapper(await canvasBox(page))
  const drawPolygon = async (sides: string) => {
    await selectTool(page, 'Select') // re-clicking an active Polygon button would toggle its picker shut
    await selectTool(page, 'Polygon')
    const input = page.getByLabel('Number of sides')
    await input.fill(sides)
    await input.press('Enter')
    await dragScene(page, P, [300, 200], [600, 500])
    const px = await canvasPixels(page)
    await page.click('button[title="Undo (Ctrl+Z)"]')
    await page.waitForTimeout(250)
    return px
  }
  const blank = await canvasPixels(page)
  const tri = await drawPolygon('3')
  const nine = await drawPolygon('9')
  const thousand = await drawPolygon('1000')
  expect(tri, 'a polygon should draw').not.toBe(blank)
  expect(nine, '9 sides should look different from 3').not.toBe(tri)
  expect(thousand, '1000 sides should draw too').not.toBe(blank)
  await expect(page.getByLabel('Number of sides')).toHaveValue('1000')
})

test('the Objects button draws its own kind of shape (star vs a polygon)', async ({ page }) => {
  const { P } = mapper(await canvasBox(page))
  await selectTool(page, 'Polygon')
  await dragScene(page, P, [200, 150], [450, 380])
  const rect = await canvasPixels(page)
  await page.click('button[title="Undo (Ctrl+Z)"]')
  await page.waitForTimeout(250)

  await selectTool(page, 'Objects')
  await page.click('button[title="star"]')
  await dragScene(page, P, [200, 150], [450, 380])
  const star = await canvasPixels(page)
  expect(star, 'the star should differ from the polygon').not.toBe(rect)
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

// Is there dark ink around scene point (x, y)? Probes a 6x6 block of the rendered scene.
const inkAt = (page: Page, x: number, y: number) =>
  page
    .locator('[data-testid="canvas"] canvas')
    .first()
    .evaluate((el, [x, y]) => {
      const c = el as HTMLCanvasElement
      const r = c.width / 1200
      const d = c.getContext('2d')!.getImageData(Math.round(x * r) - 3, Math.round(y * r) - 3, 6, 6).data
      let min = 255
      for (let i = 0; i < d.length; i += 4) min = Math.min(min, d[i]!, d[i + 1]!, d[i + 2]!)
      return min < 128
    }, [x, y] as const)
// The Fabric upper-canvas holds selection borders/controls — blank when nothing is selected.
const upperPixels = (page: Page) =>
  page.locator('[data-testid="canvas"] canvas.upper-canvas').evaluate((el) => (el as HTMLCanvasElement).toDataURL())

test('an erased pen line stays a movable object and its gap moves with it', async ({ page }) => {
  const { P } = mapper(await canvasBox(page))
  await selectTool(page, 'Pen')
  await dragScene(page, P, [500, 150], [800, 150])
  await selectTool(page, 'Eraser')
  await dragScene(page, P, [650, 120], [650, 180], 6)
  expect(await inkAt(page, 650, 150), 'gap erased').toBe(false)
  expect(await inkAt(page, 560, 150), 'rest of the line kept').toBe(true)

  // The son's bug: after erasing, the line could no longer be moved (it had been flattened).
  await selectTool(page, 'Select')
  await dragScene(page, P, [560, 150], [560, 350])
  expect(await inkAt(page, 560, 150), 'moved away').toBe(false)
  expect(await inkAt(page, 560, 350), 'line moved').toBe(true)
  expect(await inkAt(page, 760, 350), 'other half moved too').toBe(true)
  expect(await inkAt(page, 650, 350), 'the gap moved with it').toBe(false)
})

test('the erase is one undo step that brings the whole object back', async ({ page }) => {
  const { P } = mapper(await canvasBox(page))
  await selectTool(page, 'Pen')
  await dragScene(page, P, [500, 150], [800, 150])
  await selectTool(page, 'Eraser')
  await dragScene(page, P, [650, 120], [650, 180], 6)
  const erased = await canvasPixels(page)
  await page.click('button[title="Undo (Ctrl+Z)"]')
  await page.waitForTimeout(250)
  expect(await inkAt(page, 650, 150), 'undo restores the gap').toBe(true)
  expect(await inkAt(page, 560, 150), 'and keeps the line').toBe(true)
  await page.click('button[title="Redo (Ctrl+Shift+Z)"]')
  await page.waitForTimeout(250)
  expect(await canvasPixels(page), 'redo re-applies the erase').toBe(erased)
})

test('rubbing inside a shape without touching its outline leaves it intact and movable', async ({ page }) => {
  const { P } = mapper(await canvasBox(page))
  await selectTool(page, 'Polygon')
  await dragScene(page, P, [850, 450], [1100, 700])
  await selectTool(page, 'Eraser')
  await page.waitForTimeout(150)
  const drawn = await canvasPixels(page)
  await dragScene(page, P, [960, 600], [990, 610], 5)
  expect(await canvasPixels(page), 'nothing visible was under the eraser').toBe(drawn)
  await selectTool(page, 'Select')
  await dragScene(page, P, [975, 620], [975, 450])
  expect(await canvasPixels(page), 'the shape still moves').not.toBe(drawn)
})

test('an erased shape keeps its full outline after a resize and a rebuild', async ({ page }) => {
  const { P } = mapper(await canvasBox(page))
  await selectTool(page, 'Polygon')
  await dragScene(page, P, [100, 100], [300, 300]) // triangle: apex (200,100), base y=300
  await selectTool(page, 'Eraser')
  await dragScene(page, P, [200, 270], [200, 330], 5) // gap in the middle of the base
  await selectTool(page, 'Select')
  const c = P(200, 250)
  await page.mouse.click(c.x, c.y)
  await page.waitForTimeout(150)
  await dragScene(page, P, [300, 300], [450, 450], 10) // bottom-right handle → ~2x
  await selectTool(page, 'Pen') // tool switch rebuilds the scene from the model
  // The bigger triangle's far corners and apex must still be drawn (they were cropped away before).
  expect(await inkAt(page, 445, 448), 'bottom-right corner').toBe(true)
  expect(await inkAt(page, 105, 448), 'bottom-left corner').toBe(true)
  expect(await inkAt(page, 275, 102), 'apex').toBe(true)
  expect(await inkAt(page, 275, 450), 'the gap scaled along').toBe(false)
})

test('erased text keeps every new letter visible while typing more', async ({ page }) => {
  const { P } = mapper(await canvasBox(page))
  await selectTool(page, 'Text')
  const t = P(300, 400)
  await page.mouse.click(t.x, t.y)
  await page.keyboard.type('HELLO')
  await selectTool(page, 'Select')
  await page.waitForTimeout(150)
  const before = await canvasPixels(page)
  // Erase a sliver of the text, then type a lot more at its end.
  await selectTool(page, 'Eraser')
  await dragScene(page, P, [300, 360], [300, 440], 5)
  await selectTool(page, 'Select')
  const mid = P(330, 400)
  await page.mouse.dblclick(mid.x, mid.y)
  await page.keyboard.press('End')
  await page.keyboard.type(' WORLD WORLD')
  await selectTool(page, 'Pen')
  // Text is centred on its click point, so the longer text spills past BOTH sides of the original
  // ~260..340 box — exactly the part that used to be cropped away. Look right of it.
  let found = false
  for (let x = 370; x <= 440 && !found; x += 5) {
    for (let y = 386; y <= 414 && !found; y += 4) found = await inkAt(page, x, y)
  }
  expect(found, 'letters past the original box are drawn').toBe(true)
  expect(await canvasPixels(page)).not.toBe(before)
})

test('erasing a line away completely deletes it (no invisible leftover)', async ({ page }) => {
  const { P } = mapper(await canvasBox(page))
  await selectTool(page, 'Pen')
  await dragScene(page, P, [400, 300], [460, 300])
  await selectTool(page, 'Eraser')
  await page.click('button[title="Large (40px)"]')
  await dragScene(page, P, [380, 300], [480, 300], 10)
  expect(await inkAt(page, 430, 300)).toBe(false)
  await selectTool(page, 'Select')
  const blankUpper = await upperPixels(page)
  const q = P(430, 300)
  await page.mouse.click(q.x, q.y)
  await page.waitForTimeout(150)
  expect(await upperPixels(page), 'clicking where it was selects nothing').toBe(blankUpper)
})

test('the eraser size picker changes how wide the eraser rubs', async ({ page }) => {
  const { P } = mapper(await canvasBox(page))
  // Paint the background raster (fill) so the eraser has pixels to remove everywhere.
  await selectTool(page, 'Fill')
  const f = P(600, 400)
  await page.mouse.click(f.x, f.y)
  await page.waitForTimeout(200)
  expect(await inkAt(page, 300, 215)).toBe(true)

  await selectTool(page, 'Eraser') // opens the size submenu
  await page.click('button[title="Small (10px)"]')
  await dragScene(page, P, [200, 200], [400, 200], 10)
  expect(await inkAt(page, 300, 200), 'small erases on the stroke').toBe(false)
  expect(await inkAt(page, 300, 215), 'small leaves 15px away').toBe(true)

  await page.click('button[title="Large (40px)"]')
  await dragScene(page, P, [200, 400], [400, 400], 10)
  expect(await inkAt(page, 300, 415), 'large reaches 15px away').toBe(false)
})

test('the duplicate control clones the selected object', async ({ page }) => {
  const { s, P } = mapper(await canvasBox(page))

  await selectTool(page, 'Polygon')
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

test('pasting an image adds it, switches to select, and it is the active (deletable) object', async ({ page }) => {
  const blank = await canvasPixels(page)

  // Start in a non-select tool to exercise the auto-switch into select mode on paste.
  await selectTool(page, 'Pen')

  // Synthesize a clipboard paste carrying a solid-red PNG (no OS clipboard needed).
  await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 200
    c.height = 120
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(0, 0, 200, 120)
    const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/png'))
    const file = new File([blob], 'pasted.png', { type: 'image/png' })
    const dt = new DataTransfer()
    dt.items.add(file)
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  await page.waitForTimeout(400) // FileReader → image decode → add → tool switch → re-select

  expect(await canvasPixels(page), 'paste should draw the image onto the canvas').not.toBe(blank)
  await expect(page.locator('button[title="Select"]'), 'paste switches to the Select tool').toHaveClass(/active/)

  // Deleting removes the pasted image, proving it was added as the active/selected object — the
  // same selection that exposes the resize/rotate handles.
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(250)
  expect(await canvasPixels(page), 'deleting the selected paste reverts to blank').toBe(blank)
})
