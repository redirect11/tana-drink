// =====================================================================
//  I TEST DI SISTEMA: l'app intera, come la usa il banco (REQ-DEV-018).
//
//    npm run test:sistema
//
//  Il gradino «sistema» del modello a V (docs/modello-a-v.md): un
//  requisito si prova sull'app COMPILATA, in un browser vero, con Auth e
//  Firestore emulati e le regole vere. I test di unità e di integrazione
//  provano i pezzi; qui si prova che, messi insieme, al banco fanno quello
//  che il requisito promette.
//
//  Gli emulatori li accende `firebase emulators:exec` (vedi package.json),
//  che passa a questo processo FIRESTORE_EMULATOR_HOST e
//  FIREBASE_AUTH_EMULATOR_HOST; il database si semina da zero prima di
//  ogni test (tests/sistema/banco.mjs, tests/sistema/semina.mjs).
// =====================================================================
import { defineConfig } from '@playwright/test'

const PORTA = 4810

export default defineConfig({
  testDir: 'tests/sistema',
  testMatch: '**/*.spec.js',
  // Un browser alla volta: i test condividono lo stesso database emulato,
  // e due giri in parallelo si pesterebbero i conti.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORTA}`,
    // In locale il Chrome installato: niente browser da scaricare. In CI
    // quello di Playwright, installato dal workflow.
    channel: process.env.CI ? undefined : 'chrome',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    // Un tablet al banco, in orizzontale.
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // La build è quella vera, con la configurazione degli emulatori
    // (.env.sistema), in una cartella sua: non si mescola con dist/.
    command: `npx vite build --mode sistema --outDir dist-sistema && npx vite preview --mode sistema --outDir dist-sistema --port ${PORTA} --strictPort`,
    url: `http://localhost:${PORTA}`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
})
