// @vitest-environment happy-dom
'use strict'

// ── LA CHIAMATA DEL MARKETPLACE DEI MODULI (REQ-LIC-012) ──────────────
//
// La chiamata vera, in api.js: il token di chi ha fatto l'accesso (la
// regia controlla che sia il titolare), il modulo, l'azione e l'indirizzo
// di ritorno nel corpo, e nessun errore che risale. Come gli altri test di
// api.js: Firebase finto, `api.js` vero.

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

const { azioneModulo } = await import('../../src/lib/api.js')
const URL_REGIA = 'https://europe-west1-drink-regia.cloudfunctions.net/moduloDallApp'
const RITORNO = 'https://tana.example/bar?tab=marketplace&sezione=moduli'

beforeEach(() => {
  st.token = 'tok-1'
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('azioneModulo', () => {
  it("manda modulo, azione e ritorno col token; legge l'indirizzo del pagamento", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ ok: true, checkout_url: 'https://checkout.stripe.com/c/pay/cs_test_1' }),
      })
    )
    vi.stubGlobal('fetch', fetch)
    expect(await azioneModulo(URL_REGIA, 'magazzino', 'aggiungi', RITORNO)).toEqual({
      ok: true,
      checkout_url: 'https://checkout.stripe.com/c/pay/cs_test_1',
      dal: null,
      in_attesa: false,
    })
    const [url, opzioni] = fetch.mock.calls[0]
    expect(url).toBe(URL_REGIA)
    expect(opzioni.method).toBe('POST')
    expect(opzioni.headers.Authorization).toBe('Bearer tok-1')
    expect(JSON.parse(opzioni.body)).toEqual({ modulo: 'magazzino', azione: 'aggiungi', ritorno: RITORNO })
  })

  it('il rifiuto della regia arriva col suo testo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ status: 403, json: () => Promise.resolve({ ok: false, errore: 'Solo il titolare.' }) }))
    )
    expect(await azioneModulo(URL_REGIA, 'staff', 'prova', RITORNO)).toEqual({ ok: false, status: 403, errore: 'Solo il titolare.' })
  })

  it('senza accesso non chiama', async () => {
    st.token = null
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(await azioneModulo(URL_REGIA, 'staff', 'prova', RITORNO)).toEqual({ ok: false, status: 401, errore: null })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('senza rete non risale nessun errore', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('rete'))))
    expect(await azioneModulo(URL_REGIA, 'staff', 'disdici', RITORNO)).toEqual({ ok: false, status: 0, errore: null })
  })
})
