import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Le costanti che di solito inietta Vite al build. Senza, il codice che le
  // legge cade nel ramo "non c'è versione" e i test che riguardano gli
  // aggiornamenti non potrebbero nemmeno partire.
  define: {
    __APP_VERSION__: JSON.stringify('v0.0.0-test'),
    __BUILD_ID__: JSON.stringify('test'),
    __GIT_BRANCH__: JSON.stringify('test'),
    __GIT_COMMIT__: JSON.stringify('0000000'),
  },
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
