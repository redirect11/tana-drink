// @vitest-environment happy-dom
'use strict'

// NELLA DEMO LA RETE DEL DATABASE SI SPEGNE PRIMA DI TUTTO, E NESSUN
// SERVIZIO VERO SI APRE (REQ-FLOTTA-019, docs/modalita-demo.md, «I test»).
//
// Le librerie di Firebase qui sono finte e registrano ogni chiamata, in
// ordine. Con la costante della demo accesa, firebaseClient deve:
//   - aprire l'app col nome della sessione (la cache della demo);
//   - spegnere la rete come PRIMA operazione su Firestore appena creato;
//   - non aprire Firebase Auth (l'accesso è finto), né App Check;
//   - negare il client diretto, che andrebbe dritto al server.
// Con la costante spenta, tutto come prima.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { accendiDemo, spegniDemo } from '../helpers/demo.js'

let registro = []
const segna = (nome) => (...a) => {
  registro.push(nome)
  return { nome, a }
}

vi.mock('firebase/app', () => ({
  initializeApp: (opzioni, nome) => {
    registro.push(`initializeApp:${nome ?? '[DEFAULT]'}`)
    return { name: nome ?? '[DEFAULT]', options: opzioni }
  },
}))
vi.mock('firebase/app-check', () => ({ initializeAppCheck: segna('initializeAppCheck'), ReCaptchaV3Provider: class {} }))
vi.mock('firebase/firestore', () => ({
  initializeFirestore: segna('initializeFirestore'),
  getFirestore: segna('getFirestore'),
  persistentLocalCache: () => ({}),
  persistentMultipleTabManager: () => ({}),
  connectFirestoreEmulator: segna('connectFirestoreEmulator'),
  disableNetwork: (...a) => {
    registro.push('disableNetwork')
    return Promise.resolve(a)
  },
}))
vi.mock('firebase/functions', () => ({ getFunctions: segna('getFunctions'), connectFunctionsEmulator: segna('connectFunctionsEmulator') }))
vi.mock('firebase/auth', () => ({ getAuth: segna('getAuth'), connectAuthEmulator: segna('connectAuthEmulator') }))
vi.mock('firebase/storage', () => ({ getStorage: segna('getStorage'), connectStorageEmulator: segna('connectStorageEmulator') }))

async function carica(demo) {
  vi.resetModules()
  accendiDemo(demo)
  return import('../../src/lib/firebaseClient.js')
}

beforeEach(() => {
  registro = []
  localStorage.clear()
})
afterEach(() => {
  spegniDemo()
})

describe('firebaseClient nella demo', () => {
  it('apre l’app col nome della sessione, e la cache con lei', async () => {
    const fb = await carica(true)
    expect(registro[0]).toMatch(/^initializeApp:demo-\d{4}-\d{2}-\d{2}-1$/)
    expect(fb.app.name).toMatch(/^demo-/)
  })

  it('spegne la rete come prima operazione su Firestore', async () => {
    await carica(true)
    const i = registro.indexOf('initializeFirestore')
    expect(i).toBeGreaterThan(-1)
    expect(registro[i + 1]).toBe('disableNetwork')
  })

  it('non apre Firebase Auth né App Check, e non si collega agli emulatori', async () => {
    const fb = await carica(true)
    expect(registro).not.toContain('getAuth')
    expect(registro).not.toContain('initializeAppCheck')
    expect(registro.filter((x) => x.startsWith('connect'))).toEqual([])
    // L'accesso è quello finto, con la scelta del ruolo.
    expect(typeof fb.auth.scegliRuolo).toBe('function')
    expect(fb.isFirebaseConfigured).toBe(true)
  })

  it('il client diretto, che andrebbe al server, non c’è', async () => {
    const fb = await carica(true)
    await expect(fb.firestoreLite()).rejects.toThrow(/demo/)
  })
})

describe('firebaseClient in un locale vero', () => {
  it('come sempre: Auth vero, rete accesa, app di default', async () => {
    // Nei test le variabili di Firebase non ci sono: l'avviso che manca la
    // configurazione è quello di sempre, e qui è atteso. Nella demo no:
    // non le usa.
    const avviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await carica(false)
    expect(avviso).toHaveBeenCalledWith(expect.stringMatching(/VITE_FIREBASE_API_KEY/))
    avviso.mockRestore()
    expect(registro[0]).toBe('initializeApp:[DEFAULT]')
    expect(registro).toContain('getAuth')
    expect(registro).not.toContain('disableNetwork')
  })
})
