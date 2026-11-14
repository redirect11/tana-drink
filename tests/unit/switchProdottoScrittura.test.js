'use strict'

// LO SWITCH PRODOTTO, SCRITTO (REQ-MENU-043). Si scrivono SOLO le righe di
// ricetta dei drink e le etichette delle voci del menù dei clienti: prezzo,
// disponibilità, foto e tutto il resto del drink restano com'erano. E in
// blocchi sotto il limite di Firestore: un menù grande non deve fallire a
// metà per un pacchetto troppo grosso.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const pacchetti = []

vi.mock('../../src/lib/firebaseClient.js', () => ({ db: {}, auth: { currentUser: null }, functions: {}, storage: {} }))
vi.mock('firebase/firestore', () => ({
  collection: (_db, nome) => ({ nome }),
  doc: (_db, col, id) => ({ col, id }),
  writeBatch: () => {
    const p = { scritture: [], spedito: false }
    pacchetti.push(p)
    return {
      update: (ref, patch) => p.scritture.push({ col: ref.col, id: ref.id, patch }),
      commit: async () => {
        p.spedito = true
      },
    }
  },
  getDoc: vi.fn(),
  getDocs: vi.fn(async () => ({ docs: [] })),
  query: () => ({}),
  where: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: () => () => {},
  serverTimestamp: () => null,
  Timestamp: class {
    static fromDate(d) {
      return d
    }
  },
}))

const { switchProdotto } = await import('../../src/lib/api.js')

beforeEach(() => {
  pacchetti.length = 0
})

describe('lo switch prodotto, scritto', () => {
  it('scrive solo recipe_items sui drink ed etichette sulle voci', async () => {
    const ricette = [{ id: 'dry', nome: 'Dry Martini', conIngresso: false, recipe_items: [{ inventory_item_id: 'noilly', qty: 10 }] }]
    const voci = [{ id: 'v1', nome: 'Dry Martini', etichette: [{ tipo: 'prodotto', id: 'noilly', nome: 'Noilly Prat' }] }]
    expect(await switchProdotto({ ricette, voci })).toEqual({ ricette: 1, voci: 1 })
    expect(pacchetti).toHaveLength(1)
    expect(pacchetti[0].spedito).toBe(true)
    expect(pacchetti[0].scritture).toEqual([
      { col: 'drinks', id: 'dry', patch: { recipe_items: [{ inventory_item_id: 'noilly', qty: 10 }] } },
      { col: 'carta_voci', id: 'v1', patch: { etichette: [{ tipo: 'prodotto', id: 'noilly', nome: 'Noilly Prat' }] } },
    ])
  })

  it('un menù grande va in più pacchetti, nessuno oltre il limite', async () => {
    const ricette = Array.from({ length: 450 }, (_, i) => ({ id: `d${i}`, recipe_items: [] }))
    const voci = Array.from({ length: 400 }, (_, i) => ({ id: `v${i}`, etichette: [] }))
    await switchProdotto({ ricette, voci })
    expect(pacchetti.map((p) => p.scritture.length)).toEqual([400, 400, 50])
    expect(pacchetti.every((p) => p.spedito)).toBe(true)
  })
})
