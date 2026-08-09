// @vitest-environment happy-dom
'use strict'

// INCASSARE DEVE FUNZIONARE ANCHE SENZA RETE — contanti o carta.
//
// Firestore risolve la Promise di una scrittura solo dopo l'ACK del server:
// offline resta pendente per sempre. Un `await` su quella Promise bloccherebbe
// l'incasso — il conto resterebbe aperto sullo schermo e il cassiere non
// saprebbe se ha incassato o no. Per questo le scritture passano da bgWrite
// (fire-and-forget, con l'indicatore di sincronizzazione) e le letture da
// getDoc, che offline risponde dalla cache.
//
// Qui si simula l'offline nel modo più cattivo possibile: OGNI scrittura
// resta appesa e non si risolve mai. L'incasso deve concludersi lo stesso.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mai = () => new Promise(() => {}) // una Promise che non si risolve mai

const stato = { ordine: null, scritture: [] }

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

vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: () => ({ id: 'ord-1' }),
  // Le LETTURE offline arrivano dalla cache: qui rispondono subito.
  getDoc: vi.fn(async () => ({
    exists: () => !!stato.ordine,
    id: 'ord-1',
    data: () => stato.ordine,
  })),
  getDocs: vi.fn(async () => ({ docs: [] })),
  getDocsFromCache: vi.fn(async () => ({ docs: [] })),
  // Le SCRITTURE restano appese, come offline.
  addDoc: vi.fn((_c, data) => {
    stato.scritture.push({ tipo: 'add', data })
    return mai()
  }),
  setDoc: vi.fn(() => mai()),
  updateDoc: vi.fn((_r, patch) => {
    stato.scritture.push({ tipo: 'update', patch })
    return mai()
  }),
  deleteDoc: vi.fn(() => mai()),
  query: () => ({}),
  where: () => ({}),
  documentId: () => 'id',
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: () => () => {},
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

const { registerPayment, markOrderPaid } = await import('../../src/lib/api.js')

const contoDa = (totale, extra = {}) => ({
  status: 'aperto',
  payment_status: 'non_richiesto',
  daily_number: 7,
  total: totale,
  discount_amount: 0,
  payments: [],
  comande: [{ id: 'c1', seq: 1, status: 'ritirato', items: [], inventory_applied: true }],
  created_at: '2026-08-09T20:00:00.000Z',
  ...extra,
})

// Se una di queste chiamate restasse appesa, il test fallirebbe per timeout:
// è esattamente il sintomo che si vedrebbe al bancone.
const entroUnSecondo = (p) =>
  Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('rimasto appeso')), 1000))])

describe('incasso senza rete', () => {
  beforeEach(() => {
    stato.ordine = contoDa(20)
    stato.scritture = []
  })

  it('contanti: si chiude subito, la scrittura va in coda', async () => {
    const esito = await entroUnSecondo(registerPayment('ord-1', { amount: 20, method: 'banco' }))
    expect(esito.closed).toBe(true)
    const patch = stato.scritture.find((s) => s.tipo === 'update')?.patch
    expect(patch.payments).toHaveLength(1)
    expect(patch.payments[0].method).toBe('banco')
    expect(patch.payment_status).toBe('pagato')
  })

  it('carta: stessa cosa, e il metodo resta scritto', async () => {
    const esito = await entroUnSecondo(registerPayment('ord-1', { amount: 20, method: 'carta' }))
    expect(esito.closed).toBe(true)
    const patch = stato.scritture.find((s) => s.tipo === 'update')?.patch
    expect(patch.payments[0].method).toBe('carta')
    expect(patch.payment_method).toBe('carta')
  })

  it('acconto: il conto resta parziale, senza aspettare il server', async () => {
    const esito = await entroUnSecondo(registerPayment('ord-1', { amount: 5, method: 'banco' }))
    expect(esito.closed).toBe(false)
    const patch = stato.scritture.find((s) => s.tipo === 'update')?.patch
    expect(patch.payment_status).toBe('parziale')
  })

  it('chiusura secca (markOrderPaid) non aspetta la rete', async () => {
    await entroUnSecondo(markOrderPaid('ord-1', 'carta'))
    const patch = stato.scritture.find((s) => s.tipo === 'update')?.patch
    expect(patch.payment_status).toBe('pagato')
    expect(patch.payment_method).toBe('carta')
  })

  it('il conto già pagato viene rifiutato subito, non dopo un timeout di rete', async () => {
    stato.ordine = contoDa(20, { payment_status: 'pagato' })
    await expect(
      entroUnSecondo(registerPayment('ord-1', { amount: 20, method: 'banco' }))
    ).rejects.toThrow(/già pagato/)
  })
})
