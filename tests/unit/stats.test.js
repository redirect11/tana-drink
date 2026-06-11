'use strict'

// Unit test delle statistiche locale (src/lib/stats.js).

import { describe, it, expect } from 'vitest'
import {
  kpiSummary,
  revenueByHour,
  revenueBySerata,
  revenueBySerataInRange,
  topProducts,
  revenueByCategory,
  ingredientUsage,
  prepTimeStats,
  serviceModeSplit,
} from '../../src/lib/stats.js'

const orders = [
  {
    serata_id: 's1',
    daily_number: 1,
    status: 'ritirato',
    service_mode: 'tavolo',
    total: 20,
    created_at: '2026-06-05T20:15:00.000Z',
    status_times: {
      in_preparazione: '2026-06-05T20:17:00.000Z',
      pronto: '2026-06-05T20:21:00.000Z',
    },
    order_items: [
      { drink_id: 'd1', name: 'Negroni', qty: 2, unit_price: 8 },
      { drink_id: 'd2', name: 'Ceres', qty: 1, unit_price: 4 },
    ],
  },
  {
    serata_id: 's2',
    daily_number: 2,
    status: 'ritirato',
    service_mode: 'banco',
    total: 8,
    created_at: '2026-06-06T22:40:00.000Z',
    status_times: {
      in_preparazione: '2026-06-06T22:41:00.000Z',
      pronto: '2026-06-06T22:49:00.000Z',
    },
    order_items: [{ drink_id: 'd1', name: 'Negroni', qty: 1, unit_price: 8 }],
  },
  {
    serata_id: 's2',
    daily_number: 3,
    status: 'annullato',
    cancelled_by: 'cliente',
    total: 99,
    created_at: '2026-06-06T22:50:00.000Z',
    status_times: {},
    order_items: [{ drink_id: 'd2', name: 'Ceres', qty: 9, unit_price: 4 }],
  },
]

const serate = [
  { id: 's1', opened_at: '2026-06-05T19:00:00.000Z' },
  { id: 's2', opened_at: '2026-06-06T19:00:00.000Z' },
]

const drinksById = {
  d1: {
    category: 'AMERICANI',
    recipe_items: [
      { name: 'Gin', qty: 30, unit: 'ml' },
      { name: 'Campari', qty: 30, unit: 'ml' },
    ],
  },
  d2: { category: 'BIRRE', recipe_items: [{ name: 'Ceres', qty: 1, unit: 'pz' }] },
}

describe('kpiSummary', () => {
  it('calcola incasso, scontrino medio e percentuali escludendo gli annullati', () => {
    const k = kpiSummary(orders, serate)
    expect(k.incasso).toBe(28)
    expect(k.ordini).toBe(2)
    expect(k.scontrinoMedio).toBe(14)
    expect(k.drinkVenduti).toBe(4)
    expect(k.pctAnnullati).toBeCloseTo(33.33, 1)
    expect(k.pctNonRitirati).toBe(0)
  })
})

describe('revenueByHour', () => {
  it('fasce allineate al range di default (18:30) con vuote a zero', () => {
    const { buckets, peakLabel } = revenueByHour(orders)
    expect(buckets.reduce((s, b) => s + b.ordini, 0)).toBe(2)
    expect(buckets.reduce((s, b) => s + b.incasso, 0)).toBe(28)
    expect(peakLabel).toMatch(/^\d{2}:30$/)
    // range 18:30 → 03:30 = 9 fasce, sempre presenti (anche vuote)
    expect(buckets).toHaveLength(9)
    expect(buckets[0].label).toBe('18:30')
    for (const b of buckets) expect(b.label).toMatch(/^\d{2}:30$/)
  })

  it('range personalizzato, anche a cavallo della mezzanotte', () => {
    const { buckets } = revenueByHour(orders, { from: '23:00', to: '01:00' })
    expect(buckets.map((b) => b.label)).toEqual(['23:00', '00:00'])
    // l'ordine delle 22:40 UTC (00:40 locali) cade nella fascia 00:00
    expect(buckets[1].ordini).toBe(1)
    expect(buckets[1].incasso).toBe(8)
    expect(buckets[0].ordini).toBe(0)
  })
})

describe('revenueBySerataInRange', () => {
  it('conta per serata solo gli ordini nella fascia', () => {
    // 20:15Z = 22:15 locali → dentro 22:00-23:00; 22:40Z = 00:40 → fuori
    const t = revenueBySerataInRange(orders, serate, { from: '22:00', to: '23:00' })
    expect(t).toHaveLength(2)
    expect(t[0].incasso).toBe(20)
    expect(t[1].incasso).toBe(0)
  })
})

describe('revenueBySerata', () => {
  it('una voce per serata in ordine cronologico', () => {
    const t = revenueBySerata(orders, serate)
    expect(t).toHaveLength(2)
    expect(t[0].incasso).toBe(20)
    expect(t[1].incasso).toBe(8)
    expect(t[1].ordini).toBe(1) // l'annullato non conta
  })
})

describe('topProducts', () => {
  it('classifica per incasso e per quantità', () => {
    const { byRevenue, byQty } = topProducts(orders)
    expect(byRevenue[0].name).toBe('Negroni') // 24€
    expect(byQty[0].name).toBe('Negroni') // 3 pezzi
    expect(byRevenue.find((p) => p.name === 'Ceres').revenue).toBe(4)
  })
})

describe('revenueByCategory', () => {
  it('somma per categoria del drink', () => {
    const cats = revenueByCategory(orders, drinksById)
    expect(cats[0]).toMatchObject({ name: 'AMERICANI', revenue: 24 })
    expect(cats[1]).toMatchObject({ name: 'BIRRE', revenue: 4 })
  })
})

describe('ingredientUsage', () => {
  it('moltiplica le ricette per le quantità vendute', () => {
    const usage = ingredientUsage(orders, drinksById)
    const gin = usage.find((u) => u.name === 'Gin')
    expect(gin.qty).toBe(90) // 3 negroni × 30ml
    const ceres = usage.find((u) => u.name === 'Ceres')
    expect(ceres.qty).toBe(1) // l'annullato non conta
  })
})

describe('prepTimeStats', () => {
  it('medie e massimo dalla cronologia stati', () => {
    const s = prepTimeStats(orders)
    expect(s.attesaMedia).toBeCloseTo(1.5)
    expect(s.prepMedia).toBeCloseTo(6)
    expect(s.prepMax.daily_number).toBe(2)
    expect(s.campioni).toBe(2)
  })
})

describe('serviceModeSplit', () => {
  it('divide ordini e incasso tra tavolo e banco', () => {
    const s = serviceModeSplit(orders)
    expect(s.tavolo).toEqual({ ordini: 1, incasso: 20 })
    expect(s.banco).toEqual({ ordini: 1, incasso: 8 })
  })
})
