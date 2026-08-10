import { describe, it, expect } from 'vitest'
import {
  splitLineRevenueByMacro,
  revenueByMacro,
  purchasesByMacro,
  macroMonthlyReport,
  UNASSIGNED,
} from '../../src/lib/macroStats.js'

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

  it('salta gli ordini annullati', () => {
    const orders = [{ status: 'annullato', order_items: [{ drink_id: 'negroni', qty: 1, unit_price: 7 }] }]
    expect(revenueByMacro(orders, { drinksById: { negroni }, itemsById, catToMacro }).size).toBe(0)
  })
})

describe('purchasesByMacro', () => {
  const pos = [
    {
      status: 'ricevuto',
      lines: [
        { item_id: 'gin', unit_cost: 21, qty_packages: 2 }, // 42 → Distillati
        { item_id: 'verm', unit_cost: 15, qty_packages: 1 }, // 15 → Vino
        { item_id: 'cola', unit_cost: 0.5, qty_packages: 10 }, // 5 → none (senza macro)
      ],
    },
    { status: 'inviato', lines: [{ item_id: 'gin', unit_cost: 21, qty_packages: 5 }] }, // non ricevuto → ignorato
  ]
  it('somma per macro solo gli ordini ricevuti (netto = unit_cost × colli)', () => {
    const acc = purchasesByMacro(pos, { itemsById, catToMacro })
    expect(acc.get('m1')).toBeCloseTo(42, 2)
    expect(acc.get('m2')).toBeCloseTo(15, 2)
    expect(acc.get(UNASSIGNED)).toBeCloseTo(5, 2)
  })
})

describe('macroMonthlyReport', () => {
  const macros = [
    { id: 'm1', name: 'Distillati' },
    { id: 'm2', name: 'Vino' },
  ]
  const orders = [
    { status: 'aperto', created_at: '2026-07-15T20:00:00Z', order_items: [{ drink_id: 'negroni', qty: 1, unit_price: 7 }] },
    { status: 'pagato', created_at: '2026-06-10T20:00:00Z', order_items: [{ drink_id: 'negroni', qty: 1, unit_price: 7 }] },
  ]
  const purchaseOrders = [
    { status: 'ricevuto', received_at: '2026-07-03T09:00:00Z', lines: [{ item_id: 'gin', unit_cost: 21, qty_packages: 2 }] },
  ]
  const rep = macroMonthlyReport({
    orders,
    purchaseOrders,
    drinksById: { negroni },
    itemsById,
    catToMacro,
    macros,
    months: ['2026-06', '2026-07'],
  })

  it('mette fatturato e acquisti nel mese giusto per macro', () => {
    const distillati = rep.rows.find((r) => r.id === 'm1')
    expect(distillati.byMonth.get('2026-07').fatturato).toBeCloseTo(5.5, 2)
    expect(distillati.byMonth.get('2026-07').acquisti).toBeCloseTo(42, 2)
    expect(distillati.byMonth.get('2026-06').fatturato).toBeCloseTo(5.5, 2)
    expect(distillati.byMonth.get('2026-06').acquisti).toBe(0)
  })

  it('calcola utile e rapporto per cella', () => {
    const distillati = rep.rows.find((r) => r.id === 'm1')
    const lug = distillati.byMonth.get('2026-07')
    expect(lug.utile).toBeCloseTo(5.5 - 42, 2)
    expect(lug.rapporto).toBeCloseTo(0.13, 2) // 5,5/42 arrotondato a 2 decimali
    // mese senza acquisti → rapporto null (niente divisione per zero)
    expect(distillati.byMonth.get('2026-06').rapporto).toBeNull()
  })

  it('totali per macro (anno) e generale', () => {
    const distillati = rep.rows.find((r) => r.id === 'm1')
    expect(distillati.tot.fatturato).toBeCloseTo(11, 2)
    expect(distillati.tot.acquisti).toBeCloseTo(42, 2)
    expect(rep.grand.fatturato).toBeCloseTo(14, 2) // 2 negroni: Distillati 11 + Vino 3
    expect(rep.grand.acquisti).toBeCloseTo(42, 2)
  })

  it('scorpora l’IVA dal fatturato usando l’aliquota del PRODOTTO', () => {
    // gin/bitter al 22%, vermouth al 10%: lo scorporo è per-prodotto.
    const items = {
      gin: { ...itemsById.gin, vat: 22 },
      bitter: { ...itemsById.bitter, vat: 22 },
      verm: { ...itemsById.verm, vat: 10 },
    }
    const rep2 = macroMonthlyReport({
      orders,
      purchaseOrders,
      drinksById: { negroni },
      itemsById: items,
      catToMacro,
      macros,
      months: ['2026-06', '2026-07'],
      saleVat: 0,
    })
    // Distillati (gin+bitter) lordo anno 11 → netto 11/1,22 = 9,02
    expect(rep2.rows.find((r) => r.id === 'm1').tot.fatturato).toBeCloseTo(9.02, 1)
    // Vino (vermouth) lordo 3 → netto 3/1,10 = 2,73
    expect(rep2.rows.find((r) => r.id === 'm2').tot.fatturato).toBeCloseTo(2.73, 1)
    // Acquisti invariati (già netti)
    expect(rep2.rows.find((r) => r.id === 'm1').tot.acquisti).toBeCloseTo(42, 2)
  })
})
