'use strict'

// Unit test della logica pura tempi/statistiche (src/lib/eta.js).

import { describe, it, expect } from 'vitest'
import {
  ETA_PRIOR_WEIGHT,
  PREP_BASE_FRACTION,
  etaFullMinutes,
  etaPrepMinutes,
  etaForMode,
  avgPrepPerOrderMinutes,
  queueEtaMinutes,
  phaseAverages,
  aggregateProducts,
  ordersFinance,
  longestPrep,
} from '../../src/lib/eta.js'

describe('etaFullMinutes', () => {
  it('senza dati restituisce il tempo base', () => {
    expect(etaFullMinutes(null, 10)).toBe(10)
    expect(etaFullMinutes({ count: 0, total_ms: 0 }, 12)).toBe(12)
  })

  it('raffina progressivamente verso la media misurata', () => {
    // base 10 min, 1 ordine completato in 20 min
    // (10·3 + 20) / (3 + 1) = 12.5 → 13
    expect(etaFullMinutes({ count: 1, total_ms: 20 * 60000 }, 10)).toBe(13)
  })

  it('con molti ordini la media misurata domina', () => {
    // 100 ordini da 20 min, base 10: (30 + 2000) / 103 ≈ 19.7 → 20
    expect(etaFullMinutes({ count: 100, total_ms: 100 * 20 * 60000 }, 10)).toBe(20)
  })
})

describe('etaPrepMinutes', () => {
  it('senza dati usa la quota del base per attesa+preparazione', () => {
    expect(etaPrepMinutes(null, 10)).toBe(Math.round(10 * PREP_BASE_FRACTION))
  })

  it('blend con i tempi misurati', () => {
    // base parziale 8, 1 ordine pronto in 4 min: (8·3 + 4) / 4 = 7
    expect(etaPrepMinutes({ count: 1, total_ms: 4 * 60000 }, 10)).toBe(7)
  })
})

describe('etaForMode', () => {
  const ctx = {
    etaStats: { count: 1, total_ms: 20 * 60000 },
    prepStats: { count: 1, total_ms: 4 * 60000 },
    baseMinutes: 10,
  }

  it('tavolo usa il ciclo completo, banco solo attesa+preparazione', () => {
    expect(etaForMode('tavolo', ctx)).toBe(13)
    expect(etaForMode('banco', ctx)).toBe(7)
  })
})

describe('queueEtaMinutes', () => {
  // 4 ordini pronti, 5 min di preparazione l'uno → media misurata domina poco
  const prepStats = { count: 4, prep_ms: 4 * 5 * 60000, total_ms: 4 * 8 * 60000 }
  const base = 10 // prior preparazione = 5 min

  it('zero quando pronto o ritirato', () => {
    expect(queueEtaMinutes({ status: 'pronto', position: 3, prepStats, baseMinutes: base, mode: 'banco' })).toBe(0)
    expect(queueEtaMinutes({ status: 'ritirato', position: 0, prepStats, baseMinutes: base, mode: 'banco' })).toBe(0)
  })

  it('in coda: ogni ordine davanti aggiunge un tempo di preparazione', () => {
    const prepAvg = avgPrepPerOrderMinutes(prepStats, base) // = 5
    const senzaCoda = queueEtaMinutes({ status: 'ricevuto', position: 0, prepStats, baseMinutes: base, mode: 'banco' })
    const conCoda = queueEtaMinutes({ status: 'ricevuto', position: 2, prepStats, baseMinutes: base, mode: 'banco' })
    expect(senzaCoda).toBe(Math.round(prepAvg))
    expect(conCoda).toBe(Math.round(3 * prepAvg))
  })

  it('in preparazione: resta circa metà preparazione', () => {
    expect(
      queueEtaMinutes({ status: 'in_preparazione', position: 0, prepStats, baseMinutes: base, mode: 'banco' })
    ).toBe(3) // 5 * 0.5 = 2.5 → round 3
  })

  it('al tavolo aggiunge il tempo di consegna', () => {
    const banco = queueEtaMinutes({ status: 'ricevuto', position: 1, prepStats, baseMinutes: base, mode: 'banco' })
    const tavolo = queueEtaMinutes({ status: 'ricevuto', position: 1, prepStats, etaStats: null, baseMinutes: base, mode: 'tavolo' })
    expect(tavolo).toBeGreaterThan(banco)
  })
})

describe('phaseAverages', () => {
  it('calcola medie in minuti dai due gruppi di statistiche', () => {
    const prep = { count: 2, attesa_ms: 4 * 60000, prep_ms: 10 * 60000 }
    const eta = { count: 1, ritiro_ms: 3 * 60000, total_ms: 18 * 60000 }
    const a = phaseAverages(prep, eta)
    expect(a.attesa).toBe(2)
    expect(a.preparazione).toBe(5)
    expect(a.servizio).toBe(3)
    expect(a.cicloCompleto).toBe(18)
  })

  it('restituisce null senza campioni', () => {
    const a = phaseAverages(null, null)
    expect(a.attesa).toBeNull()
    expect(a.cicloCompleto).toBeNull()
  })
})

const orders = [
  {
    daily_number: 1,
    status: 'ritirato',
    total: 21.5,
    coperto_amount: 6,
    service_charge_amount: 0,
    tip_amount: 1.5,
    order_items: [
      { name: 'Hugo', qty: 2, unit_price: 7 },
    ],
    status_times: {
      in_preparazione: '2026-06-10T20:00:00.000Z',
      pronto: '2026-06-10T20:08:00.000Z',
    },
  },
  {
    daily_number: 2,
    status: 'ritirato',
    total: 10,
    coperto_amount: 0,
    service_charge_amount: 1,
    tip_amount: 0,
    order_items: [
      { name: 'Spritz Aperol', qty: 1, unit_price: 6 },
      { name: 'Hugo', qty: 1, unit_price: 7 },
    ],
    status_times: {
      in_preparazione: '2026-06-10T20:10:00.000Z',
      pronto: '2026-06-10T20:13:00.000Z',
    },
  },
  {
    daily_number: 3,
    status: 'annullato',
    total: 99,
    tip_amount: 50,
    order_items: [{ name: 'Negroni', qty: 9, unit_price: 11 }],
    status_times: {},
  },
]

describe('aggregateProducts', () => {
  it('aggrega quantità e ricavi per prodotto, esclusi gli annullati', () => {
    const p = aggregateProducts(orders)
    expect(p).toEqual([
      { name: 'Hugo', qty: 3, revenue: 21 },
      { name: 'Spritz Aperol', qty: 1, revenue: 6 },
    ])
  })
})

describe('ordersFinance', () => {
  it('somma incasso e voci, esclusi gli annullati', () => {
    const f = ordersFinance(orders)
    expect(f.ordini).toBe(2)
    expect(f.incasso).toBe(31.5)
    expect(f.coperto).toBe(6)
    expect(f.servizio).toBe(1)
    expect(f.mance).toBe(1.5)
    expect(f.drink).toBe(23)
  })
})

describe('longestPrep', () => {
  it('trova la preparazione più lunga', () => {
    const l = longestPrep(orders)
    expect(l.daily_number).toBe(1)
    expect(l.minutes).toBe(8)
  })

  it('null senza dati', () => {
    expect(longestPrep([{ status: 'ricevuto', status_times: {} }])).toBeNull()
  })
})

describe('costanti', () => {
  it('prior e frazione sono ragionevoli', () => {
    expect(ETA_PRIOR_WEIGHT).toBeGreaterThan(0)
    expect(PREP_BASE_FRACTION).toBeGreaterThan(0)
    expect(PREP_BASE_FRACTION).toBeLessThanOrEqual(1)
  })
})
