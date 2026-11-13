// =====================================================================
//  I TEST END-TO-END DEI CASI D'USO (REQ-DEV-019).
//
//    npm run test:e2e          # in locale, sugli emulatori completi (scripts/test-e2e.mjs)
//
//  Un caso d'uso (requirements/casi-uso.yaml) si prova intero, coi soli
//  gesti di chi lavora, sull'app compilata e con le Functions sotto. Due
//  posti dove girare, stessi test:
//
//  - IN LOCALE: Auth, Firestore, Storage e Functions emulati
//    (`firebase emulators:exec`, vedi package.json), l'app compilata con
//    .env.sistema e servita qui sotto;
//  - SULL'AMBIENTE GENERATO (.github/workflows/e2e.yml): E2E_URL è il
//    canale d'anteprima del progetto di prova, E2E_PROGETTO il progetto da
//    seminare prima di ogni test (tests/sistema/semina.mjs), E2E_PASSWORD
//    la password delle utenze.
// =====================================================================
import { defineConfig } from '@playwright/test'

const PORTA = 4811
const remoto = process.env.E2E_URL

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.js',
  // Un giro alla volta: i test seminano lo stesso database.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Sul progetto vero la semina e le Functions al primo colpo sono più
  // lente degli emulatori.
  timeout: remoto ? 180_000 : 90_000,
  expect: { timeout: remoto ? 20_000 : 10_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never', outputFolder: 'rapporto-e2e' }]] : 'list',
  use: {
    baseURL: remoto || `http://localhost:${PORTA}`,
    channel: process.env.CI ? undefined : 'chrome',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: remoto
    ? undefined
    : {
        command: `npx vite build --mode sistema --outDir dist-e2e && npx vite preview --mode sistema --outDir dist-e2e --port ${PORTA} --strictPort`,
        url: `http://localhost:${PORTA}`,
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
      },
})
