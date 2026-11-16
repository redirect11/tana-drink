// IL TEMPO DI LAVORAZIONE SI DOSA IN U (BUG-164).
//
// Daniele, 16/11/2026: il tempo di lavorazione in ricetta «va calcolato come
// un normale ingrediente quindi deve comparire nei costi … 1 pz corrisponde a
// 60 U ed 1 pz costa 10€». L'articolo era già così, ma 57 righe di ricetta su
// 59 lo dosavano in GRAMMI, scritte quando il grammo era l'unica unità: un
// grammo di un articolo a U non ha un costo, e la riga restava fuori.
// Lo script `scripts/lavorazione-in-u.js` le riscrive in U; qui la parte che
// decide quali, e la prova che dopo il costo c'è.

import { describe, it, expect } from 'vitest'
import { siDosaAU, righeInGrammi } from '../../scripts/lib-lavorazione.js'
import { costoRiga, recipeCost } from '../../src/lib/pricing.js'

// Com'è in produzione e sul test.
const LAVORAZIONE = { unit: 'pz', package_size: 60, content_unit: 'U', cost: 10, vat: 0 }
const GIN = { unit: 'pz', package_size: 700, content_unit: 'ml', cost: 20, vat: 0 }

describe('quali articoli si dosano a U', () => {
  it('il pezzo che contiene unità, e l’articolo a unità generiche', () => {
    expect(siDosaAU(LAVORAZIONE)).toBe(true)
    expect(siDosaAU({ unit: 'U' })).toBe(true)
    expect(siDosaAU(GIN)).toBe(false)
    expect(siDosaAU({ unit: 'pz', content_unit: 'U' })).toBe(false) // senza contenuto non contiene niente
    expect(siDosaAU(null)).toBe(false)
  })
})

describe('quali righe si riscrivono', () => {
  const ids = new Set(['lav'])
  it('solo quelle in grammi degli articoli a U', () => {
    const righe = [
      { inventory_item_id: 'gin', unit: 'ml' },
      { inventory_item_id: 'lav', unit: 'g' },
      { inventory_item_id: 'lav', unit: 'U' },
      { inventory_item_id: 'zucchero', unit: 'g' },
      { inventory_item_id: 'lav', unit: 'G' },
    ]
    expect(righeInGrammi(righe, ids)).toEqual([1, 4])
  })

  it('una ricetta già in U non ha niente da fare: rilanciato, lo script non tocca niente', () => {
    expect(righeInGrammi([{ inventory_item_id: 'lav', unit: 'U' }], ids)).toEqual([])
    expect(righeInGrammi(null, ids)).toEqual([])
  })
})

describe('dopo, il tempo di lavorazione è nel costo del drink', () => {
  it('in grammi non ha un costo; in U vale 10 € ogni 60', () => {
    expect(costoRiga({ inventory_item_id: 'lav', qty: 1.5, unit: 'g' }, LAVORAZIONE)).toBeNull()
    expect(costoRiga({ inventory_item_id: 'lav', qty: 1.5, unit: 'U' }, LAVORAZIONE)).toBeCloseTo(0.25, 10)
    expect(costoRiga({ inventory_item_id: 'lav', qty: 60, unit: 'U' }, LAVORAZIONE)).toBeCloseTo(10, 10)
  })

  it('il costo della ricetta non è più parziale', () => {
    const itemsById = { lav: LAVORAZIONE, gin: GIN }
    const prima = recipeCost(
      [
        { inventory_item_id: 'gin', name: 'Gin', qty: 35, unit: 'ml' },
        { inventory_item_id: 'lav', name: 'Tempo di Lavorazione', qty: 3, unit: 'g' },
      ],
      itemsById
    )
    expect(prima.missing).toEqual(['Tempo di Lavorazione'])
    const dopo = recipeCost(
      [
        { inventory_item_id: 'gin', name: 'Gin', qty: 35, unit: 'ml' },
        { inventory_item_id: 'lav', name: 'Tempo di Lavorazione', qty: 3, unit: 'U' },
      ],
      itemsById
    )
    expect(dopo.missing).toEqual([])
    expect(dopo.cost).toBeCloseTo(1 + 0.5, 4)
  })
})
