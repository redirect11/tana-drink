// @vitest-environment happy-dom
'use strict'

// IL RESO AL FORNITORE, cioè IL CARICO IN NEGATIVO (REQ-MAG-053).
//
// Flavio, 04/11/2026: «dopo circa un mese il fornitore si è convinto a farsi
// restituire una bottiglia, e io adesso se faccio contenuto reale da 1 passa
// a 0: è come se me la porta come se fosse stata consumata. Ho bisogno di
// fare anche il carico negativo».
//
// Il contenuto reale è una rettifica: nel conto del periodo la bottiglia
// risulta sparita, e chi guarda il consumo la legge come bevuta. Il reso è un
// ACQUISTO DISFATTO: toglie dagli acquisti, in pezzi e in euro, e il consumo
// non lo vede.
//
// Le scritture qui NON TORNANO MAI, come al banco quando la rete non passa
// (CLAUDE.md, il local-first): il reso deve valere lo stesso, nell'istante.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/lib/firebaseClient.js', () => ({
  db: {},
  auth: { currentUser: null },
  functions: {},
  storage: {},
}))

const appese = () => new Promise(() => {})
vi.mock('firebase/firestore', () => ({
  collection: (_db, nome) => ({ __col: nome }),
  doc: (...args) => (args.length >= 3 ? { col: args[1], id: args[2] } : { col: 'x', id: 'nuovo' }),
  getDoc: vi.fn(appese),
  getDocFromCache: vi.fn(appese),
  getDocs: vi.fn(appese),
  getDocsFromCache: vi.fn(appese),
  addDoc: vi.fn(appese),
  setDoc: vi.fn(appese),
  updateDoc: vi.fn(appese),
  deleteDoc: vi.fn(appese),
  query: () => ({}),
  where: () => ({}),
  documentId: () => 'id',
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: () => () => {},
  serverTimestamp: () => null,
  increment: (n) => ({ __increment: n }),
  writeBatch: () => ({ update: vi.fn(), set: vi.fn(), delete: vi.fn(), commit: appese }),
  deleteField: () => ({ __delete: true }),
  Timestamp: class Timestamp {
    static fromDate(d) {
      return d
    }
    static fromMillis(m) {
      return m
    }
  },
}))

const api = await import('../../src/lib/api.js')
const fs = await import('firebase/firestore')
const { articoloNormalizzato } = await import('../../src/lib/inventory.js')
const { magazzinoNelPeriodo, gruppoMovimento, MOTIVI_DI_CARICO } = await import('../../src/lib/magazzinoPeriodo.js')
const { tipoDi, etichettaTipo, riepilogoMovimenti } = await import('../../src/lib/movimentiProdotto.js')
const { vociDiAcquisto } = await import('../../src/lib/macroStats.js')
const { righeInventario } = await import('../../src/lib/inventarioInCorso.js')

const giro = () => new Promise((r) => setTimeout(r, 0))

// Un gin a bottiglie da 70 cl, una bottiglia in giacenza: quella da rendere.
const GIN = { id: 'gin', name: 'Gin Bosford', unit: 'pz', package_size: 700, content_unit: 'ml', stock: 1, cost: 10, vat: 22, kind: 'scorta' }
const articolo = (stock = 1) => articoloNormalizzato({ ...GIN, stock })

beforeEach(() => {
  fs.updateDoc.mockClear()
  fs.addDoc.mockClear()
})

describe('il reso si fa senza rete, e si vede subito', () => {
  it('torna la giacenza nuova nell’istante, con le scritture ancora appese', () => {
    const dopo = api.resoAlFornitore(articolo(1), 1)
    expect(dopo.stock).toBe(0)
    expect(dopo.id).toBe('gin')
  })

  it('la giacenza scende con un incremento negativo, e il movimento dice «reso fornitore»', async () => {
    api.resoAlFornitore(articolo(3), 2)
    await giro()
    expect(fs.updateDoc).toHaveBeenCalledTimes(1)
    expect(fs.updateDoc.mock.calls[0][1]).toEqual({ stock: { __increment: -2 } })
    expect(fs.addDoc).toHaveBeenCalledTimes(1)
    // La quantità resta positiva come in ogni movimento: il verso lo dice il
    // tipo, e chi somma (movimentoInPezzi) lo legge da lì.
    expect(fs.addDoc.mock.calls[0][1]).toMatchObject({ item_id: 'gin', type: 'unload', qty: 2, reason: 'reso fornitore' })
  })

  it('zero o un numero negativo non sono un reso, e non scrivono niente', async () => {
    expect(() => api.resoAlFornitore(articolo(), 0)).toThrow(/maggiore di zero/)
    expect(() => api.resoAlFornitore(articolo(), -1)).toThrow(/maggiore di zero/)
    await giro()
    expect(fs.updateDoc).not.toHaveBeenCalled()
    expect(fs.addDoc).not.toHaveBeenCalled()
  })

  // Il carico resta com'era: solo in positivo (Flavio, 25-26/09/2026).
  it('il carico resta un carico', async () => {
    expect(api.loadStock(articolo(1), 2).stock).toBe(3)
    await giro()
    expect(fs.addDoc.mock.calls[0][1]).toMatchObject({ type: 'load', qty: 2, reason: 'carico' })
  })
})

// IL CUORE DELLA RICHIESTA: dove finisce la bottiglia resa nel conto del
// periodo. Con la rettifica sarebbe sembrata merce sparita; col reso gli
// acquisti scendono, il consumo no.
describe('nel conto del periodo il reso toglie dagli acquisti, non aggiunge consumo', () => {
  const mov = (type, qty, unit, reason, created_at) => ({ item_id: 'gin', type, qty, unit, reason, created_at })
  const PERIODO = { dal: '2026-10-01', al: '2026-10-31' }
  // Comprate due bottiglie, versata una, resa l'altra: oggi zero.
  const movimenti = [
    mov('load', 2, 'pz', 'carico', '2026-10-02T10:00:00.000Z'),
    mov('unload', 700, 'ml', 'ordine', '2026-10-10T21:00:00.000Z'),
    mov('unload', 1, 'pz', 'reso fornitore', '2026-10-30T10:00:00.000Z'),
  ]

  it('è un acquisto, col segno meno', () => {
    expect(gruppoMovimento({ reason: 'reso fornitore' })).toBe('acquisto')
    const r = magazzinoNelPeriodo(movimenti, [{ ...GIN, stock: 0 }], PERIODO).righe.find((x) => x.item_id === 'gin')
    expect(r.acq).toBe(1)
    expect(r.cons).toBe(1)
    expect(r.dep).toBe(0)
    expect(r.fine).toBe(0)
  })

  // IL CASO DI FLAVIO, nell'inventario: una bottiglia in deposito
  // all'apertura, resa al fornitore, zero a scaffale alla conta. Il consumo
  // dell'inventario è deposito + acquisti − rimanenza: col contenuto reale
  // la bottiglia resa risultava bevuta, col reso no.
  it('all’inventario la bottiglia resa non è consumo; col contenuto reale lo era', () => {
    const riga = [{ item_id: 'gin', dep: 1, rim: 0, rim_at: '2026-10-31T10:00:00.000Z', unit: 'pz', cost: 10, vat: 22 }]
    const uscita = (reason) => [mov('unload', 1, 'pz', reason, '2026-10-30T10:00:00.000Z')]
    const items = [{ ...GIN, stock: 0 }]
    const conReso = righeInventario(riga, { movimenti: uscita('reso fornitore'), items }).lines[0]
    expect(conReso.acq).toBe(-1)
    expect(conReso.cons).toBe(0)
    const conRettifica = righeInventario(riga, { movimenti: uscita('rettifica'), items }).lines[0]
    expect(conRettifica.cons).toBe(1)
  })

  // Il Bilancio legge gli acquisti dai movimenti di carico: il reso deve
  // esserci dentro (anche nella query, che filtra su MOTIVI_DI_CARICO), e
  // valere in meno al costo del prodotto.
  it('negli acquisti in euro vale in meno, al costo del prodotto', () => {
    expect(MOTIVI_DI_CARICO).toContain('reso fornitore')
    const voci = vociDiAcquisto([], { movimenti, itemsById: { gin: GIN } })
    expect(voci.map((v) => v.amount)).toEqual([20, -10])
  })
})

describe('nella movimentazione del prodotto ha la sua riga', () => {
  it('«Reso al fornitore», in uscita', () => {
    expect(tipoDi('reso fornitore')).toBe('reso fornitore')
    expect(etichettaTipo('reso fornitore')).toBe('Reso al fornitore')
    const r = riepilogoMovimenti(
      [{ item_id: 'gin', type: 'unload', qty: 1, unit: 'pz', reason: 'reso fornitore', created_at: '2026-10-30T10:00:00.000Z' }],
      GIN
    )
    expect(r.tipi.find((t) => t.id === 'reso fornitore').q).toBe(-1)
  })
})
