import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // The Playwright e2e specs live in e2e/ and use @playwright/test's runner, not vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.config.*',
        '**/index.html',
        '**/main.tsx',
        '**/vite-env.d.ts',
      ],
      // NOTE: Canvas.tsx and App.tsx are intentionally NOT excluded — they hold the app's core
      // (tools, undo/redo, save/load) and must count. Thresholds are the current honest floor
      // (real numbers ~84/74/72), set just below to catch regressions without flaking. The real
      // target is 85/80 — raise these as coverage improves; do NOT re-exclude the big files to
      // inflate the number. The Canvas refactor (Phases 1–6) closed the old gap: Canvas.tsx is now
      // 100% and its Fabric pointer pipeline is covered by unit tests + the Playwright e2e suite
      // (see e2e/ and docs/e2e.md). App.tsx (~57%) is the main remaining gap.
      thresholds: {
        lines: 82,
        functions: 70,
        branches: 70,
        statements: 82,
      },
    },
  },
})
