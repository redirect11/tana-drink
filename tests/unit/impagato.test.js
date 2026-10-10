// @vitest-environment happy-dom
'use strict'

// CHIUDERE UN CONTO IMPAGATO (REQ-CASSA-016). Richiesta del 10/10/2026: un
// tasto «IMPAGATO» sotto contante, carta e SumUp, con delle note. Deciso:
// è un credito da riscuotere — il tavolo si libera, i soldi mancano.
//
// Si prova la regola (cosa diventa il conto), la cassa (non blocca la
// chiusura, non è un incasso) e il gesto SENZA RETE, come al banco: ogni
// scrittura resta appesa, e la chiusura deve tornare subito lo stesso.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { aCapo, patchImpagato } from '../../src/lib/impagato.js'
import { contoChiuso, impagatoAperto } from '../../src/lib/comande.js'
import { cashRecap } from '../../src/lib/cassa.js'

const mai = () => new Promise(() => {})
const stato = { ordine: null, scritture: [] }

vi.mock('../../src/lib/firebaseClient.js', () => ({ db: {}, auth: { currentUser: null }, functions: {}, storage: {} }))
vi.mock('firebase/firestore', () => ({
  collection: (_db, col) => ({ col }),
  doc: (_db, col, id) => ({ col: col || 'orders', id: id || 'ord-1' }),
  getDoc: vi.fn(async (ref) => {
    if (ref?.col === 'orders') return { exists: () => !!stato.ordine, id: 'ord-1', data: () => stato.ordine }
    return { exists: () => false, data: () => ({}) }
  }),
  getDocFromCache: vi.fn(async () => {
    throw new Error('niente cache')
  }),
  getDocs: vi.fn(async () => ({ docs: [] })),
  getDocsFromCache: vi.fn(async () => ({ docs: [] })),
  addDoc: vi.fn((c, data) => {
    stato.scritture.push({ tipo: 'add', col: c?.col, data })
    return mai()
  }),
  setDoc: vi.fn(() => mai()),
  updateDoc: vi.fn((ref, patch) => {
    stato.scritture.push({ tipo: 'update', col: ref?.col, patch })
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

const { chiudiImpagato } = await import('../../src/lib/api.js')
const { _azzeraMutazioni } = await import('../../src/lib/mutazioniOrdine.js')

const conto = (extra = {}) => ({
  status: 'aperto',
  payment_status: 'non_richiesto',
  daily_number: 29,
  total: 16,
  discount_amount: 0,
  payments: [],
  comande: [{ id: 'c1', seq: 1, status: 'ricevuto', items: [], inventory_applied: false }],
  created_at: '2026-10-10T21:00:00.000Z',
  ...extra,
})
const entroUnSecondo = (p) =>
  Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('rimasto appeso')), 1000))])

beforeEach(() => {
  _azzeraMutazioni()
  stato.ordine = conto()
  stato.scritture = []
})

describe('cosa diventa un conto chiuso impagato', () => {
  it('le comande risultano servite, e resta scritto quanto manca', () => {
    const p = patchImpagato(conto(), { nowIso: 'T', nota: '  paga Mario  ', chi: { name: 'Flavio' } })
    expect(p.comande[0].status).toBe('ritirato')
    expect(p.impagato).toEqual({ at: 'T', nota: 'paga Mario', chi: { name: 'Flavio' }, importo: 16 })
  })

  // Un acconto già preso non è da riscuotere.
  it('quello che manca tiene conto degli acconti', () => {
    const p = patchImpagato(conto({ payments: [{ amount: 6, method: 'banco' }] }), { nowIso: 'T' })
    expect(p.impagato.importo).toBe(10)
  })

  it('per la coda è chiuso; pagato dopo, è un conto pagato e basta', () => {
    const imp = { ...conto(), impagato: { at: 'T' } }
    expect(impagatoAperto(imp)).toBe(true)
    expect(contoChiuso(imp)).toBe(true)
    const pagato = { ...imp, status: 'pagato', payment_status: 'pagato' }
    expect(impagatoAperto(pagato)).toBe(false)
    expect(contoChiuso(pagato)).toBe(true)
  })
})

describe('la cassa', () => {
  const sessione = { id: 's1', opened_at: '2026-10-10T17:00:00.000Z', fondo_cassa: 50 }

  it('un impagato non blocca la chiusura e non è un incasso, ma si sa quanto manca', () => {
    const r = cashRecap([{ ...conto(), impagato: { at: '2026-10-10T22:00:00.000Z', importo: 16 } }], sessione, '2026-10-10T23:00:00.000Z')
    expect(r.nAperti).toBe(0)
    expect(r.incassato).toBe(0)
    expect(r.nImpagati).toBe(1)
    expect(r.impagatoDaRiscuotere).toBe(16)
  })
})

describe('le note in grande', () => {
  it('vanno a capo fra le parole', () => {
    expect(aCapo('paga Mario domani sera al banco', 12)).toEqual(['paga Mario', 'domani sera', 'al banco'])
  })
  it('una parola più lunga della riga si spezza, e gli a capo restano', () => {
    expect(aCapo('supercalifragilistico\nok', 10)).toEqual(['supercalif', 'ragilistic', 'o', 'ok'])
  })
})

describe('chiudere impagato senza rete', () => {
  it('torna subito, col conto composto', async () => {
    const c = await entroUnSecondo(chiudiImpagato('ord-1', { nota: 'paga Mario' }))
    expect(c.impagato.nota).toBe('paga Mario')
    expect(c.comande[0].status).toBe('ritirato')
    const patch = stato.scritture.find((s) => s.tipo === 'update' && s.patch.impagato)?.patch
    expect(patch).toBeTruthy()
    expect(patch.closed_at).toBeTruthy()
    // Nessun pagamento: niente da contare in cassa.
    expect(patch).not.toHaveProperty('payments')
    expect(patch).not.toHaveProperty('payment_status')
  })

  it('un conto già pagato non si chiude impagato', async () => {
    stato.ordine = conto({ status: 'pagato', payment_status: 'pagato' })
    await expect(chiudiImpagato('ord-1')).rejects.toThrow(/già chiuso/)
  })
})
