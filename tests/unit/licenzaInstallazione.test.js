// @vitest-environment happy-dom
'use strict'

// ── LA LICENZA DELL'INSTALLAZIONE, DA DOVE ARRIVA (BUG-125) ──────────
//
// Fino alla 1.10.x la licenza stava in `settings/bar.licenza`, che ogni
// bartender può riscrivere: con un account del banco e la console del
// browser un locale Free si toglieva i limiti o una sospensione. Ora sta in
// `licenza/attuale`, che dall'app non scrive nessuno, e quella in
// settings/bar si butta. Senza documento l'installazione non è attivata —
// ma solo quando lo dice il server, perché senza rete «non lo so» e «non
// c'è» sono la stessa risposta vuota. (Fino a REQ-LIC-009, 02/11/2026, in
// mezzo c'era la licenza della build, per la Tana: ora anche lei ha il suo
// documento.)
//
// Come in giroInLocale.test.js: si mocka SOLO Firestore, e `api.js` è
// quello vero. Gli ascolti rispondono quando il test lo dice, con la
// provenienza che il test sceglie (cache o server): è il modo per provare
// il caso cattivo, la prima apertura senza rete.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mai = () => new Promise(() => {})

// Gli ascolti aperti, per percorso.
const st = vi.hoisted(() => ({ ascolti: [] }))

vi.mock('../../src/lib/firebaseClient.js', () => ({
  db: {},
  auth: { currentUser: { uid: 'u1' } },
  functions: {},
  storage: {},
}))

vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: (_db, col, id) => ({ path: `${col}/${id}` }),
  getDoc: vi.fn(() => mai()),
  getDocFromCache: vi.fn(() => mai()),
  getDocs: vi.fn(async () => ({ docs: [] })),
  getDocsFromCache: vi.fn(async () => ({ docs: [] })),
  addDoc: vi.fn(() => mai()),
  setDoc: vi.fn(() => mai()),
  updateDoc: vi.fn(() => mai()),
  deleteDoc: vi.fn(() => mai()),
  query: () => ({}),
  where: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  // Le due forme della porta: (ref, aggiornamento, errore) e
  // (ref, { includeMetadataChanges }, aggiornamento, errore).
  onSnapshot: (ref, ...resto) => {
    const opzioni = typeof resto[0] === 'object' ? resto.shift() : {}
    const ascolto = { path: ref.path, opzioni, prossimo: resto[0], chiuso: false }
    st.ascolti.push(ascolto)
    return () => {
      ascolto.chiuso = true
    }
  },
  serverTimestamp: () => null,
  increment: (n) => n,
  writeBatch: () => ({ update: vi.fn(), set: vi.fn(), commit: () => mai() }),
  Timestamp: class Timestamp {
    static fromDate(d) {
      return d
    }
    static fromMillis(m) {
      return m
    }
  },
}))

// Ricaricati a ogni prova: l'ultima licenza letta sta in memoria nel modulo,
// e ogni prova è un dispositivo appena aperto.
let api, installazioneBloccata, moduloIncluso, statoLicenza, STATI_LICENZA, pianoFree, impostazioniRicordate
const carica = async () => {
  vi.resetModules()
  api = await import('../../src/lib/api.js')
  ;({ installazioneBloccata, moduloIncluso, statoLicenza, STATI_LICENZA } = await import('../../src/lib/licenza.js'))
  ;({ pianoFree } = await import('../../src/lib/limiti.js'))
  ;({ impostazioniRicordate } = await import('../../src/lib/impostazioniLocali.js'))
}

// Una risposta di Firestore: il documento (o null se non c'è) e da dove viene.
const risposta = (dati, { daCache = false } = {}) => ({
  exists: () => dati != null,
  data: () => dati ?? undefined,
  metadata: { fromCache: daCache },
})
const rispondi = (path, dati, opz) => {
  for (const a of st.ascolti) if (a.path === path && !a.chiuso) a.prossimo(risposta(dati, opz))
}

// Quello che un bartender ha scritto in settings/bar dalla console.
const BAR_MANOMESSO = {
  workflow_enabled: true,
  licenza: { piano: 'pro', limiti: null, moduli: { conta: true, fatture: true, sumup: true }, stato: 'attiva' },
}
const FREE = { piano: 'free', stato: 'attiva', limiti: { prodotti_max: 10 }, moduli: { sumup: false } }
const TANA = { moduli: { conta: true, scadenzario: true } }

let visti
const ascolta = () => api.subscribeSettings((s) => visti.push(s))
const ultimo = () => visti.at(-1)

beforeEach(async () => {
  st.ascolti.length = 0
  visti = []
  localStorage.clear()
  await carica()
})

describe('un locale col suo documento della licenza', () => {
  it('vale il documento della regia, e quella scritta in settings/bar si butta', () => {
    ascolta()
    rispondi('settings/bar', BAR_MANOMESSO)
    rispondi('licenza/attuale', FREE)
    expect(ultimo().licenza).toEqual(FREE)
    expect(pianoFree(ultimo())).toBe(true)
    expect(moduloIncluso(ultimo(), 'fatture')).toBe(false)
    // Il resto delle impostazioni arriva com'era.
    expect(ultimo().workflow_enabled).toBe(true)
  })

  it('la licenza si ascolta anche quando cambia solo la provenienza', () => {
    ascolta()
    const licenza = st.ascolti.find((a) => a.path === 'licenza/attuale')
    expect(licenza.opzioni).toEqual({ includeMetadataChanges: true })
  })

  it('documento assente dalla cache, prima apertura senza rete: l’app NON si ferma', () => {
    ascolta()
    rispondi('settings/bar', BAR_MANOMESSO)
    rispondi('licenza/attuale', null, { daCache: true })
    expect(installazioneBloccata(ultimo())).toBe(false)
    // E nessuna licenza inventata, nemmeno quella di settings/bar: niente
    // moduli finché non si sa.
    expect(ultimo().licenza).toBeUndefined()
    expect(moduloIncluso(ultimo(), 'conta')).toBe(false)
  })

  it('il server conferma che non c’è: «non attivata»; la regia lo scrive: si riparte', () => {
    ascolta()
    rispondi('settings/bar', BAR_MANOMESSO)
    rispondi('licenza/attuale', null, { daCache: true })
    rispondi('licenza/attuale', null, { daCache: false })
    expect(ultimo().licenza).toEqual({ stato: STATI_LICENZA.NON_ATTIVATA })
    expect(installazioneBloccata(ultimo())).toBe(true)
    // La licenza manomessa in settings/bar non lo sblocca.
    expect(moduloIncluso(ultimo(), 'conta')).toBe(false)
    rispondi('licenza/attuale', FREE)
    expect(installazioneBloccata(ultimo())).toBe(false)
    expect(ultimo().licenza).toEqual(FREE)
  })

  it('un cambio della sola provenienza, a licenza uguale, non ridisegna', () => {
    ascolta()
    rispondi('settings/bar', { workflow_enabled: false })
    rispondi('licenza/attuale', FREE, { daCache: true })
    const quanti = visti.length
    rispondi('licenza/attuale', FREE, { daCache: false })
    expect(visti.length).toBe(quanti)
  })

  it('si risponde nell’istante della risposta della cache: nessuna attesa', () => {
    ascolta()
    rispondi('licenza/attuale', FREE, { daCache: true })
    // Senza impostazioni non si risponde ancora: chi chiama le aspetta.
    expect(visti).toHaveLength(0)
    rispondi('settings/bar', { workflow_enabled: false }, { daCache: true })
    expect(visti).toHaveLength(1)
    expect(ultimo().licenza).toEqual(FREE)
  })

  it('smettere chiude tutti e due gli ascolti', () => {
    const smetti = ascolta()
    smetti()
    expect(st.ascolti.every((a) => a.chiuso)).toBe(true)
  })
})

// LA TANA È UN LOCALE COME GLI ALTRI (REQ-LIC-009). Con BUG-125 senza
// documento valeva la licenza della sua build; ora senza documento
// confermato dal server è «non attivata» come chiunque, e col suo
// documento lavora coi suoi moduli.
describe('la Tana, senza più la licenza nella build', () => {
  it('senza documento, confermato dal server: «non attivata», come chiunque', () => {
    ascolta()
    rispondi('settings/bar', BAR_MANOMESSO)
    rispondi('licenza/attuale', null, { daCache: false })
    expect(ultimo().licenza).toEqual({ stato: STATI_LICENZA.NON_ATTIVATA })
    expect(installazioneBloccata(ultimo())).toBe(true)
  })

  it('col suo documento lavora coi suoi moduli, e settings/bar non conta', () => {
    ascolta()
    rispondi('settings/bar', BAR_MANOMESSO)
    rispondi('licenza/attuale', TANA)
    expect(ultimo().licenza).toEqual(TANA)
    expect(installazioneBloccata(ultimo())).toBe(false)
    expect(moduloIncluso(ultimo(), 'fatture')).toBe(false)
    expect(moduloIncluso(ultimo(), 'conta')).toBe(true)
  })
})

// LA SCADENZA SENZA RETE (REQ-LIC-009): il documento che il dispositivo ha
// in cache dice fino a quando vale, e l'orologio del dispositivo basta.
describe('la licenza scaduta, anche senza rete', () => {
  const ieri = new Date(Date.now() - 24 * 3600 * 1000).toISOString()

  it('con «ferma» l’app si ferma, dalla sola cache', () => {
    ascolta()
    rispondi('settings/bar', {})
    rispondi('licenza/attuale', { ...TANA, valida_fino: ieri, alla_scadenza: 'ferma' }, { daCache: true })
    expect(installazioneBloccata(ultimo())).toBe(true)
    expect(statoLicenza(ultimo())).toBe(STATI_LICENZA.SCADUTA)
  })

  it('con «free» si lavora col Free: nessun modulo, coi limiti del Free', () => {
    ascolta()
    rispondi('settings/bar', {})
    rispondi('licenza/attuale', { ...TANA, valida_fino: ieri, alla_scadenza: 'free' }, { daCache: true })
    expect(installazioneBloccata(ultimo())).toBe(false)
    expect(pianoFree(ultimo())).toBe(true)
    expect(moduloIncluso(ultimo(), 'magazzino')).toBe(false)
  })
})

describe('l’ultima licenza nota, su questo dispositivo', () => {
  it('si ricorda a parte, e si usa finché il documento non risponde', async () => {
    ascolta()
    rispondi('settings/bar', {})
    rispondi('licenza/attuale', FREE)
    expect(impostazioniRicordate({}).licenza).toEqual(FREE)

    // Riapertura senza rete, documento non ancora in cache: resta il Free.
    await carica()
    st.ascolti.length = 0
    visti = []
    ascolta()
    rispondi('settings/bar', {}, { daCache: true })
    expect(ultimo().licenza).toEqual(FREE)
  })

  it('la licenza vecchia dentro le impostazioni ricordate non si rilegge', () => {
    // Un dispositivo aggiornato dalla 1.10.x ha in memoria le impostazioni
    // di settings/bar, licenza manomessa compresa.
    localStorage.setItem('drink:impostazioni', JSON.stringify(BAR_MANOMESSO))
    expect(impostazioniRicordate({}).licenza).toBeUndefined()
    expect(impostazioniRicordate({}).workflow_enabled).toBe(true)
  })
})
