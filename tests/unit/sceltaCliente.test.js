// @vitest-environment happy-dom
// @livello integrazione
'use strict'

// ── LA SCELTA DEL CLIENTE, DAL TELEFONO AL BANCO (REQ-MENU-042, REQ-CLI-008)
//
// Daniele, 13/11/2026: il cliente sceglie il gin del suo Gin Tonic, col
// supplemento che ha deciso il titolare; chi non sceglie ha la ricetta. La
// scelta deve arrivare al banco — nella comanda, da leggere — e al
// magazzino, che deve scalare il gin scelto e non quello della ricetta.
//
// LA FORMA È QUELLA CHE IL BANCO USA GIÀ quando ritocca un drink dal conto:
// il drink resta, con `custom: true` e la ricetta sua. Qui si prova che la
// riga nata dal telefono passa intera da createOrder alla comanda, SENZA
// RETE (ogni scrittura resta appesa: tests/unit/giroInLocale.test.js), e
// che lo scarico la legge come si deve.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mai = () => new Promise(() => {})
const scritture = []

vi.mock('../../src/lib/firebaseClient.js', () => ({
  db: {},
  auth: { currentUser: null },
  functions: {},
  storage: {},
}))

vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: (_db, col, id) => ({ col: col || 'orders', id: id || 'ord-1' }),
  // La cache ha la scrittura locale appena fatta, come in produzione.
  getDoc: vi.fn(async (ref) => {
    const scritta = scritture.findLast((x) => x.id === ref.id)
    return { exists: () => !!scritta, id: ref.id, data: () => scritta?.data ?? {} }
  }),
  getDocFromCache: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ docs: [] })),
  getDocsFromCache: vi.fn(async () => ({ docs: [] })),
  addDoc: vi.fn(() => mai()),
  setDoc: vi.fn((ref, data) => {
    scritture.push({ id: ref.id, data })
    return mai()
  }),
  updateDoc: vi.fn(() => mai()),
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
const { scelteDellaVoce, ricettaConScelte, rigaConScelte } = await import('../../src/lib/sceltaCliente.js')
const { chiaveRiga, nomeLetto } = await import('../../src/lib/cart.js')
const { computeConsumption } = await import('../../src/lib/inventory.js')

const subito = (p) =>
  Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('rimasto appeso')), 1000))])

const GIN = {
  tipo: 'categoria',
  id: 'cat-gin',
  nome: 'Gin',
  scelta: {
    offerti: [
      { id: 'tanq', nome: 'Tanqueray', supplemento: 0 },
      { id: 'mare', nome: 'Mare', supplemento: 2 },
      { id: 'hend', nome: 'Hendrick’s', supplemento: 3 },
    ],
    sostituisce: ['tanq'],
  },
}
const RICETTA = [
  { inventory_item_id: 'tanq', name: 'Tanqueray', qty: 40, unit: 'ml' },
  { inventory_item_id: 'tonica', name: 'Tonica', qty: 1, unit: 'pz' },
]
const VOCE = { id: 'v-gt', drink_id: 'd4', name: 'Gin Tonic', nome_gestionale: 'Gin Tonic', price: 8 }
const MARE = GIN.scelta.offerti[1]

beforeEach(() => {
  scritture.length = 0
})

describe('cosa si può scegliere adesso', () => {
  it('solo le alternative disponibili, senza il prodotto della ricetta', () => {
    const disponibili = new Map([
      ['tanq', true],
      ['mare', true],
      ['hend', false],
    ])
    const [s] = scelteDellaVoce([GIN, { tipo: 'testo', nome: 'tonica' }], disponibili)
    expect(s.etichetta).toBe(GIN)
    expect(s.opzioni.map((o) => o.id)).toEqual(['mare'])
  })

  it('un’etichetta senza alternative disponibili non chiede niente', () => {
    expect(scelteDellaVoce([GIN], new Map([['mare', false]]))).toEqual([])
    // Un prodotto che non ha più il permesso non ha il documento pubblico.
    expect(scelteDellaVoce([GIN], new Map())).toEqual([])
  })
})

describe('la riga con la scelta', () => {
  it('cambia il prodotto, non la dose', () => {
    expect(ricettaConScelte(RICETTA, [{ etichetta: GIN, scelto: MARE }])).toEqual([
      { inventory_item_id: 'mare', name: 'Mare', qty: 40, unit: 'ml' },
      RICETTA[1],
    ])
    // La ricetta del prodotto resta com'era.
    expect(RICETTA[0].inventory_item_id).toBe('tanq')
  })

  it('porta il supplemento nel prezzo, la scelta nella nota e nel nome letto', () => {
    const riga = rigaConScelte(VOCE, RICETTA, [{ etichetta: GIN, scelto: MARE }])
    expect(riga).toMatchObject({ drink_id: 'd4', name: 'Gin Tonic', price: 10, custom: true, note: 'Gin: Mare' })
    expect(nomeLetto(riga)).toBe('Gin Tonic (Mare)')
  })

  it('senza scelte è la riga di sempre', () => {
    const riga = rigaConScelte(VOCE, RICETTA, [])
    expect(riga).toEqual({ drink_id: 'd4', name: 'Gin Tonic', price: 8, qty: 1, sumup_product_id: null })
  })

  it('col nome del menù diverso dal banco, la nota li dice tutti e due', () => {
    const riga = rigaConScelte({ ...VOCE, name: 'GT della casa' }, RICETTA, [{ etichetta: GIN, scelto: MARE }])
    expect(riga.note).toBe('GT della casa · Gin: Mare')
  })

  it('due scelte diverse sono due righe, due uguali una', () => {
    const mare = rigaConScelte(VOCE, RICETTA, [{ etichetta: GIN, scelto: MARE }])
    const hend = rigaConScelte(VOCE, RICETTA, [{ etichetta: GIN, scelto: GIN.scelta.offerti[2] }])
    const ricetta = rigaConScelte(VOCE, RICETTA, [])
    expect(new Set([chiaveRiga(mare), chiaveRiga(hend), chiaveRiga(ricetta)]).size).toBe(3)
    expect(chiaveRiga(rigaConScelte(VOCE, RICETTA, [{ etichetta: GIN, scelto: MARE }]))).toBe(chiaveRiga(mare))
  })
})

describe('al banco, senza rete', () => {
  it('la comanda nasce con la riga scelta intera, e il magazzino scala il gin scelto', async () => {
    const riga = rigaConScelte(VOCE, RICETTA, [{ etichetta: GIN, scelto: MARE }])
    const ordine = await subito(api.createOrder({ table_label: '5', items: [{ ...riga, qty: 2 }] }))
    const [item] = ordine.comande[0].items
    expect(item).toMatchObject({ drink_id: 'd4', name: 'Gin Tonic', unit_price: 10, qty: 2, custom: true, note: 'Gin: Mare' })
    expect(ordine.total).toBe(20)
    // Lo scarico legge la ricetta della riga, non quella del prodotto.
    const consumo = computeConsumption(ordine.comande[0].items, { d4: { recipe_items: RICETTA } })
    expect(consumo).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ inventory_item_id: 'mare', qty: 80 }),
        expect.objectContaining({ inventory_item_id: 'tonica', qty: 2 }),
      ])
    )
    expect(consumo.find((c) => c.inventory_item_id === 'tanq')).toBeUndefined()
  })
})
