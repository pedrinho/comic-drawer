import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
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
      // NOTE: Canvas.tsx and App.tsx are intentionally NO LONGER excluded — they hold the
      // app's core (tools, undo/redo, save/load) and must count. Thresholds are the current
      // honest floor (real numbers ~73/69/64), set just below to catch regressions without
      // flaking. The real target is 85/80 — raise these as coverage improves; do NOT re-exclude
      // the big files to inflate the number. Canvas.tsx (~44%) is the main remaining gap; its
      // Fabric pointer pipeline needs browser-level tests, tracked separately.
      thresholds: {
        lines: 70,
        functions: 60,
        branches: 65,
        statements: 70,
      },
    },
  },
})
