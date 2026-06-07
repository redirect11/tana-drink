import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Le functions e i loro test girano in Node (nessun DOM necessario).
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['functions/lib/**/*.js'],
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
})
