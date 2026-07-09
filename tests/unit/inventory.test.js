'use strict'

// Unit test della logica pura inventario (src/lib/inventory.js).

import { describe, it, expect } from 'vitest'
import {
  toBaseQty,
  formatQty,
  stockStatus,
  computeConsumption,
  bottleBreakdown,
  inventorySummary,
  filterItems,
  costWithVat,
  unitsInStock,
  stockValue,
  costPerCl,
  inventoryTotalValue,
} from '../../src/lib/inventory.js'

describe('toBaseQty', () => {
  it('converte cl→ml e L→ml', () => {
    expect(toBaseQty(25, 'cl')).toBe(250)
    expect(toBaseQty(1, 'l')).toBe(1000)
  })
  it('converte kg→g', () => {
    expect(toBaseQty(2, 'kg')).toBe(2000)
  })
  it('lascia invariate le unità base', () => {
    expect(toBaseQty(250, 'ml')).toBe(250)
    expect(toBaseQty(3, 'pz')).toBe(3)
    expect(toBaseQty(500, 'g')).toBe(500)
  })
})

describe('formatQty', () => {
  it('ml: mostra cl quando multiplo di 10, L oltre il litro', () => {
    expect(formatQty(250, 'ml')).toBe('25 cl')
    expect(formatQty(25, 'ml')).toBe('25 ml')
    expect(formatQty(1500, 'ml')).toBe('1,5 L')
  })
  it('pz e g', () => {
    expect(formatQty(3, 'pz')).toBe('3 pz')
    expect(formatQty(500, 'g')).toBe('500 g')
    expect(formatQty(2000, 'g')).toBe('2 kg')
  })
})

describe('stockStatus', () => {
  it('empty quando ≤ 0', () => {
    expect(stockStatus({ stock: 0, low_threshold: 5 })).toBe('empty')
    expect(stockStatus({ stock: -10, low_threshold: 5 })).toBe('empty')
  })
  it('low quando ≤ soglia', () => {
    expect(stockStatus({ stock: 5, low_threshold: 5 })).toBe('low')
    expect(stockStatus({ stock: 3, low_threshold: 5 })).toBe('low')
  })
  it('ok quando sopra soglia', () => {
    expect(stockStatus({ stock: 100, low_threshold: 5 })).toBe('ok')
  })
})

describe('bottleBreakdown', () => {
  it('esempio: bottiglia 1L, 4 totali, stock 2,5L → 2 piene, 0,5L aperta, 1 finita', () => {
    const bd = bottleBreakdown({ unit: 'ml', package_size: 1000, bottles_total: 4, stock: 2500 })
    expect(bd).toEqual({ full: 2, openRemaining: 500, hasOpen: true, finished: 1, total: 4 })
  })
  it('tutte piene: nessuna aperta, nessuna finita', () => {
    const bd = bottleBreakdown({ unit: 'ml', package_size: 1000, bottles_total: 3, stock: 3000 })
    expect(bd).toMatchObject({ full: 3, hasOpen: false, finished: 0 })
  })
  it('stock 0: tutte finite', () => {
    const bd = bottleBreakdown({ unit: 'ml', package_size: 1000, bottles_total: 4, stock: 0 })
    expect(bd).toMatchObject({ full: 0, hasOpen: false, finished: 4 })
  })
  it('null per prodotti a pezzi o senza confezione', () => {
    expect(bottleBreakdown({ unit: 'pz', stock: 10 })).toBeNull()
    expect(bottleBreakdown({ unit: 'ml', package_size: 0, stock: 10 })).toBeNull()
  })
})

describe('inventorySummary', () => {
  const items = [
    { stock: 100, low_threshold: 10 }, // ok
    { stock: 5, low_threshold: 10 }, // low
    { stock: 0, low_threshold: 10 }, // empty
    { stock: 8, low_threshold: 10 }, // low
  ]
  it('conta totale, low e empty', () => {
    expect(inventorySummary(items)).toEqual({ total: 4, low: 2, empty: 1 })
  })
  it('lista vuota', () => {
    expect(inventorySummary([])).toEqual({ total: 0, low: 0, empty: 0 })
  })
})

describe('filterItems', () => {
  const items = [
    { name: 'Rum Zacapa', category_id: 'distillati', stock: 100, low_threshold: 10 },
    { name: 'Rum Bianco', category_id: 'distillati', stock: 5, low_threshold: 10 },
    { name: 'Birra IPA', category_id: 'birre', stock: 0, low_threshold: 6 },
    { name: 'Sciroppo', category_id: null, stock: 50, low_threshold: 5 },
  ]
  it('ricerca per nome (case-insensitive)', () => {
    expect(filterItems(items, { query: 'rum' }).map((i) => i.name)).toEqual(['Rum Bianco', 'Rum Zacapa'])
  })
  it('filtra per categoria', () => {
    expect(filterItems(items, { categoryId: 'birre' }).map((i) => i.name)).toEqual(['Birra IPA'])
  })
  it('filtra i senza categoria', () => {
    expect(filterItems(items, { categoryId: 'none' }).map((i) => i.name)).toEqual(['Sciroppo'])
  })
  it('filtra per stato', () => {
    expect(filterItems(items, { status: 'empty' }).map((i) => i.name)).toEqual(['Birra IPA'])
    expect(filterItems(items, { status: 'low' }).map((i) => i.name)).toEqual(['Rum Bianco'])
  })
  it('combina ricerca + categoria + stato e ordina per nome', () => {
    const res = filterItems(items, { query: 'rum', categoryId: 'distillati', status: 'ok' })
    expect(res.map((i) => i.name)).toEqual(['Rum Zacapa'])
  })
})

describe('costi e valorizzazione', () => {
  // Amaro del Capo: 1L (1000ml), costo 12,9 netto, IVA 22 → +IVA 15,738
  const amaro = { unit: 'ml', package_size: 1000, cost: 12.9, vat: 22, stock: 2500 }
  const birra = { unit: 'pz', cost: 0.68, vat: 22, stock: 24 }

  it('costWithVat', () => {
    expect(costWithVat(12.9, 22)).toBeCloseTo(15.738, 3)
    expect(costWithVat(10, 0)).toBe(10)
  })
  it('unitsInStock: bottiglie equivalenti e pezzi', () => {
    expect(unitsInStock(amaro)).toBe(2.5) // 2500ml / 1000
    expect(unitsInStock(birra)).toBe(24)
  })
  it('stockValue con IVA', () => {
    // 2,5 bottiglie × 15,738 = 39,345
    expect(stockValue(amaro)).toBeCloseTo(39.345, 3)
    // netto: 2,5 × 12,9 = 32,25
    expect(stockValue(amaro, { gross: false })).toBeCloseTo(32.25, 3)
  })
  it('costPerCl (solo volumi)', () => {
    // 15,738 / 100cl = 0,15738
    expect(costPerCl(amaro)).toBeCloseTo(0.15738, 5)
    expect(costPerCl(birra)).toBeNull()
  })
  it('inventoryTotalValue somma i valori', () => {
    const v = inventoryTotalValue([amaro, birra])
    expect(v).toBeCloseTo(39.345 + 24 * 0.8296, 3)
  })
})

describe('computeConsumption', () => {
  const drinksById = {
    mojito: {
      recipe_items: [
        { inventory_item_id: 'rum', name: 'Rum', unit: 'ml', qty: 250 },
        { inventory_item_id: 'lime', name: 'Lime', unit: 'ml', qty: 20 },
      ],
    },
    negroni: {
      recipe_items: [{ inventory_item_id: 'rum', name: 'Rum', unit: 'ml', qty: 30 }],
    },
    birra: {
      recipe_items: [{ inventory_item_id: 'birraX', name: 'Birra X', unit: 'pz', qty: 1 }],
    },
  }

  it('moltiplica per la quantità ordinata', () => {
    const res = computeConsumption([{ drink_id: 'mojito', qty: 2 }], drinksById)
    expect(res).toEqual([
      { inventory_item_id: 'rum', name: 'Rum', unit: 'ml', qty: 500 },
      { inventory_item_id: 'lime', name: 'Lime', unit: 'ml', qty: 40 },
    ])
  })

  it('aggrega lo stesso ingrediente da drink diversi', () => {
    const res = computeConsumption(
      [{ drink_id: 'mojito', qty: 1 }, { drink_id: 'negroni', qty: 1 }],
      drinksById
    )
    const rum = res.find((r) => r.inventory_item_id === 'rum')
    expect(rum.qty).toBe(280) // 250 + 30
  })

  it('birra: scala 1 pezzo per unità ordinata', () => {
    const res = computeConsumption([{ drink_id: 'birra', qty: 3 }], drinksById)
    expect(res).toEqual([{ inventory_item_id: 'birraX', name: 'Birra X', unit: 'pz', qty: 3 }])
  })

  it('ignora drink senza ricetta', () => {
    expect(computeConsumption([{ drink_id: 'sconosciuto', qty: 5 }], drinksById)).toEqual([])
  })

  it('item custom: usa la ricetta incorporata (niente lookup catalogo)', () => {
    const res = computeConsumption(
      [
        {
          drink_id: 'custom-123',
          custom: true,
          qty: 2,
          recipe_items: [{ inventory_item_id: 'rum', name: 'Rum', unit: 'ml', qty: 40 }],
        },
      ],
      {}
    )
    expect(res).toEqual([{ inventory_item_id: 'rum', name: 'Rum', unit: 'ml', qty: 80 }])
  })

  it('la ricetta incorporata ha precedenza su quella del catalogo', () => {
    const res = computeConsumption(
      [{ drink_id: 'mojito', qty: 1, recipe_items: [{ inventory_item_id: 'gin', name: 'Gin', unit: 'ml', qty: 50 }] }],
      drinksById
    )
    expect(res).toEqual([{ inventory_item_id: 'gin', name: 'Gin', unit: 'ml', qty: 50 }])
  })
})
