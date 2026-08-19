// @vitest-environment happy-dom
'use strict'

// ── CHIUDERE UN CONTO SCONTATO, SENZA ASPETTARE LA RETE ───────────────
//
// Raccontato dal locale il 19/08: «quando chiudi un tavolo con lo sconto non
// stampa lo scontrino; stampa solo ed esclusivamente se si chiude senza
// sconto».
//
// La strada è questa: lo sconto si applica un attimo prima di riscuotere e
// la sua scrittura parte in sottofondo. `registerPayment` rileggeva il conto
// per decidere se l'incasso lo saldava — e la rilettura prende la versione
// di PRIMA, quella senza sconto. Il residuo risultava più alto dell'incasso,
// il conto veniva scritto «parziale» invece che «pagato»: a schermo chiuso,
// sul database aperto. Lo scontrino automatico guarda proprio
// `payment_status`, e non usciva mai.
//
// COME È FATTO QUESTO TEST, ed è il punto: ogni scrittura resta appesa per
// sempre e ogni lettura risponde col passato, che è esattamente ciò che fa
// una cache mentre la scrittura è ancora in coda. Non si mocka
// `src/lib/api.js`: si mocka SOLO Firestore, così quello che si prova è il
// codice vero.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mai = () => new Promise(() => {}) // una Promise che non si risolve mai
const stato = { ordine: null, scritture: [] }

vi.mock('../../src/lib/firebaseClient.js', () => ({
  db: {},
  auth: { currentUser: { uid: 'u1', email: 'banco@tana.it', displayName: 'Banco' } },
  functions: {},
  storage: {},
}))
vi.mock('../../src/lib/sumupApi.js', () => ({
  createSumUpSale: vi.fn(),
  updateSumUpSaleStatus: vi.fn(),
  toSumUpStatus: vi.fn(),
}))

// La cache non si aggiorna da sola: risponde sempre col documento com'era
// prima del gesto. Chi rilegge, qui, rilegge il passato.
const leggi = async (ref) => {
  if (ref?.col && ref.col !== 'orders') return { exists: () => false, data: () => ({}) }
  return { exists: () => !!stato.ordine, id: 'ord-1', data: () => stato.ordine }
}

vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: (_db, col, id) => ({ col: col || 'orders', id: id || 'ord-1' }),
  getDoc: vi.fn(leggi),
  getDocFromCache: vi.fn(leggi),
  getDocs: vi.fn(async () => ({ docs: [] })),
  getDocsFromCache: vi.fn(async () => ({ docs: [] })),
  addDoc: vi.fn((_c, data) => {
    stato.scritture.push({ tipo: 'add', data })
    return mai()
  }),
  setDoc: vi.fn((_r, data) => {
    stato.scritture.push({ tipo: 'set', data })
    return mai()
  }),
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
    static fromDate(d) { return d }
    static fromMillis(m) { return m }
  },
}))

const api = await import('../../src/lib/api.js')

// Se una chiamata restasse appesa il test fallirebbe per timeout, che è lo
// stesso sintomo del banco: il tasto premuto e niente che succede.
const subito = (p) =>
  Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('rimasto appeso')), 1000))])

const riga = (nome, qty, prezzo) => ({ drink_id: nome.toLowerCase(), name: nome, qty, unit_price: prezzo })

const contoDaVentidue = () => ({
  status: 'aperto',
  payment_status: 'non_richiesto',
  daily_number: 21,
  total: 22,
  discount: null,
  discount_amount: 0,
  payments: [],
  items: [riga('Mojito', 2, 7), riga('Gin', 1, 8)],
  comande: [
    {
      id: 'c1',
      seq: 1,
      status: 'ritirato',
      items: [riga('Mojito', 2, 7), riga('Gin', 1, 8)],
      inventory_applied: true,
    },
  ],
  created_at: '2026-08-19T20:00:00.000Z',
})

const ultimaPatch = () => stato.scritture.filter((s) => s.tipo === 'update').at(-1).patch

beforeEach(() => {
  stato.ordine = contoDaVentidue()
  stato.scritture = []
})

describe('un conto scontato si chiude come chiuso', () => {
  it('sconto del 10% e incasso del residuo: il conto risulta PAGATO', async () => {
    await subito(api.setOrderDiscount('ord-1', { type: 'percent', value: 10 }))
    // La schermata sa che con 19,80 il conto è saldato: glielo dice.
    const res = await subito(
      api.registerPayment('ord-1', { amount: 19.8, method: 'banco', autoServe: true, chiude: true })
    )
    expect(res.closed).toBe(true)
    // Senza questo, lo scontrino automatico della coda non parte mai: guarda
    // proprio `payment_status`.
    expect(ultimaPatch().payment_status).toBe('pagato')
  })

  it('e l’incasso registrato è la cifra battuta, non il residuo di prima', async () => {
    await subito(api.setOrderDiscount('ord-1', { type: 'percent', value: 10 }))
    await subito(
      api.registerPayment('ord-1', { amount: 19.8, method: 'banco', autoServe: true, chiude: true })
    )
    expect(ultimaPatch().payments.at(-1).amount).toBe(19.8)
  })

  it('conto offerto per intero: si chiude anche senza incassare niente', async () => {
    await subito(api.setOrderDiscount('ord-1', { type: 'euro', value: 22 }))
    await subito(api.markOrderPaid('ord-1', null, { autoServe: true }))
    expect(ultimaPatch().payment_status).toBe('pagato')
  })

  // IL TETTO SUL RESIDUO RESTA per chi non dichiara niente: un acconto è un
  // acconto, e il conto deve restare aperto.
  it('un acconto vero resta un acconto: senza «chiude» il conto resta parziale', async () => {
    const res = await subito(api.registerPayment('ord-1', { amount: 10, method: 'banco' }))
    expect(res.closed).toBe(false)
    expect(ultimaPatch().payment_status).toBe('parziale')
  })

  it('e chi non dichiara niente non registra mai più del dovuto', async () => {
    await subito(api.registerPayment('ord-1', { amount: 50, method: 'banco', autoServe: true }))
    expect(ultimaPatch().payments.at(-1).amount).toBe(22)
  })
})
