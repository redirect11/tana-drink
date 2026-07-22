import { describe, it, expect } from 'vitest'
import { splitLineRevenueByMacro, revenueByMacro, UNASSIGNED } from '../../src/lib/macroStats.js'

// Inventario: gin e bitter → Distillati (m1); vermouth → Vino (m2).
const itemsById = {
  gin: { unit: 'ml', package_size: 700, cost: 21, vat: 0 }, // 0,03 €/ml = 0,30 €/cl
  bitter: { unit: 'ml', package_size: 1000, cost: 25, vat: 0 }, // 0,025 €/ml = 0,25 €/cl
  verm: { unit: 'ml', package_size: 1000, cost: 15, vat: 0 }, // 0,015 €/ml = 0,15 €/cl
  cola: { unit: 'pz', cost: 0.5, vat: 0 }, // senza categoria/macro
}
const catToMacro = new Map([
  ['cat-gin', 'm1'],
  ['cat-bitter', 'm1'],
  ['cat-verm', 'm2'],
])
// aggancio item→categoria
itemsById.gin.category_id = 'cat-gin'
itemsById.bitter.category_id = 'cat-bitter'
itemsById.verm.category_id = 'cat-verm'

const negroni = {
  recipe_items: [
    { inventory_item_id: 'gin', unit: 'ml', qty: 30 },
    { inventory_item_id: 'bitter', unit: 'ml', qty: 30 },
    { inventory_item_id: 'verm', unit: 'ml', qty: 30 },
  ],
}

describe('splitLineRevenueByMacro', () => {
  it('ripartisce il prezzo reale tra le macro degli ingredienti e la somma torna', () => {
    // pesi (costo): gin 0,90 · bitter 0,75 · verm 0,45 → tot 2,10
    // 7 €: gin 3,00 · bitter 2,50 · verm 1,50  → Distillati 5,50 · Vino 1,50
    const split = splitLineRevenueByMacro({ drink_id: 'negroni', qty: 1, unit_price: 7 }, negroni, itemsById, catToMacro)
    expect(split.get('m1')).toBeCloseTo(5.5, 2)
    expect(split.get('m2')).toBeCloseTo(1.5, 2)
    const somma = [...split.values()].reduce((s, v) => s + v, 0)
    expect(somma).toBeCloseTo(7, 2) // riconcilia con l'incasso reale
  })

  it('quantità multiple: ripartisce l’incasso totale della riga', () => {
    const split = splitLineRevenueByMacro({ drink_id: 'negroni', qty: 2, unit_price: 7 }, negroni, itemsById, catToMacro)
    const somma = [...split.values()].reduce((s, v) => s + v, 0)
    expect(somma).toBeCloseTo(14, 2)
    expect(split.get('m1')).toBeCloseTo(11, 2)
  })

  it('ingrediente senza macro → quota su `none`; la somma resta l’incasso', () => {
    const cubaLibre = {
      recipe_items: [
        { inventory_item_id: 'gin', unit: 'ml', qty: 40 }, // Distillati (uso gin come rum)
        { inventory_item_id: 'cola', unit: 'pz', qty: 1 }, // senza macro → none
      ],
    }
    const split = splitLineRevenueByMacro({ drink_id: 'x', qty: 1, unit_price: 6 }, cubaLibre, itemsById, catToMacro)
    expect(split.has('m1')).toBe(true)
    expect(split.get(UNASSIGNED)).toBeGreaterThan(0)
    const somma = [...split.values()].reduce((s, v) => s + v, 0)
    expect(somma).toBeCloseTo(6, 2)
  })

  it('drink senza ricetta o senza costi → tutto su `none`', () => {
    const split = splitLineRevenueByMacro({ drink_id: 'y', qty: 1, unit_price: 5 }, {}, itemsById, catToMacro)
    expect(split.get(UNASSIGNED)).toBeCloseTo(5, 2)
  })

  it('incasso nullo → mappa vuota', () => {
    expect(splitLineRevenueByMacro({ qty: 0, unit_price: 7 }, negroni, itemsById, catToMacro).size).toBe(0)
  })
})

describe('revenueByMacro', () => {
  it('somma su più ordini/righe', () => {
    const orders = [
      { order_items: [{ drink_id: 'negroni', qty: 1, unit_price: 7 }] },
      { order_items: [{ drink_id: 'negroni', qty: 1, unit_price: 7 }] },
    ]
    const acc = revenueByMacro(orders, { drinksById: { negroni }, itemsById, catToMacro })
    expect(acc.get('m1')).toBeCloseTo(11, 2)
    expect(acc.get('m2')).toBeCloseTo(3, 2)
  })

  it('legge le righe dalle comande se mancano gli order_items', () => {
    const orders = [{ comande: [{ items: [{ drink_id: 'negroni', qty: 1, unit_price: 7 }] }] }]
    const acc = revenueByMacro(orders, { drinksById: { negroni }, itemsById, catToMacro })
    expect(acc.get('m1')).toBeCloseTo(5.5, 2)
  })
})
