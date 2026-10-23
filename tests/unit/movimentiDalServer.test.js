// @vitest-environment happy-dom
'use strict'

// I MOVIMENTI DI UN PRODOTTO SI LEGGONO DAL SERVER DIRETTO (BUG-117).
// L'utente, 23/10/2026: «la funzione MOVIMENTI di un qualsiasi prodotto non
// si apre o si apre con ritardo». Con la cache su disco, a ogni prodotto
// aperto l'SDK scorreva prima tutti i movimenti salvati sul tablet: decine
// di migliaia, e secondi di attesa anche per un prodotto con tre righe.
// Misurato in Chrome con 25.000 movimenti in cache e la CPU rallentata
// quattro volte: 1,7-2,9 secondi con la cache, 0,2-0,3 col client diretto.
//
// Qui si mocka solo Firebase, non `src/lib/api.js`: si prova la strada che
// prende la lettura, non un finto.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Il Timestamp del client diretto è una classe SUA: si riconosce dal metodo.
class TimestampLite {
  constructor(d) {
    this.d = d
  }
  toDate() {
    return this.d
  }
}
const QUANDO = new Date('2026-10-20T21:30:00Z')
const docLite = (id, dati) => ({ id, data: () => dati })

const lite = {
  collection: vi.fn((_db, nome) => ({ nome })),
  where: vi.fn((campo, op, valore) => ({ campo, op, valore })),
  orderBy: vi.fn(() => ({})),
  query: vi.fn((...parti) => ({ parti })),
  getDocs: vi.fn(async () => ({
    docs: [docLite('m1', { item_id: 'gin', type: 'unload', qty: 4, unit: 'cl', reason: 'ordine', created_at: new TimestampLite(QUANDO) })],
  })),
}
const apriLite = vi.fn(async () => ({ db: {}, sdk: lite }))

vi.mock('../../src/lib/firebaseClient.js', () => ({
  db: {},
  auth: { currentUser: { uid: 'u1' } },
  functions: {},
  storage: {},
  firestoreLite: () => apriLite(),
}))

// L'SDK con la cache: se la lettura passasse di qui, il test lo vede.
const getDocsConCache = vi.fn(async () => ({
  docs: [docLite('m-cache', { item_id: 'gin', type: 'load', qty: 70, unit: 'cl', reason: 'carico', created_at: '2026-10-01T10:00:00.000Z' })],
}))
vi.mock('firebase/firestore', () => ({
  collection: (_db, nome) => ({ __col: nome }),
  doc: () => ({}),
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocFromCache: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocs: (...a) => getDocsConCache(...a),
  getDocsFromCache: vi.fn(async () => ({ docs: [] })),
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: () => ({}),
  where: () => ({}),
  documentId: () => 'id',
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: () => () => {},
  serverTimestamp: () => null,
  increment: (n) => ({ __increment: n }),
  writeBatch: () => ({ update: vi.fn(), set: vi.fn(), commit: vi.fn() }),
  deleteField: () => null,
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

beforeEach(() => {
  vi.clearAllMocks()
  apriLite.mockImplementation(async () => ({ db: {}, sdk: lite }))
})

describe('i movimenti di un prodotto', () => {
  it('si leggono dal server diretto, senza passare dalla cache', async () => {
    const movimenti = await api.fetchMovimentiProdotto('gin', '2026-07-25')
    expect(lite.getDocs).toHaveBeenCalledTimes(1)
    expect(getDocsConCache).not.toHaveBeenCalled()
    // Il prodotto e il periodo sono nella domanda, non filtrati dopo.
    expect(lite.where).toHaveBeenCalledWith('item_id', '==', 'gin')
    expect(lite.where).toHaveBeenCalledWith('created_at', '>=', new Date('2026-07-25T00:00:00Z'))
    expect(lite.collection).toHaveBeenCalledWith({}, 'stock_movements')
    // La data del client diretto diventa una data vera: con il controllo
    // sulla classe restava un oggetto, e il movimento cadeva fuori periodo.
    expect(movimenti).toEqual([
      expect.objectContaining({ id: 'm1', item_id: 'gin', qty: 4, unit: 'cl', created_at: QUANDO.toISOString() }),
    ])
  })

  it('con «Tutto» non c’è il vincolo sulla data', async () => {
    await api.fetchMovimentiProdotto('gin', null)
    expect(lite.where).toHaveBeenCalledTimes(1)
  })

  it('senza rete ripiega sulla lettura di sempre, che risponde con la cache', async () => {
    lite.getDocs.mockRejectedValueOnce(Object.assign(new Error('Failed to fetch'), { code: 'unavailable' }))
    const movimenti = await api.fetchMovimentiProdotto('gin', '2026-07-25')
    expect(getDocsConCache).toHaveBeenCalledTimes(1)
    expect(movimenti.map((m) => m.id)).toEqual(['m-cache'])
  })

  it('e anche se il client diretto non si carica (il pezzo di codice non arriva)', async () => {
    apriLite.mockImplementationOnce(async () => {
      throw new Error('Failed to fetch dynamically imported module')
    })
    const movimenti = await api.fetchMovimentiProdotto('gin', null)
    expect(movimenti.map((m) => m.id)).toEqual(['m-cache'])
  })
})
