import { defineConfig } from '@playwright/test'

/**
 * End-to-end suite for the Fabric pointer pipeline — the interactive gestures jsdom/vitest can't
 * drive (draw, resize, text edit, undo/redo, the on-selection controls). Runs headless Chromium
 * against a dev server it starts itself. See `docs/e2e.md`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5178',
    viewport: { width: 1400, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run dev -- --port 5178 --strictPort',
    url: 'http://localhost:5178',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
