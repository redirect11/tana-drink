// @vitest-environment happy-dom
'use strict'

// ── LA CHIAMATA DELLA PRESENTAZIONE (REQ-FLOTTA-026) ──────────────────
//
// La chiamata vera, in api.js: il token di chi ha fatto l'accesso, la
// versione nel corpo, e nessun errore che risale. Senza rete o senza
// accesso torna un esito non riuscito, e si riprova alla prossima apertura.
// Come gli altri test di api.js: Firebase finto, `api.js` vero.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const st = vi.hoisted(() => ({ token: 'tok-1' }))

vi.mock('../../src/lib/firebaseClient.js', () => ({
  db: {},
  auth: {
    get currentUser() {
      return st.token ? { uid: 'u1', getIdToken: () => Promise.resolve(st.token) } : null
    },
  },
  functions: {},
  storage: {},
}))

vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: () => ({}),
  getDoc: vi.fn(),
  getDocFromCache: vi.fn(),
  getDocs: vi.fn(),
  getDocsFromCache: vi.fn(),
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: () => ({}),
  where: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: () => () => {},
  serverTimestamp: () => null,
  increment: (n) => n,
  writeBatch: () => ({}),
  Timestamp: class {},
}))

const { presentaAllaRegia } = await import('../../src/lib/api.js')
const URL_REGIA = 'https://europe-west1-drink-regia.cloudfunctions.net/presentazione'

beforeEach(() => {
  st.token = 'tok-1'
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('presentaAllaRegia', () => {
  it('manda la versione col token, e legge la risposta', async () => {
    const fetch = vi.fn(() =>
      Promise.resolve({ status: 200, json: () => Promise.resolve({ ok: true, licenza: 'non_dalla_regia' }) })
    )
    vi.stubGlobal('fetch', fetch)
    expect(await presentaAllaRegia(URL_REGIA, 'v1.10.4')).toEqual({ ok: true, licenza: 'non_dalla_regia' })
    const [url, opzioni] = fetch.mock.calls[0]
    expect(url).toBe(URL_REGIA)
    expect(opzioni.headers.Authorization).toBe('Bearer tok-1')
    expect(JSON.parse(opzioni.body)).toEqual({ versione: 'v1.10.4' })
  })

  it('senza accesso non chiama', async () => {
    st.token = null
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect((await presentaAllaRegia(URL_REGIA, 'v1.10.4')).ok).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('senza rete non risale nessun errore', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('rete'))))
    expect(await presentaAllaRegia(URL_REGIA, 'v1.10.4')).toEqual({ ok: false, status: 0, errore: null })
  })
})
