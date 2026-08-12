import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Default: Node (functions e logica pura). I test COMPONENTE dichiarano
    // jsdom nel file con il docblock `// @vitest-environment jsdom`.
    environment: 'node',
    globals: true,
    // FUSO ORARIO DEL LOCALE, deciso qui e non nel comando: "TZ=… vitest"
    // funziona su Linux e sul Mac, su Windows no — e chi sviluppa da lì si
    // ritrovava "npm test" che non parte nemmeno. Le date del gestionale
    // (giornata commerciale, chiusure) dipendono dal fuso: senza, i test
    // passerebbero o fallirebbero a seconda di dove gira la macchina.
    env: { TZ: 'Europe/Rome' },
    include: ['tests/**/*.test.js', 'tests/**/*.test.jsx'],
    coverage: {
      provider: 'v8',
      include: ['functions/lib/**/*.js'],
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
})
