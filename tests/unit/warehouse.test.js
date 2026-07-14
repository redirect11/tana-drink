'use strict'

// Unit test della logica pura magazzino (src/lib/warehouse.js):
// conta periodica, ordini fornitore, scadenzario.

import { describe, it, expect } from 'vitest'
import {
  suggestedPackages,
  purchaseOrderText,
  countLineCons,
  qtyValue,
  stockCountCompute,
  purchaseOrderTotals,
  invoiceTotals,
  consumptionDiff,
} from '../../src/lib/warehouse.js'

describe('countLineCons (DEP + ACQ − RIM = CONS, come i fogli INV)', () => {
  it('esempio Excel: dep 0.8, acq 1, rim 1 → cons 0.8 (bottiglie)', () => {
    // In app le quantità sono in unità base: 800ml + 1000ml − 1000ml = 800ml
    expect(countLineCons({ dep: 800, acq: 1000, rim: 1000 })).toBe(800)
  })
  it('rim mancante → non calcolabile', () => {
    expect(countLineCons({ dep: 100, acq: 0, rim: null })).toBeNull()
    expect(countLineCons({ dep: 100, acq: 0, rim: '' })).toBeNull()
  })
  it('rim zero è valido (tutto consumato)', () => {
    expect(countLineCons({ dep: 500, acq: 0, rim: 0 })).toBe(500)
  })
})

describe('qtyValue', () => {
  const amaro = { unit: 'ml', package_size: 1000, cost: 12.9, vat: 22 }
  it('valore con IVA di una quantità in ml', () => {
    // 500ml = 0,5 bottiglie × 15,738
    expect(qtyValue(500, amaro)).toBeCloseTo(7.869, 3)
  })
  it('pezzi: quantità × costo unitario', () => {
    expect(qtyValue(6, { unit: 'pz', cost: 1, vat: 22 })).toBeCloseTo(7.32, 2)
  })
  it('quantità nulla o negativa → 0', () => {
    expect(qtyValue(0, amaro)).toBe(0)
    expect(qtyValue(-100, amaro)).toBe(0)
  })
})

describe('stockCountCompute', () => {
  it('calcola cons e valori per riga + totali', () => {
    const { lines, totals } = stockCountCompute([
      { item_id: 'a', unit: 'ml', package_size: 1000, cost: 10, vat: 0, dep: 2000, acq: 1000, rim: 1500 },
      { item_id: 'b', unit: 'pz', cost: 1, vat: 0, dep: 24, acq: 0, rim: null },
    ])
    expect(lines[0].cons).toBe(1500) // 2000+1000-1500
    expect(lines[0].cons_value).toBeCloseTo(15, 3) // 1,5 bottiglie × 10
    expect(lines[0].rim_value).toBeCloseTo(15, 3)
    expect(lines[1].cons).toBeNull()
    expect(totals.counted).toBe(1)
    expect(totals.cons_value).toBeCloseTo(15, 3)
  })
})

describe('purchaseOrderTotals', () => {
  it('somma netto, lordo e confezioni', () => {
    const t = purchaseOrderTotals([
      { qty_packages: 2, unit_cost: 10, vat: 22 }, // 20 netto, 24.4 lordo
      { qty_packages: 3, unit_cost: 1, vat: 0 }, // 3 netto, 3 lordo
    ])
    expect(t.net).toBeCloseTo(23, 3)
    expect(t.gross).toBeCloseTo(27.4, 3)
    expect(t.pieces).toBe(5)
  })
  it('ordine vuoto', () => {
    expect(purchaseOrderTotals([])).toEqual({ net: 0, gross: 0, pieces: 0 })
  })
})

describe('consumptionDiff (modifica ordine con scorte già scalate)', () => {
  const oldCons = [
    { inventory_item_id: 'rum', name: 'Rum', unit: 'ml', qty: 500 },
    { inventory_item_id: 'lime', name: 'Lime', unit: 'ml', qty: 40 },
  ]
  it('quantità aumentata → delta positivo (da scalare)', () => {
    const d = consumptionDiff(oldCons, [
      { inventory_item_id: 'rum', name: 'Rum', unit: 'ml', qty: 750 },
      { inventory_item_id: 'lime', name: 'Lime', unit: 'ml', qty: 40 },
    ])
    expect(d).toEqual([{ inventory_item_id: 'rum', name: 'Rum', unit: 'ml', delta: 250 }])
  })
  it('ingrediente rimosso → delta negativo (torna a magazzino)', () => {
    const d = consumptionDiff(oldCons, [
      { inventory_item_id: 'rum', name: 'Rum', unit: 'ml', qty: 500 },
    ])
    expect(d).toEqual([{ inventory_item_id: 'lime', name: 'Lime', unit: 'ml', delta: -40 }])
  })
  it('ingrediente nuovo → delta positivo pieno', () => {
    const d = consumptionDiff([], [{ inventory_item_id: 'gin', name: 'Gin', unit: 'ml', qty: 50 }])
    expect(d).toEqual([{ inventory_item_id: 'gin', name: 'Gin', unit: 'ml', delta: 50 }])
  })
  it('consumi identici → nessun delta', () => {
    expect(consumptionDiff(oldCons, oldCons)).toEqual([])
  })
})

describe('invoiceTotals', () => {
  const invoices = [
    { supplier_id: 'nova', supplier_name: 'NOVA', amount: 100, paid: false },
    { supplier_id: 'nova', supplier_name: 'NOVA', amount: 50, paid: false },
    { supplier_id: 'mar', supplier_name: 'MAR', amount: 30, paid: false },
    { supplier_id: 'nova', supplier_name: 'NOVA', amount: 999, paid: true },
  ]
  it('totale da pagare, pagato e ripartizione per fornitore', () => {
    const t = invoiceTotals(invoices)
    expect(t.unpaid).toBe(180)
    expect(t.paid).toBe(999)
    expect(t.bySupplier[0]).toMatchObject({ supplier_id: 'nova', unpaid: 150, count: 2 })
    expect(t.bySupplier[1]).toMatchObject({ supplier_id: 'mar', unpaid: 30 })
  })
})

describe('suggestedPackages (riordino GENERATORE ORDINI)', () => {
  it('sotto soglia: riporta a 2x la soglia in confezioni (minimo 1)', () => {
    // soglia 140 cl, in casa 60, conf. 70 cl -> servono 220 cl -> 4 conf.
    expect(
      suggestedPackages({ stock: 60, low_threshold: 140, package_size: 70, unit: 'cl' })
    ).toBe(4)
    // appena sotto soglia: almeno una confezione
    expect(
      suggestedPackages({ stock: 139, low_threshold: 140, package_size: 700, unit: 'cl' })
    ).toBe(1)
    // a pezzi: 1 conf. = 1 pz
    expect(suggestedPackages({ stock: 1, low_threshold: 4, unit: 'pz' })).toBe(7)
  })

  it('niente suggerimento sopra soglia o senza soglia/confezione', () => {
    expect(suggestedPackages({ stock: 500, low_threshold: 140, package_size: 70 })).toBe(0)
    expect(suggestedPackages({ stock: 10, low_threshold: 0, package_size: 70 })).toBe(0)
    expect(suggestedPackages({ stock: 10, low_threshold: 40, package_size: 0, unit: 'cl' })).toBe(0)
  })
})

describe('purchaseOrderText', () => {
  it('testo pronto per email/copia con righe e totali', () => {
    const txt = purchaseOrderText({
      supplier_name: 'NOVA',
      created_at: '2026-07-13T10:00:00.000Z',
      lines: [
        { qty_packages: 4, name: 'Rum bianco' },
        { qty_packages: 2, name: 'Tonica' },
      ],
      total_net: 100,
      total_gross: 122,
    })
    expect(txt).toContain('Fornitore: NOVA')
    expect(txt).toContain('- 4× Rum bianco')
    expect(txt).toContain('- 2× Tonica')
    expect(txt).toContain('Totale ivato: 122.00')
  })
})
