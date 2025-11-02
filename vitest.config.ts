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
        '**/Canvas.tsx',
      ],
      thresholds: {
        lines: 85,
        functions: 70,
        branches: 80,
        statements: 85,
      },
    },
  },
})
