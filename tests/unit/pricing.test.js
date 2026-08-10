'use strict'

// Unit test del prezzo consigliato (src/lib/pricing.js): costo ingredienti
// dal listino di magazzino e ricarico del bartender.

import { describe, it, expect } from 'vitest'
import {
  recipeCost,
  suggestedPrice,
  roundPrice,
  markupOf,
  marginOf,
  marginReport,
  DEFAULT_MARKUP,
} from '../../src/lib/pricing.js'

// Bottiglia da 100 cl (1000 ml) a 14,80 € + IVA 22% = 18,056 € →
// 0,18056 €/cl, come nel foglio INV.
const gin = { id: 'gin', name: 'Gin', unit: 'ml', package_size: 1000, cost: 14.8, vat: 22 }
// Tonica da 20 cl a 1,02916 € netti.
const tonica = { id: 'ton', name: 'Tonica', unit: 'ml', package_size: 200, cost: 1.02916, vat: 22 }
// Articolo a pezzi (lime) e uno SENZA costo.
const lime = { id: 'lime', name: 'Lime', unit: 'pz', cost: 0.4, vat: 4 }
const senzaCosto = { id: 'x', name: 'Sciroppo', unit: 'ml', package_size: 700 }

const itemsById = { gin, ton: tonica, lime, x: senzaCosto }

describe('recipeCost', () => {
  it('somma qty × costo unitario (gin 4cl + tonica 20cl + 1 lime)', () => {
    const { cost, missing } = recipeCost(
      [
        { inventory_item_id: 'gin', unit: 'cl', qty: 4 },
        { inventory_item_id: 'ton', unit: 'cl', qty: 20 },
        { inventory_item_id: 'lime', unit: 'pz', qty: 1 },
      ],
      itemsById
    )
    // 4 × 0,18056 + 20 × 0,0627787… + 1 × 0,416
    expect(cost).toBeCloseTo(0.72224 + 1.2555752 + 0.416, 3)
    expect(missing).toEqual([])
  })

  it('segnala gli ingredienti SENZA costo: il totale è parziale', () => {
    const { cost, missing } = recipeCost(
      [
        { inventory_item_id: 'gin', unit: 'cl', qty: 4 },
        { inventory_item_id: 'x', name: 'Sciroppo', unit: 'ml', qty: 10 },
        { inventory_item_id: 'boh', name: 'Ignoto', unit: 'cl', qty: 2 },
      ],
      itemsById
    )
    expect(cost).toBeCloseTo(0.72224, 4)
    expect(missing).toEqual(['Sciroppo', 'Ignoto'])
  })

  it('quantità a zero o lista vuota → costo zero, nessun mancante', () => {
    expect(recipeCost([], itemsById)).toEqual({ cost: 0, missing: [] })
    expect(recipeCost([{ inventory_item_id: 'gin', unit: 'cl', qty: 0 }], itemsById)).toEqual({
      cost: 0,
      missing: [],
    })
  })
})

describe('roundPrice / suggestedPrice', () => {
  it('arrotonda per eccesso al passo di 0,50', () => {
    expect(roundPrice(6.01)).toBe(6.5)
    expect(roundPrice(6.5)).toBe(6.5)
    expect(roundPrice(6.51)).toBe(7)
    expect(roundPrice(0)).toBeNull()
  })

  it('prezzo consigliato = costo × ricarico (default ×3)', () => {
    expect(DEFAULT_MARKUP).toBe(3)
    // costo 2,39 → 7,17 → arrotondato 7,50
    expect(suggestedPrice(2.39)).toBe(7.5)
    expect(suggestedPrice(2.39, { markup: 4 })).toBe(10)
    expect(suggestedPrice(2.39, { markup: 3, step: 1 })).toBe(8)
  })

  it('senza costo non si inventa un prezzo', () => {
    expect(suggestedPrice(0)).toBeNull()
    expect(suggestedPrice(null)).toBeNull()
    expect(suggestedPrice(2, { markup: 0 })).toBeNull()
  })
})

describe('markupOf / marginOf', () => {
  it('dice dove ci si sta posizionando davvero', () => {
    expect(markupOf(7.5, 2.5)).toBe(3)
    expect(markupOf(7, 2.5)).toBe(2.8)
    expect(marginOf(7.5, 2.5)).toBe(5)
  })
  it('senza costo non si può dire il ricarico (ma il margine sì)', () => {
    expect(markupOf(7.5, 0)).toBeNull()
    expect(marginOf(7.5, 0)).toBe(7.5)
  })
})

describe('marginReport (lista marginalità)', () => {
  const itemsById = { gin, ton: tonica, x: senzaCosto }
  const drinks = [
    // 4cl gin + 20cl tonica = 1,978 € → a 4 € è ×2,02 (sotto il ×3)
    { id: 'gt', name: 'Gin Tonic', price: 4, recipe_items: [
      { inventory_item_id: 'gin', unit: 'cl', qty: 4 },
      { inventory_item_id: 'ton', unit: 'cl', qty: 20 },
    ] },
    // stesso costo venduto a 8 € → ×4,04, in linea
    { id: 'gt2', name: 'Gin Tonic Premium', price: 8, recipe_items: [
      { inventory_item_id: 'gin', unit: 'cl', qty: 4 },
      { inventory_item_id: 'ton', unit: 'cl', qty: 20 },
    ] },
    // ingrediente senza costo → parziale, non è un giudizio
    { id: 'p', name: 'Parziale', price: 6, recipe_items: [
      { inventory_item_id: 'gin', unit: 'cl', qty: 4 },
      { inventory_item_id: 'x', name: 'Sciroppo', unit: 'ml', qty: 10 },
    ] },
    // senza ricetta: fuori dal report
    { id: 'n', name: 'Senza ricetta', price: 5, recipe_items: [] },
  ]

  it('classifica e mette in cima i drink sotto il ricarico obiettivo', () => {
    const r = marginReport(drinks, itemsById)
    expect(r.totali).toBe(3) // "Senza ricetta" escluso
    expect(r.righe[0].name).toBe('Gin Tonic')
    expect(r.righe[0].stato).toBe('sotto')
    expect(r.righe[0].markup).toBeLessThan(3)
    expect(r.sotto).toBe(1)
    expect(r.ok).toBe(1)
    expect(r.parziali).toBe(1)
  })

  it('propone il prezzo che riporterebbe in linea', () => {
    const gt = marginReport(drinks, itemsById).righe.find((x) => x.id === 'gt')
    expect(gt.suggested).toBe(6) // 1,978 × 3 = 5,93 → 6,00
    expect(gt.margin).toBeCloseTo(4 - 1.978, 2)
  })

  it('un obiettivo più alto sposta la soglia', () => {
    const r = marginReport(drinks, itemsById, { markup: 5 })
    expect(r.sotto).toBe(2) // anche il Premium (×4,04) va sotto il ×5
  })
})
