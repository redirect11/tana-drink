// @vitest-environment happy-dom
'use strict'

// ── LA CONFIGURAZIONE LETTA ALL'AVVIO (REQ-FLOTTA-021) ─────────────────
//
// L'utente, 31/10/2026: «tana-drink è sempre lo stesso ma dove si installa
// e come si configura è roba di regia». Nell'on premise c'è un'immagine
// sola per tutti i locali, e il backend del locale lo dice un file servito
// accanto all'app, `configurazione.json`, scritto dalla regia.
//
// LA PROVA CHE CONTA È LA PRIMA: SENZA IL FILE NON CAMBIA NIENTE. La Tana
// non ce l'ha, e deve partire con le `VITE_*` della sua build, subito,
// senza aspettare nessuna rete e senza ricaricarsi.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { accendiDemo, spegniDemo } from '../helpers/demo.js'

const CHIAVE = 'drink:configurazione'

const BUILD_TANA = {
  VITE_FIREBASE_API_KEY: 'chiave-tana',
  VITE_FIREBASE_PROJECT_ID: 'tana-drink',
  VITE_FIREBASE_AUTH_DOMAIN: 'tana-drink.firebaseapp.com',
}

const FILE = {
  backend: 'firebase',
  locale: 'bar-mario',
  firebase: { apiKey: 'chiave-mario', projectId: 'mario-drink', vapidKey: 'vapid-mario' },
}

function build(env) {
  for (const k of Object.keys(BUILD_TANA)) vi.stubEnv(k, '')
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
}

// Il modulo ricorda la configurazione dell'apertura: ogni prova è
// un'apertura nuova.
async function apri() {
  vi.resetModules()
  return import('../../src/porte/configurazione.js')
}

const ricordato = () => JSON.parse(localStorage.getItem(CHIAVE))

beforeEach(() => {
  localStorage.clear()
  build(BUILD_TANA)
})
afterEach(() => {
  vi.unstubAllEnvs()
  spegniDemo()
})

describe('all’avvio', () => {
  it('senza file vale la build, come prima', async () => {
    const { configurazione } = await apri()
    expect(configurazione()).toMatchObject({
      backend: 'firebase',
      locale: 'tana',
      origine: 'build',
      firebase: { apiKey: 'chiave-tana', projectId: 'tana-drink', authDomain: 'tana-drink.firebaseapp.com', vapidKey: '' },
    })
  })

  it('con un file letto un’altra volta vince il file', async () => {
    localStorage.setItem(CHIAVE, JSON.stringify(FILE))
    const { configurazione } = await apri()
    expect(configurazione()).toMatchObject({
      locale: 'bar-mario',
      origine: 'file',
      firebase: { apiKey: 'chiave-mario', projectId: 'mario-drink', vapidKey: 'vapid-mario', authDomain: '' },
    })
  })

  it('un ricordo rovinato non ferma l’avvio: vale la build', async () => {
    localStorage.setItem(CHIAVE, '{rotto')
    const { configurazione } = await apri()
    expect(configurazione().origine).toBe('build')
  })

  it('la demo è decisa dalla build, mai dal file', async () => {
    localStorage.setItem(CHIAVE, JSON.stringify(FILE))
    accendiDemo()
    const { configurazione, aggiornaConfigurazione } = await apri()
    expect(configurazione().origine).toBe('build')
    const scarica = vi.fn()
    expect(await aggiornaConfigurazione({ scarica })).toBe('demo')
    expect(scarica).not.toHaveBeenCalled()
  })
})

describe('il file', () => {
  it('si segue solo se dice un backend che questa app ha, con chiave e progetto', async () => {
    const { leggiFile } = await apri()
    expect(leggiFile(FILE)).not.toBeNull()
    expect(leggiFile({ ...FILE, backend: 'pocketbase' })).toBeNull()
    expect(leggiFile({ ...FILE, firebase: { apiKey: 'x' } })).toBeNull()
    expect(leggiFile({ ...FILE, firebase: { projectId: 'x', apiKey: '  ' } })).toBeNull()
    for (const v of [null, [], 'firebase', {}]) expect(leggiFile(v)).toBeNull()
  })

  it('senza lo slug del locale prende quello della build', async () => {
    const { leggiFile } = await apri()
    expect(leggiFile({ ...FILE, locale: undefined }).locale).toBe('tana')
  })

  it('non porta dentro campi che la porta non conosce', async () => {
    const { leggiFile } = await apri()
    const c = leggiFile({ ...FILE, firebase: { ...FILE.firebase, segreto: 'no', apiKey: 'k' } })
    expect(c.firebase).not.toHaveProperty('segreto')
  })
})

describe('si chiede in sottofondo', () => {
  const nonCe = async () => null
  const arriva = (v) => async () => v

  it('LA TANA: nessun file, niente da cambiare, niente da ricaricare', async () => {
    const { aggiornaConfigurazione } = await apri()
    const ricarica = vi.fn()
    expect(await aggiornaConfigurazione({ scarica: nonCe, ricarica, dallApertura: () => 0 })).toBe('uguale')
    expect(ricarica).not.toHaveBeenCalled()
    expect(localStorage.getItem(CHIAVE)).toBeNull()
  })

  it('senza rete si tiene quello che si sa', async () => {
    localStorage.setItem(CHIAVE, JSON.stringify(FILE))
    const { aggiornaConfigurazione, configurazione } = await apri()
    const ricarica = vi.fn()
    const giu = async () => {
      throw new TypeError('Failed to fetch')
    }
    expect(await aggiornaConfigurazione({ scarica: giu, ricarica })).toBe('senza-rete')
    expect(ricordato()).toEqual(FILE)
    expect(configurazione().origine).toBe('file')
    expect(ricarica).not.toHaveBeenCalled()
  })

  it('un file nuovo nei primi secondi: si ricarica una volta, e si riparte con lui', async () => {
    let m = await apri()
    const ricarica = vi.fn()
    expect(await m.aggiornaConfigurazione({ scarica: arriva(FILE), ricarica, dallApertura: () => 1500 })).toBe('ricaricata')
    expect(ricarica).toHaveBeenCalledTimes(1)
    expect(ricordato()).toEqual(FILE)
    // La riapertura parte col file, e rileggerlo non ricarica più.
    m = await apri()
    expect(m.configurazione().firebase.projectId).toBe('mario-drink')
    expect(await m.aggiornaConfigurazione({ scarica: arriva(FILE), ricarica, dallApertura: () => 1500 })).toBe('uguale')
    expect(ricarica).toHaveBeenCalledTimes(1)
  })

  it('un file nuovo che arriva tardi non ricarica sotto le mani: vale dall’apertura dopo', async () => {
    let m = await apri()
    const ricarica = vi.fn()
    const tardi = () => m.RICARICA_ENTRO_MS + 1
    expect(await m.aggiornaConfigurazione({ scarica: arriva(FILE), ricarica, dallApertura: tardi })).toBe('al-prossimo-avvio')
    expect(ricarica).not.toHaveBeenCalled()
    // Questa apertura resta com'era.
    expect(m.configurazione().origine).toBe('build')
    m = await apri()
    expect(m.configurazione().origine).toBe('file')
  })

  it('un file tolto dalla regia: si torna alla build', async () => {
    localStorage.setItem(CHIAVE, JSON.stringify(FILE))
    const { aggiornaConfigurazione } = await apri()
    const ricarica = vi.fn()
    expect(await aggiornaConfigurazione({ scarica: nonCe, ricarica, dallApertura: () => 0 })).toBe('ricaricata')
    expect(localStorage.getItem(CHIAVE)).toBeNull()
  })

  it('l’immagine on premise, senza backend nella build, non dimentica l’ultimo file buono', async () => {
    build({})
    localStorage.setItem(CHIAVE, JSON.stringify(FILE))
    const { aggiornaConfigurazione } = await apri()
    const ricarica = vi.fn()
    expect(await aggiornaConfigurazione({ scarica: nonCe, ricarica, dallApertura: () => 0 })).toBe('uguale')
    expect(ricordato()).toEqual(FILE)
    expect(ricarica).not.toHaveBeenCalled()
  })

  it('un file non valido si dice in console e vale la build', async () => {
    const avviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { aggiornaConfigurazione } = await apri()
    const ricarica = vi.fn()
    expect(await aggiornaConfigurazione({ scarica: arriva({ backend: 'pocketbase' }), ricarica })).toBe('uguale')
    expect(avviso).toHaveBeenCalledWith(expect.stringContaining('configurazione.json non valido'))
    expect(ricarica).not.toHaveBeenCalled()
    avviso.mockRestore()
  })

  it('un file uguale alla build non è un motivo per ricaricare', async () => {
    const { aggiornaConfigurazione } = await apri()
    const ricarica = vi.fn()
    const comeLaBuild = { backend: 'firebase', firebase: { apiKey: 'chiave-tana', projectId: 'tana-drink', authDomain: 'tana-drink.firebaseapp.com' } }
    expect(await aggiornaConfigurazione({ scarica: arriva(comeLaBuild), ricarica, dallApertura: () => 0 })).toBe('uguale')
    expect(ricarica).not.toHaveBeenCalled()
  })
})

describe('come si scarica', () => {
  const risposta = (status, tipo, corpo) => ({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => tipo },
    json: () => (typeof corpo === 'string' ? Promise.reject(new SyntaxError('JSON')) : Promise.resolve(corpo)),
  })

  it('accanto all’app, senza la cache del browser', async () => {
    const { scaricaFile } = await apri()
    const fetchFn = vi.fn(async () => risposta(200, 'application/json', FILE))
    expect(await scaricaFile(fetchFn)).toEqual(FILE)
    expect(fetchFn).toHaveBeenCalledWith('/configurazione.json', { cache: 'no-store' })
  })

  it('«non c’è» quando l’hosting risponde 404 o con la pagina dell’app', async () => {
    const { scaricaFile } = await apri()
    expect(await scaricaFile(async () => risposta(404, 'text/html'))).toBeNull()
    expect(await scaricaFile(async () => risposta(200, 'text/html; charset=utf-8'))).toBeNull()
  })

  it('un errore del server non dice niente: si tiene quello che si sa', async () => {
    const { scaricaFile } = await apri()
    await expect(scaricaFile(async () => risposta(503, 'text/html'))).rejects.toThrow('503')
  })

  it('un JSON rotto è un file non valido, non un file assente', async () => {
    const { scaricaFile, leggiFile } = await apri()
    const v = await scaricaFile(async () => risposta(200, 'application/json', 'rotto'))
    expect(v).toEqual({})
    expect(leggiFile(v)).toBeNull()
  })
})

describe('il file non resta vecchio', () => {
  it('l’hosting lo fa ricontrollare sempre', () => {
    const firebase = JSON.parse(readFileSync('firebase.json', 'utf8'))
    const voce = firebase.hosting.headers.find((h) => h.source === '/configurazione.json')
    expect(voce?.headers).toContainEqual({ key: 'Cache-Control', value: 'no-cache' })
  })

  it('il service worker non lo tocca: senza rete la richiesta fallisce, non risponde una copia', () => {
    const ascoltatori = {}
    const self = { addEventListener: (n, f) => (ascoltatori[n] = f), location: { origin: 'https://tana.example' }, clients: {} }
    const sorgente = readFileSync('public/sw.js', 'utf8')
    const caches = { match: async () => undefined }
    new Function('self', 'caches', 'fetch', sorgente)(self, caches, () => Promise.reject(new Error('niente rete, qui')))
    const chiedi = (path) => {
      let risposto = false
      ascoltatori.fetch({ request: { url: `https://tana.example${path}`, method: 'GET' }, respondWith: () => (risposto = true) })
      return risposto
    }
    expect(chiedi('/configurazione.json')).toBe(false)
    // Il resto passa ancora di lì.
    expect(chiedi('/index.html')).toBe(true)
  })
})

// Le librerie di Firebase finte: si guarda solo con che progetto nasce
// l'app. (vi.mock sale in cima al file, e qui sopra nessuno le usa.)
let opzioniApp = null
vi.mock('firebase/app', () => ({ initializeApp: (opzioni) => (opzioniApp = opzioni) }))
vi.mock('firebase/app-check', () => ({ initializeAppCheck: () => {}, ReCaptchaV3Provider: class {} }))
vi.mock('firebase/firestore', () => ({
  initializeFirestore: () => ({}),
  getFirestore: () => ({}),
  persistentLocalCache: () => ({}),
  persistentMultipleTabManager: () => ({}),
  connectFirestoreEmulator: () => {},
  disableNetwork: () => Promise.resolve(),
}))
vi.mock('firebase/functions', () => ({ getFunctions: () => ({}), connectFunctionsEmulator: () => {} }))
vi.mock('firebase/auth', () => ({ getAuth: () => ({}), connectAuthEmulator: () => {} }))
vi.mock('firebase/storage', () => ({ getStorage: () => ({}), connectStorageEmulator: () => {} }))

describe('il client di Firebase', () => {
  it('nasce col progetto della build, senza file', async () => {
    vi.resetModules()
    await import('../../src/lib/firebaseClient.js')
    expect(opzioniApp).toMatchObject({ apiKey: 'chiave-tana', projectId: 'tana-drink' })
  })

  it('nasce col progetto del file, quando la regia l’ha scritto', async () => {
    localStorage.setItem(CHIAVE, JSON.stringify(FILE))
    vi.resetModules()
    await import('../../src/lib/firebaseClient.js')
    expect(opzioniApp).toMatchObject({ apiKey: 'chiave-mario', projectId: 'mario-drink' })
  })
})
