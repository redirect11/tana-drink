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

  // R3: il tablet passa al sito uguale per tutti, che non ha backend nella
  // build, e non ricorda nessun file. Senza rete il file non arriva mai: il
  // progetto giusto deve venire dalla pagina, al primo colpo.
  it('nasce col progetto della pagina anche se la build non ne ha, senza aspettare il file', async () => {
    build({})
    document.head.innerHTML = `<script id="configurazione" type="application/json">${JSON.stringify(FILE)}</script>`
    vi.resetModules()
    const client = await import('../../src/lib/firebaseClient.js')
    expect(opzioniApp).toMatchObject({ apiKey: 'chiave-mario', projectId: 'mario-drink' })
    expect(client.isFirebaseConfigured).toBe(true)
    document.head.innerHTML = ''
  })
})

// ── IL SITO UGUALE PER TUTTI I LOCALI (REQ-FLOTTA-034) ─────────────────
//
// La regia compila il sito una volta per versione e al deploy scrive la
// configurazione del locale anche DENTRO index.html. Il caso che conta è
// R3 dell'analisi del 18/11/2026: un tablet che aveva il locale nella build,
// e nessuna configurazione ricordata, passa al sito uguale per tutti. Con la
// pagina arrivata e il file no, senza il blocco partiva su un progetto finto
// e mostrava la coda vuota.
describe('il blocco nella pagina', () => {
  const PAGINA = {
    backend: 'firebase',
    locale: 'bar-mario',
    firebase: { apiKey: 'chiave-mario', projectId: 'mario-drink', appId: '1:2:web:3' },
    venue: { venue_name: 'Bar Mario', venue_socials: [{ piattaforma: 'x', href: 'javascript:alert(1)' }] },
    profilo: 'leggero',
    regia: 'drink-regia-test',
  }
  const mettiBlocco = (testo) => {
    document.head.innerHTML = `<script id="configurazione" type="application/json">${testo}</script>`
  }
  afterEach(() => {
    document.head.innerHTML = ''
  })

  it('il tablet che non ricorda niente parte col blocco, senza aspettare nessun file', async () => {
    build({})
    mettiBlocco(JSON.stringify(PAGINA))
    const { configurazione, haBackend } = await apri()
    const c = configurazione()
    expect(c).toMatchObject({ origine: 'pagina', locale: 'bar-mario', profilo: 'leggero', regia: 'drink-regia-test' })
    expect(c.firebase.projectId).toBe('mario-drink')
    expect(haBackend(c)).toBe(true)
    // Il locale arriva coi dati, ma un link che non è un link resta fuori.
    expect(c.venue).toEqual({ venue_name: 'Bar Mario', venue_socials: [] })
  })

  it('il locale della pagina è quello che l’app mostra: nome, slug e tema di Lime', async () => {
    build({})
    mettiBlocco(JSON.stringify(PAGINA))
    vi.resetModules()
    const venue = await import('../../src/lib/venue.js')
    const temi = await import('../../src/lib/themes.js')
    expect(venue.CLIENTE).toBe('bar-mario')
    expect(venue.venuePredefinito().venue_name).toBe('Bar Mario')
    // Niente della Tana sotto: il locale della pagina prende il posto di
    // quello della build, non ci si mescola.
    expect(venue.venuePredefinito().venue_address).toBe('')
    expect(temi.TEMA_DI_PARTENZA).toBe('lime-scuro')
  })

  it('profilo e regia della pagina arrivano a chi li usa', async () => {
    build({})
    mettiBlocco(JSON.stringify(PAGINA))
    vi.resetModules()
    const { profiloLeggero } = await import('../../src/lib/limiti.js')
    const { urlFunzioneRegia } = await import('../../src/lib/funzioniRegia.js')
    expect(profiloLeggero({})).toBe(true)
    expect(urlFunzioneRegia('presentazione')).toBe('https://europe-west1-drink-regia-test.cloudfunctions.net/presentazione')
  })

  it('il file ricordato nel dispositivo vince sul blocco', async () => {
    localStorage.setItem(CHIAVE, JSON.stringify(FILE))
    mettiBlocco(JSON.stringify(PAGINA))
    const { configurazione } = await apri()
    expect(configurazione()).toMatchObject({ origine: 'file', locale: 'bar-mario' })
    expect(configurazione().firebase.apiKey).toBe('chiave-mario')
    expect(configurazione().firebase.vapidKey).toBe('vapid-mario')
  })

  it('un blocco rovinato o che l’app non sa seguire vale come nessun blocco', async () => {
    for (const testo of ['{rotto', JSON.stringify({ backend: 'pocketbase' }), '']) {
      mettiBlocco(testo)
      const { configurazione } = await apri()
      expect(configurazione().origine, testo).toBe('build')
    }
  })

  it('un profilo o una regia fuori elenco nel blocco: valgono quelli della build', async () => {
    build({ ...BUILD_TANA, VITE_PROFILO: 'leggero', VITE_REGIA_PROGETTO: 'drink-regia' })
    mettiBlocco(JSON.stringify({ ...PAGINA, profilo: 'gratis', regia: 'una-regia-qualunque' }))
    const { configurazione } = await apri()
    expect(configurazione()).toMatchObject({ origine: 'pagina', profilo: 'leggero', regia: 'drink-regia' })
  })

  // NESSUN GIRO DI RICARICHE. Blocco e file diversi (la regia ha cambiato
  // la configurazione dopo il deploy): una ricarica, e alla riapertura il
  // file ricordato vince e non c'è più niente da cambiare.
  it('file diverso dal blocco: una ricarica sola, poi niente', async () => {
    mettiBlocco(JSON.stringify(PAGINA))
    let m = await apri()
    const ricarica = vi.fn()
    const nuovo = { ...PAGINA, firebase: { apiKey: 'altra-chiave', projectId: 'mario-drink' } }
    expect(await m.aggiornaConfigurazione({ scarica: async () => nuovo, ricarica, dallApertura: () => 0 })).toBe('ricaricata')
    m = await apri()
    expect(m.configurazione().firebase.apiKey).toBe('altra-chiave')
    expect(await m.aggiornaConfigurazione({ scarica: async () => nuovo, ricarica, dallApertura: () => 0 })).toBe('uguale')
    expect(ricarica).toHaveBeenCalledTimes(1)
  })

  // Una rete che a turno restituisce un JSON rotto e il file buono: se il
  // file rotto facesse dimenticare quello buono, l'app passerebbe al blocco
  // e tornerebbe al file a ogni giro, ricaricandosi ogni volta.
  it('un file rovinato non fa dimenticare quello buono: niente ricarica', async () => {
    const avviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    localStorage.setItem(CHIAVE, JSON.stringify(FILE))
    mettiBlocco(JSON.stringify(PAGINA))
    const { aggiornaConfigurazione, configurazione } = await apri()
    const ricarica = vi.fn()
    expect(await aggiornaConfigurazione({ scarica: async () => ({}), ricarica, dallApertura: () => 0 })).toBe('uguale')
    expect(ricordato()).toEqual(FILE)
    expect(configurazione().origine).toBe('file')
    expect(ricarica).not.toHaveBeenCalled()
    avviso.mockRestore()
  })

  it('il file tolto dalla regia riporta al blocco, non alla build', async () => {
    localStorage.setItem(CHIAVE, JSON.stringify(FILE))
    mettiBlocco(JSON.stringify({ ...PAGINA, firebase: { apiKey: 'nuova', projectId: 'mario-drink' } }))
    const { aggiornaConfigurazione } = await apri()
    const ricarica = vi.fn()
    expect(await aggiornaConfigurazione({ scarica: async () => null, ricarica, dallApertura: () => 0 })).toBe('ricaricata')
    expect(localStorage.getItem(CHIAVE)).toBeNull()
  })
})

describe('senza backend nessuno ha un conto in mano', () => {
  it('il file che arriva tardi ricarica lo stesso: il tablet non resta fermo fino alla prossima apertura', async () => {
    build({})
    const m = await apri()
    const ricarica = vi.fn()
    const tardi = () => m.RICARICA_ENTRO_MS * 100
    expect(m.senzaBackend()).toBe(true)
    expect(await m.aggiornaConfigurazione({ scarica: async () => FILE, ricarica, dallApertura: tardi })).toBe('ricaricata')
    expect(ricarica).toHaveBeenCalledTimes(1)
  })

  it('con la build della Tana l’app ha il suo backend', async () => {
    const { senzaBackend } = await apri()
    expect(senzaBackend()).toBe(false)
  })

  it('la demo non ha bisogno di backend: non è «senza»', async () => {
    build({})
    accendiDemo()
    const { senzaBackend } = await apri()
    expect(senzaBackend()).toBe(false)
  })
})

describe('senza backend si riprova', () => {
  // Un orologio e una finestra finti: i tentativi si contano, non si
  // aspettano.
  function ambiente(esiti) {
    const attese = []
    const ascolti = new Set()
    const finestra = {
      addEventListener: (n, f) => n === 'online' && ascolti.add(f),
      removeEventListener: (n, f) => ascolti.delete(f),
    }
    const aggiorna = vi.fn(async () => esiti.shift() ?? 'senza-rete')
    const aspetta = (f, ms) => {
      attese.push({ f, ms })
      return attese.length
    }
    const torna = () => [...ascolti].forEach((f) => f())
    const passa = () => attese.at(-1).f()
    return { attese, ascolti, finestra, aggiorna, aspetta, torna, passa, smettiDiAspettare: () => {} }
  }
  const unGiro = () => new Promise((r) => setTimeout(r, 0))

  it('a intervalli crescenti, finché il file non arriva e l’app si ricarica', async () => {
    build({})
    const { seguiConfigurazione } = await apri()
    const a = ambiente(['senza-rete', 'uguale', 'senza-rete', 'ricaricata'])
    seguiConfigurazione({ ...a, attese: [5, 50, 500] })
    await unGiro()
    for (let i = 0; i < 3; i++) {
      a.passa()
      await unGiro()
    }
    expect(a.aggiorna).toHaveBeenCalledTimes(4)
    expect(a.attese.map((x) => x.ms)).toEqual([5, 50, 500])
    // Ricaricata: non si aspetta più niente.
    expect(a.ascolti.size).toBe(0)
  })

  it('appena il browser dice che la rete è tornata, senza aspettare l’intervallo', async () => {
    build({})
    const { seguiConfigurazione } = await apri()
    const a = ambiente(['senza-rete', 'ricaricata'])
    seguiConfigurazione(a)
    await unGiro()
    expect(a.ascolti.size).toBe(1)
    a.torna()
    await unGiro()
    expect(a.aggiorna).toHaveBeenCalledTimes(2)
    expect(a.ascolti.size).toBe(0)
  })

  it('con un backend in uso basta una volta, come sempre', async () => {
    const { seguiConfigurazione } = await apri()
    const a = ambiente(['senza-rete'])
    seguiConfigurazione(a)
    await unGiro()
    expect(a.aggiorna).toHaveBeenCalledTimes(1)
    expect(a.attese).toEqual([])
  })

  it('si può fermare, e smette davvero', async () => {
    build({})
    const { seguiConfigurazione } = await apri()
    const a = ambiente([])
    const ferma = seguiConfigurazione(a)
    await unGiro()
    ferma()
    a.torna()
    await unGiro()
    expect(a.aggiorna).toHaveBeenCalledTimes(1)
    expect(a.ascolti.size).toBe(0)
  })
})
