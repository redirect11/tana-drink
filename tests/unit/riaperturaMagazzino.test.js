// @vitest-environment happy-dom
'use strict'

// BUG-113. Flavio, 05/10/2026: «se io faccio un conto, lo incasso, mi scala
// i prodotti. Fatto un errore, lo voglio riaprire: non me li ricarica,
// perché poi quando lo richiudo me li scarica un'altra volta».
//
// Due difetti insieme, e qui si provano tutti e due:
//   · alla chiusura con l'incasso il segno «questa comanda è già scalata»
//     restava in memoria e non arrivava sul conto: richiudendo, si scalava
//     di nuovo;
//   · riaprire un conto incassato non rimetteva niente in magazzino.
//
// E SENZA RETE, come si lavora al banco: ogni scrittura resta appesa per
// sempre, le letture rispondono con quello che c'era. Il segno si scrive nel
// turno del conto: se quel turno aspettasse il server, offline la riapertura
// non tornerebbe più.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { comandeRiaperte, patchRipristino, scaricoNetto } from '../../src/lib/ripristino.js'

const mai = () => new Promise(() => {})
const stato = { ordine: null, movimenti: [], scritture: [], letturaMovimenti: 0 }

// Un gin da 70 cl, giacenza in bottiglie; il Gin Tonic ne versa 5 cl.
const GIN = { name: 'Gin', unit: 'pz', package_size: 700, content_unit: 'ml', stock: 5, cost: 20 }
const GIN_TONIC = { name: 'Gin Tonic', recipe_items: [{ inventory_item_id: 'gin', qty: 50, unit: 'ml' }] }

vi.mock('../../src/lib/firebaseClient.js', () => ({
  db: {},
  auth: { currentUser: null },
  functions: {},
  storage: {},
}))

vi.mock('firebase/firestore', () => ({
  collection: (_db, col) => ({ col }),
  doc: (_db, col, id) => ({ col: col || 'orders', id: id || 'ord-1' }),
  getDoc: vi.fn(async (ref) => {
    if (ref?.col === 'drinks') return { exists: () => ref.id === 'gt', data: () => GIN_TONIC }
    if (ref?.col === 'inventory_items') return { exists: () => ref.id === 'gin', data: () => GIN }
    if (ref?.col === 'orders') return { exists: () => !!stato.ordine, id: 'ord-1', data: () => stato.ordine }
    return { exists: () => false, data: () => ({}) }
  }),
  getDocFromCache: vi.fn(async () => {
    throw new Error('niente cache')
  }),
  // L'unica query di queste prove: i movimenti del conto.
  getDocs: vi.fn(async () => {
    stato.letturaMovimenti += 1
    return { docs: stato.movimenti.map((m, i) => ({ id: `m${i}`, data: () => m })) }
  }),
  getDocsFromCache: vi.fn(async () => ({ docs: [] })),
  addDoc: vi.fn((c, data) => {
    stato.scritture.push({ tipo: 'add', col: c?.col, data })
    return mai()
  }),
  setDoc: vi.fn(() => mai()),
  updateDoc: vi.fn((ref, patch) => {
    stato.scritture.push({ tipo: 'update', col: ref?.col, id: ref?.id, patch })
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
  increment: (n) => ({ increment: n }),
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

const { markOrderPaid, restoreOrder } = await import('../../src/lib/api.js')
const { _azzeraMutazioni } = await import('../../src/lib/mutazioniOrdine.js')

const comanda = (extra = {}) => ({
  id: 'c1',
  seq: 1,
  status: 'ritirato',
  items: [{ drink_id: 'gt', name: 'Gin Tonic', qty: 2, unit_price: 8 }],
  inventory_applied: false,
  ...extra,
})
const conto = (extra = {}) => ({
  status: 'aperto',
  payment_status: 'non_richiesto',
  daily_number: 29,
  total: 16,
  discount_amount: 0,
  payments: [],
  comande: [comanda({ status: 'ricevuto' })],
  created_at: '2026-10-03T21:48:00.000Z',
  ...extra,
})
// Il conto #29 del 03/10, incassato alle 21:49.
const contoIncassato = (extra = {}) =>
  conto({
    status: 'pagato',
    payment_status: 'pagato',
    paid_at: '2026-10-03T21:49:00.000Z',
    payments: [{ amount: 16, method: 'banco', at: '2026-10-03T21:49:00.000Z' }],
    comande: [comanda()],
    ...extra,
  })
const scaricoDelle2149 = { item_id: 'gin', type: 'unload', qty: 100, unit: 'ml', reason: 'ordine', order_id: 'ord-1', created_at: '2026-10-03T21:49:01.205Z' }

const entroUnSecondo = (p) =>
  Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('rimasto appeso')), 1000))])
// Lo scarico e lo storno girano in sottofondo: si lascia finire il giro.
const sottofondo = () => new Promise((r) => setTimeout(r, 30))
const aggiunte = (reason) => stato.scritture.filter((s) => s.tipo === 'add' && s.data?.reason === reason)
const patchConto = () => stato.scritture.filter((s) => s.tipo === 'update' && s.col === 'orders').map((s) => s.patch)

beforeEach(() => {
  _azzeraMutazioni()
  stato.ordine = conto()
  stato.movimenti = []
  stato.scritture = []
  stato.letturaMovimenti = 0
})

describe('quanto ha scalato un conto (scaricoNetto)', () => {
  const items = { gin: { id: 'gin', ...GIN }, tonica: { id: 'tonica', unit: 'pz' } }

  it('lo scarico si riporta a pezzi: 10 cl di una bottiglia da 70', () => {
    expect(scaricoNetto([scaricoDelle2149], items)).toEqual([
      { inventory_item_id: 'gin', qty: 0.1429, unit: 'pz' },
    ])
  })

  // Un riallineamento che ha già rimesso qualcosa, o uno storno, non si
  // rimette due volte.
  it('meno quello che riallineamenti e storni hanno già rimesso', () => {
    const movimenti = [
      scaricoDelle2149,
      { item_id: 'gin', type: 'load', qty: 50, unit: 'ml', reason: 'modifica ordine', order_id: 'ord-1' },
      { item_id: 'tonica', type: 'unload', qty: 2, unit: 'pz', reason: 'ordine', order_id: 'ord-1' },
      { item_id: 'tonica', type: 'load', qty: 2, unit: 'pz', reason: 'storno', order_id: 'ord-1' },
    ]
    expect(scaricoNetto(movimenti, items)).toEqual([{ inventory_item_id: 'gin', qty: 0.0714, unit: 'pz' }])
  })

  it('un prodotto che non c’è più si salta', () => {
    expect(scaricoNetto([{ ...scaricoDelle2149, item_id: 'sparito' }], items)).toEqual([])
  })
})

describe('le comande di un conto riaperto', () => {
  it('riaprendo un conto incassato tornano «da scalare»', () => {
    const [c] = comandeRiaperte([comanda({ inventory_applied: true, inventory_consumption: [{}] })], 'x', {
      rimettiScorte: true,
    })
    expect(c.inventory_applied).toBe(false)
    expect(c.inventory_consumption).toBeNull()
    expect(c.status).toBe('ritirato')
  })

  // Le scorte di un conto annullato le aveva già rimesse l'annullo.
  it('riaprendo un conto annullato il segno non si tocca', () => {
    const patch = patchRipristino(
      { status: 'annullato' },
      { comande: [comanda({ status: 'annullato', inventory_applied: false })], nowIso: 'x' }
    )
    expect(patch.comande[0]).not.toHaveProperty('inventory_consumption')
  })
})

describe('incassare segna le comande scalate (senza rete)', () => {
  it('dopo lo scarico il segno e il consumo arrivano sul conto', async () => {
    await entroUnSecondo(markOrderPaid('ord-1', 'banco', { autoServe: true }))
    await sottofondo()
    expect(aggiunte('ordine')).toHaveLength(1)
    const segnate = patchConto().filter((p) => p.comande?.[0]?.inventory_applied === true)
    expect(segnate).toHaveLength(1)
    expect(segnate[0].comande[0].inventory_consumption).toEqual([expect.objectContaining({ inventory_item_id: 'gin', qty: 100, unit: 'ml' })])
  })

  // Il turno del conto non aspetta la scrittura del segno: offline non
  // tornerebbe mai, e il gesto dopo resterebbe fermo.
  it('e il conto si riapre subito dopo, anche se il server non risponde', async () => {
    await entroUnSecondo(markOrderPaid('ord-1', 'banco', { autoServe: true }))
    await sottofondo()
    const riaperto = await entroUnSecondo(restoreOrder('ord-1', { motivo: 'errore' }))
    expect(riaperto.status).toBe('aperto')
  })
})

describe('riaprire un conto incassato rimette le scorte', () => {
  it('rimette in magazzino quello che il conto aveva scalato', async () => {
    stato.ordine = contoIncassato()
    stato.movimenti = [scaricoDelle2149]
    const riaperto = await entroUnSecondo(restoreOrder('ord-1', { motivo: 'tavolo sbagliato' }))
    expect(riaperto.comande[0].inventory_applied).toBe(false)
    await sottofondo()
    const storni = aggiunte('storno')
    expect(storni).toHaveLength(1)
    expect(storni[0].data).toMatchObject({ item_id: 'gin', type: 'load', qty: 0.1429, unit: 'pz', order_id: 'ord-1' })
    const giacenza = stato.scritture.find((s) => s.tipo === 'update' && s.col === 'inventory_items')
    expect(giacenza.patch.stock).toEqual({ increment: 0.1429 })
  })

  // I conti chiusi prima della correzione il segno non ce l'hanno: quanto
  // rimettere si legge dai movimenti, non dal segno.
  it('vale anche per un conto chiuso prima della correzione, senza segno', async () => {
    stato.ordine = contoIncassato({ comande: [comanda({ inventory_applied: false })] })
    stato.movimenti = [scaricoDelle2149]
    await entroUnSecondo(restoreOrder('ord-1'))
    await sottofondo()
    expect(aggiunte('storno')).toHaveLength(1)
  })

  // La nuova chiusura può arrivare mentre la lettura dei movimenti è in
  // giro: il suo scarico non va rimesso.
  it('non rimette lo scarico di una chiusura venuta dopo la riapertura', async () => {
    stato.ordine = contoIncassato()
    stato.movimenti = [scaricoDelle2149, { ...scaricoDelle2149, created_at: '2999-01-01T00:00:00.000Z' }]
    await entroUnSecondo(restoreOrder('ord-1'))
    await sottofondo()
    expect(aggiunte('storno').map((s) => s.data.qty)).toEqual([0.1429])
  })

  it('un conto annullato e riaperto non rimette niente: l’aveva già fatto l’annullo', async () => {
    stato.ordine = contoIncassato({ status: 'annullato', payment_status: 'non_richiesto', payments: [] })
    stato.movimenti = [scaricoDelle2149]
    await entroUnSecondo(restoreOrder('ord-1'))
    await sottofondo()
    expect(stato.letturaMovimenti).toBe(0)
    expect(aggiunte('storno')).toHaveLength(0)
  })

  // Il giro di Flavio: incassa, riapre, richiude. Il magazzino scende UNA
  // volta: lo storno della riapertura pareggia il primo scarico.
  it('incassa, riapre, richiude: il magazzino scende una volta sola', async () => {
    await entroUnSecondo(markOrderPaid('ord-1', 'banco', { autoServe: true }))
    await sottofondo()
    stato.movimenti = [scaricoDelle2149]
    await entroUnSecondo(restoreOrder('ord-1'))
    await sottofondo()
    await entroUnSecondo(markOrderPaid('ord-1', 'banco', { autoServe: true }))
    await sottofondo()
    expect(aggiunte('ordine')).toHaveLength(2)
    expect(aggiunte('storno')).toHaveLength(1)
  })
})
