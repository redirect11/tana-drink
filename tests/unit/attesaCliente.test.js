// @vitest-environment happy-dom
// @livello integrazione
'use strict'

// ── L'ORDINE MODIFICATO DAL BANCO TORNA AL CLIENTE (REQ-CLI-009) ──────
//
// Daniele, 13/11/2026: un ordine dal telefono lo conferma chi lo riceve al
// banco, che può cambiarlo — un ingrediente, il prezzo. Se cambia prezzo o
// ingredienti, il cliente lo vede modificato e lo accetta o lo rifiuta;
// rifiutato è annullato dal cliente; il tempo per rispondere lo decide il
// titolare (10 minuti di partenza), e scaduto l'ordine si annulla.
//
// QUI LA RETE NON C'È (il modello è tests/unit/giroInLocale.test.js): ogni
// scrittura resta appesa per sempre, e la cache risponde con quello che
// c'era prima. L'attesa deve partire nella stessa scrittura delle righe e
// vedersi subito nel conto che torna — se il banco dovesse aspettare la
// rete per sapere che il conto è fermo, lo farebbe avanzare.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mai = () => new Promise(() => {})
const stato = { ordine: null, scritture: [] }

vi.mock('../../src/lib/firebaseClient.js', () => ({
  db: {},
  auth: { currentUser: { uid: 'u1', email: 'banco@tana.it', displayName: 'Banco' } },
  functions: {},
  storage: {},
}))

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
  addDoc: vi.fn(() => mai()),
  setDoc: vi.fn(() => mai()),
  updateDoc: vi.fn((_r, patch) => {
    stato.scritture.push(patch)
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
const attesa = await import('../../src/lib/attesaCliente.js')

const subito = (p) =>
  Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('rimasto appeso')), 1000))])

const gin = (prezzo = 8, gin = 'tanq') => ({
  drink_id: 'gt',
  name: 'Gin Tonic',
  qty: 1,
  unit_price: prezzo,
  ...(gin !== 'tanq'
    ? { custom: true, recipe_items: [{ inventory_item_id: gin, name: gin, qty: 40, unit: 'ml' }] }
    : {}),
})

// Un ordine arrivato dal telefono: nessuno del personale l'ha battuto.
const dalTelefono = (extra = {}) => ({
  status: 'aperto',
  placed_by: null,
  daily_number: 12,
  total: 8,
  items: [gin()],
  comande: [{ id: 'c1', seq: 1, status: 'ricevuto', items: [gin()], inventory_applied: false }],
  ...extra,
})

beforeEach(() => {
  _azzeraMutazioni()
  stato.ordine = dalTelefono()
  stato.scritture = []
})

describe('quando il banco cambia l’ordine del cliente', () => {
  it('cambiato il gin, il conto aspetta il cliente: subito, senza rete', async () => {
    const prima = Date.now()
    const dopo = await subito(api.bartenderUpdateComanda('ord-1', 'c1', { items: [gin(10, 'mare')] }))
    expect(dopo.attesa_cliente).toMatchObject({ totale_prima: 8 })
    expect(attesa.inAttesa(dopo)).toBe(true)
    // Dieci minuti di partenza.
    const minuti = (Date.parse(dopo.attesa_cliente.scade) - Date.parse(dopo.attesa_cliente.dal)) / 60000
    expect(minuti).toBe(10)
    expect(Date.parse(dopo.attesa_cliente.dal)).toBeGreaterThanOrEqual(prima - 1000)
    // E nella STESSA scrittura delle righe.
    expect(stato.scritture).toHaveLength(1)
    expect(stato.scritture[0]).toMatchObject({ total: 10, attesa_cliente: { totale_prima: 8 } })
  })

  it('il tempo lo decide il titolare', () => {
    const a = attesa.attesaNuova({ total: 8 }, { attesa_cliente_minuti: 3 }, new Date('2026-11-13T20:00:00.000Z'))
    expect(a).toEqual({ dal: '2026-11-13T20:00:00.000Z', scade: '2026-11-13T20:03:00.000Z', totale_prima: 8 })
  })

  it('una nota del banco non cambia quello che il cliente paga: niente attesa', async () => {
    const dopo = await subito(api.bartenderUpdateComanda('ord-1', 'c1', { items: [{ ...gin(), note: 'poco ghiaccio' }] }))
    expect(dopo.attesa_cliente).toBeNull()
    expect(stato.scritture[0]).not.toHaveProperty('attesa_cliente')
  })

  it('l’ordine battuto dal personale non torna a nessuno', async () => {
    stato.ordine = dalTelefono({ placed_by: { email: 'sala@tana.it', role: 'staff' } })
    const dopo = await subito(api.bartenderUpdateComanda('ord-1', 'c1', { items: [gin(10, 'mare')] }))
    expect(dopo.attesa_cliente).toBeNull()
  })

  it('un ordine già pronto non si rimette in discussione', async () => {
    stato.ordine = dalTelefono({ comande: [{ id: 'c1', seq: 1, status: 'pronto', items: [gin()] }] })
    const dopo = await subito(api.bartenderUpdateComanda('ord-1', 'c1', { items: [gin(10, 'mare')] }))
    expect(dopo.attesa_cliente).toBeNull()
  })

  // Il revisore, 13/11/2026: il pagamento online senza POS segna «pagato»
  // e lascia il conto aperto. Un rifiuto o una scadenza lo annullerebbero
  // già incassato: lì le modifiche si concordano al banco.
  it('con un pagamento già partito non si aspetta nessuno', async () => {
    for (const pagamento of [
      { payment_status: 'pagato', payment_method: 'online' },
      { payment_status: 'in_attesa', payment_method: 'online' },
      { payment_status: 'parziale' },
      { payments: [{ id: 'p1', amount: 4 }] },
    ]) {
      _azzeraMutazioni()
      stato.ordine = dalTelefono(pagamento)
      const dopo = await subito(api.bartenderUpdateComanda('ord-1', 'c1', { items: [gin(10, 'mare')] }))
      expect(dopo.attesa_cliente).toBeNull()
    }
  })

  it('il banco che rimette l’ordine com’era chiude l’attesa', async () => {
    const prima = await subito(api.bartenderUpdateComanda('ord-1', 'c1', { items: [gin(10, 'mare')] }))
    _azzeraMutazioni()
    stato.ordine = { ...dalTelefono(), total: 10, attesa_cliente: prima.attesa_cliente, comande: [{ id: 'c1', seq: 1, status: 'ricevuto', items: [gin(10, 'mare')] }] }
    const dopo = await subito(api.bartenderUpdateComanda('ord-1', 'c1', { items: [gin()] }))
    expect(dopo.attesa_cliente).toBeNull()
    expect(stato.scritture.at(-1)).toMatchObject({ attesa_cliente: null, total: 8 })
  })

  it('una seconda modifica fa ripartire il tempo, col totale che il cliente aveva ordinato', async () => {
    stato.ordine = dalTelefono({
      total: 10,
      attesa_cliente: { dal: '2026-11-12T20:00:00.000Z', scade: '2026-11-12T20:10:00.000Z', totale_prima: 8 },
    })
    const dopo = await subito(api.bartenderUpdateComanda('ord-1', 'c1', { items: [gin(11, 'hend')] }))
    expect(dopo.attesa_cliente.totale_prima).toBe(8)
    expect(Date.parse(dopo.attesa_cliente.dal)).toBeGreaterThan(Date.parse('2026-11-12T20:00:00.000Z'))
  })
})

describe('la risposta', () => {
  const inAttesa = () =>
    dalTelefono({
      total: 10,
      attesa_cliente: { dal: new Date().toISOString(), scade: new Date(Date.now() + 600000).toISOString(), totale_prima: 8 },
    })

  it('accettato, il conto prosegue e resta scritto com’è andata', async () => {
    stato.ordine = inAttesa()
    const dopo = await subito(api.rispondiAllaModifica('ord-1', 'accettato'))
    expect(dopo.attesa_cliente).toBeNull()
    expect(dopo.risposta_cliente).toMatchObject({ esito: 'accettato' })
    expect(dopo.risposta_cliente.al_banco).toBeUndefined()
  })

  it('il sì a voce lo segna il banco', async () => {
    stato.ordine = inAttesa()
    const dopo = await subito(api.rispondiAllaModifica('ord-1', 'accettato', { alBanco: true }))
    expect(dopo.risposta_cliente).toMatchObject({ esito: 'accettato', al_banco: true })
  })

  it('rifiutato, è annullato dal cliente', async () => {
    stato.ordine = inAttesa()
    const dopo = await subito(api.rispondiAllaModifica('ord-1', 'rifiutato'))
    expect(dopo.workflow_status).toBe('annullato')
    expect(stato.scritture.at(-1)).toMatchObject({
      status: 'annullato',
      cancelled_by: 'cliente',
      cancel_kind: attesa.ANNULLO_RIFIUTO,
      // Le regole lo pretendono: annullando, l'attesa si chiude.
      attesa_cliente: null,
    })
  })

  it('allo scadere lo annulla la coda, senza firmarlo col nome di chi l’aveva aperta', async () => {
    stato.ordine = inAttesa()
    await subito(api.cancelOrder('ord-1', { by: 'cliente', kind: attesa.ANNULLO_SCADUTO, persona: null }))
    expect(stato.scritture.at(-1)).toMatchObject({ cancelled_by: 'cliente', cancel_kind: 'attesa_scaduta', cancelled_persona: null })
  })
})

describe('le regole dell’attesa', () => {
  const o = (extra) => ({ status: 'aperto', attesa_cliente: { dal: '2026-11-13T20:00:00.000Z', scade: '2026-11-13T20:10:00.000Z' }, ...extra })

  it('minuti: quelli del titolare, fra 1 e 120; senza, 10', () => {
    expect(attesa.minutiAttesa({})).toBe(10)
    expect(attesa.minutiAttesa({ attesa_cliente_minuti: '5' })).toBe(5)
    expect(attesa.minutiAttesa({ attesa_cliente_minuti: 0 })).toBe(10)
    expect(attesa.minutiAttesa({ attesa_cliente_minuti: 999 })).toBe(120)
  })

  it('scaduta e minuti rimasti', () => {
    expect(attesa.scaduta(o(), Date.parse('2026-11-13T20:09:00.000Z'))).toBe(false)
    expect(attesa.minutiRimasti(o(), Date.parse('2026-11-13T20:08:30.000Z'))).toBe(2)
    expect(attesa.scaduta(o(), Date.parse('2026-11-13T20:10:00.000Z'))).toBe(true)
    expect(attesa.minutiRimasti(o(), Date.parse('2026-11-13T20:20:00.000Z'))).toBe(0)
    // Un conto annullato non aspetta più nessuno.
    expect(attesa.inAttesa(o({ status: 'annullato' }))).toBe(false)
  })

  it('cambia per il cliente: prezzo, prodotto, ricetta, quantità; non l’ordine delle righe', () => {
    const a = { drink_id: 'a', name: 'A', unit_price: 5, qty: 1 }
    const b = { drink_id: 'b', name: 'B', unit_price: 6, qty: 2 }
    expect(attesa.cambiaPerIlCliente([a, b], [b, a])).toBe(false)
    expect(attesa.cambiaPerIlCliente([a], [{ ...a, unit_price: 6 }])).toBe(true)
    expect(attesa.cambiaPerIlCliente([a], [{ ...a, qty: 2 }])).toBe(true)
    expect(attesa.cambiaPerIlCliente([a, b], [a])).toBe(true)
    expect(attesa.cambiaPerIlCliente([a], [{ ...a, recipe_items: [{ inventory_item_id: 'x', qty: 1 }] }])).toBe(true)
    expect(attesa.cambiaPerIlCliente([a], [{ ...a, note: 'per Anna' }])).toBe(false)
  })
})
