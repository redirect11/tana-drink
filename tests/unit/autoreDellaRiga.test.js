// @vitest-environment happy-dom
'use strict'

// ── CHI HA BATTUTO OGNI RIGA, ANCHE SENZA RETE (REQ-ORD-023) ─────────────
//
// Richiesta dell'08/11/2026: accanto a ogni riga del conto l'iniziale di
// chi l'ha battuta. La firma (`added_by`) la mette il conto; qui si prova
// che api.js la porta fino al documento in ogni scrittura delle righe, e
// che il conto restituito la ha GIÀ — senza rete, come al banco: la
// schermata disegna quel conto, e un'iniziale che compare «quando
// sincronizza» è un'iniziale che al banco non c'è.
//
// Lo stesso banco di prova di giroInLocale.test.js (che è fatto per essere
// copiato): Firestore finto, scritture appese per sempre, letture che
// rispondono col conto di prima. api.js è quello vero.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mai = () => new Promise(() => {}) // una Promise che non si risolve mai
const stato = { ordine: null, scritture: [] }

vi.mock('../../src/lib/firebaseClient.js', () => ({
  db: {},
  auth: { currentUser: { uid: 'u1', email: 'banco@tana.it', displayName: 'Banco' } },
  functions: {},
  storage: {},
}))

// LA CACHE NON SI AGGIORNA DA SOLA. Risponde sempre con `stato.ordine`,
// cioè il documento com'era prima del gesto: è la fotografia di quel
// momento in cui la scrittura è partita ma non è ancora arrivata da
// nessuna parte. Chi rilegge, qui, rilegge il passato.
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
const { _azzeraMutazioni } = await import('../../src/lib/mutazioniOrdine.js')

const subito = (p) =>
  Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('rimasto appeso')), 1000))])

const FLAVIO = { name: 'Flavio', email: 'flavio@tana.it', role: 'admin' }
const ALEX = { name: 'Alex', email: 'alex@tana.it', role: 'staff' }
const riga = (nome, qty, prezzo, added_by) => ({
  drink_id: nome.toLowerCase(),
  name: nome,
  qty,
  unit_price: prezzo,
  ...(added_by ? { added_by } : {}),
})

beforeEach(() => {
  _azzeraMutazioni()
  stato.scritture = []
  stato.ordine = {
    status: 'aperto',
    payment_status: 'non_richiesto',
    daily_number: 21,
    total: 7,
    discount_amount: 0,
    payments: [],
    items: [riga('Negroni', 1, 7, FLAVIO)],
    comande: [{ id: 'c1', seq: 1, status: 'ricevuto', items: [riga('Negroni', 1, 7, FLAVIO)], inventory_applied: false }],
    created_at: '2026-11-08T20:00:00.000Z',
  }
})

const righeDi = (conto, id) => conto.comande.find((c) => c.id === id).items

describe('la firma della riga arriva fino al documento', () => {
  it('una comanda aggiunta porta chi ha battuto ogni sua riga, già nel conto restituito', async () => {
    const dopo = await subito(api.addComanda('ord-1', [riga('Spritz', 2, 6, ALEX)]))
    const nuova = dopo.comande.find((c) => c.id !== 'c1')
    expect(nuova.items[0].added_by).toEqual(ALEX)
    // E la scrittura che parte in sottofondo la porta con sé.
    const scritta = stato.scritture.at(-1).patch.comande.find((c) => c.id !== 'c1')
    expect(scritta.items[0].added_by).toEqual(ALEX)
  })

  it('correggendo una comanda le righe tengono chi le aveva battute', async () => {
    const nuove = [riga('Negroni', 2, 7, FLAVIO), riga('Gin Tonic', 1, 8, ALEX)]
    const dopo = await subito(api.bartenderUpdateComanda('ord-1', 'c1', { items: nuove }))
    expect(righeDi(dopo, 'c1').map((i) => i.added_by?.name)).toEqual(['Flavio', 'Alex'])
  })

  it('della firma si scrivono nome, email e ruolo, e nient’altro', async () => {
    const conDispositivo = { ...ALEX, device: 'tablet-1', uid: 'x' }
    const dopo = await subito(api.addComanda('ord-1', [riga('Spritz', 1, 6, conDispositivo)]))
    expect(dopo.comande.find((c) => c.id !== 'c1').items[0].added_by).toEqual(ALEX)
  })

  it('una riga senza firma (il cliente, i conti di prima) resta senza', async () => {
    const dopo = await subito(api.addComanda('ord-1', [riga('Spritz', 1, 6)]))
    expect(dopo.comande.find((c) => c.id !== 'c1').items[0]).not.toHaveProperty('added_by')
  })
})
