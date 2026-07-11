import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Default: Node (functions e logica pura). I test COMPONENTE dichiarano
    // jsdom nel file con il docblock `// @vitest-environment jsdom`.
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.js', 'tests/**/*.test.jsx'],
    coverage: {
      provider: 'v8',
      include: ['functions/lib/**/*.js'],
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
})
