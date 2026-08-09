// @vitest-environment happy-dom
'use strict'

// LA CODA PARTE DALLA CACHE, POI SI ALLINEA AL SERVER.
//
// Firestore è local-first, ma onSnapshot risponde subito col dato locale solo
// quando SA di essere offline. Con una rete collegata che non passa (wifi del
// locale, portale captive, DNS muto) l'SDK crede di essere online e aspetta il
// server: la coda restava sullo spinner pur avendo tutti gli ordini in cache.
//
// Qui si verifica che la cache dia il primo risultato SUBITO e che il listener
// continui comunque a lavorare in sottofondo, sovrascrivendo con quello che
// arriva dal server appena la rete torna.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Documenti finti: `data()` restituisce il documento grezzo, come Firestore.
const docFinto = (id, data) => ({ id, data: () => data })

const stato = {
  cache: { aperti: [], recenti: [] },
  listeners: [], // { tipo, cb }
}

vi.mock('../../src/lib/firebaseClient.js', () => ({
  db: {},
  auth: { currentUser: null },
  functions: {},
  storage: {},
}))
vi.mock('../../src/lib/sumupApi.js', () => ({
  createSumUpSale: vi.fn(),
  updateSumUpSaleStatus: vi.fn(),
  toSumUpStatus: vi.fn(),
}))

vi.mock('firebase/firestore', () => {
  // `where` e `query` conservano abbastanza informazione da capire QUALE
  // delle due query è: gli aperti filtrano su `status`, i recenti su `created_at`.
  const where = (field, op, value) => ({ field, op, value })
  const query = (_col, ...clausole) => ({
    tipo: clausole.find((c) => c.field === 'status') ? 'aperti' : 'recenti',
  })
  return {
    collection: () => ({}),
    doc: () => ({}),
    addDoc: vi.fn(),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    getDocsFromCache: vi.fn(async (q) => ({ docs: stato.cache[q.tipo] || [] })),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    query,
    where,
    documentId: () => 'id',
    orderBy: () => ({}),
    limit: () => ({}),
    onSnapshot: (q, cb) => {
      stato.listeners.push({ tipo: q.tipo, cb })
      return () => {}
    },
    serverTimestamp: () => null,
    increment: (n) => n,
    writeBatch: vi.fn(),
    // Classe, non oggetto: mapOrder fa `instanceof Timestamp` per capire se
    // una data è un timestamp di Firestore.
    Timestamp: class Timestamp {
      static fromDate(d) {
        return d
      }
      static fromMillis(m) {
        return m
      }
    },
  }
})

const { subscribeActiveOrders } = await import('../../src/lib/api.js')

const ordine = (id, nome) => ({
  status: 'aperto',
  customer_name: nome,
  daily_number: 1,
  created_at: '2026-08-09T20:00:00.000Z',
  comande: [],
  payments: [],
})

describe('coda: prima la cache, poi il server', () => {
  beforeEach(() => {
    stato.cache = { aperti: [], recenti: [] }
    stato.listeners = []
  })

  it('con la cache piena gli ordini compaiono senza aspettare il server', async () => {
    stato.cache.aperti = [docFinto('a', ordine('a', 'dalla cache'))]
    const visti = []
    subscribeActiveOrders((list) => visti.push(list))
    // Nessun listener ha ancora risposto: il server sta zitto.
    await vi.waitFor(() => expect(visti.length).toBeGreaterThan(0))
    expect(visti[0].map((o) => o.customer_name)).toEqual(['dalla cache'])
  })

  it('il listener resta attivo e allinea al server quello che arriva dopo', async () => {
    stato.cache.aperti = [docFinto('a', ordine('a', 'dalla cache'))]
    const visti = []
    subscribeActiveOrders((list) => visti.push(list))
    await vi.waitFor(() => expect(visti.length).toBeGreaterThan(0))

    // Ora la rete torna: il listener degli aperti consegna il dato del server.
    const l = stato.listeners.find((x) => x.tipo === 'aperti')
    expect(l).toBeTruthy() // la sottoscrizione non è stata sostituita dalla cache
    l.cb({ docs: [docFinto('a', ordine('a', 'dal server')), docFinto('b', ordine('b', 'nuovo'))] })

    const ultimo = visti[visti.length - 1]
    expect(ultimo.map((o) => o.customer_name)).toEqual(['dal server', 'nuovo'])
  })

  it('senza cache non si inventa niente: si aspetta il server, come prima', async () => {
    const visti = []
    subscribeActiveOrders((list) => visti.push(list))
    await new Promise((r) => setTimeout(r, 10))
    expect(visti).toHaveLength(0)
    stato.listeners.find((x) => x.tipo === 'aperti').cb({ docs: [docFinto('a', ordine('a', 'dal server'))] })
    expect(visti[visti.length - 1].map((o) => o.customer_name)).toEqual(['dal server'])
  })

  it('il dato del server non viene ricoperto dalla cache che arriva tardi', async () => {
    stato.cache.aperti = [docFinto('z', ordine('z', 'vecchio in cache'))]
    const visti = []
    subscribeActiveOrders((list) => visti.push(list))
    // Il server risponde PRIMA che la lettura dalla cache si completi.
    stato.listeners.find((x) => x.tipo === 'aperti').cb({ docs: [docFinto('a', ordine('a', 'dal server'))] })
    await new Promise((r) => setTimeout(r, 10))
    expect(visti[visti.length - 1].map((o) => o.customer_name)).toEqual(['dal server'])
  })
})
