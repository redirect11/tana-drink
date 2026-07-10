'use strict'

// Unit test del modello Ordine (conto) / Comande (ticket) — src/lib/comande.js

import { describe, it, expect } from 'vitest'
import {
  ORDER_OPEN,
  nextComandaStatus,
  activeComanda,
  comandeSummary,
  allServed,
  aggregateItems,
  itemsTotal,
  comandeStatuses,
  normalizeOrderDoc,
} from '../../src/lib/comande.js'

const c = (seq, status, items = []) => ({ id: `c${seq}`, seq, status, items })

describe('nextComandaStatus', () => {
  it('flusso ricevuto→in_preparazione→pronto→ritirato→null', () => {
    expect(nextComandaStatus('ricevuto')).toBe('in_preparazione')
    expect(nextComandaStatus('in_preparazione')).toBe('pronto')
    expect(nextComandaStatus('pronto')).toBe('ritirato')
    expect(nextComandaStatus('ritirato')).toBeNull()
    expect(nextComandaStatus('annullato')).toBeNull()
  })
})

describe('activeComanda / comandeSummary / allServed', () => {
  const order = {
    status: ORDER_OPEN,
    comande: [c(1, 'ritirato'), c(2, 'pronto'), c(3, 'ricevuto'), c(4, 'annullato')],
  }
  it('attiva = la più vecchia non chiusa', () => {
    expect(activeComanda(order).seq).toBe(2)
  })
  it('summary conta attive/pronte/servite (esclude annullate)', () => {
    expect(comandeSummary(order)).toEqual({ attive: 2, pronte: 1, servite: 1, totale: 3 })
  })
  it('allServed solo quando tutte ritirate (annullate ignorate)', () => {
    expect(allServed(order)).toBe(false)
    expect(allServed({ comande: [c(1, 'ritirato'), c(2, 'annullato')] })).toBe(true)
    expect(allServed({ comande: [c(1, 'annullato')] })).toBe(false)
  })
})

describe('aggregateItems / itemsTotal', () => {
  it('somma lo stesso drink su comande diverse, custom separati, annullate escluse', () => {
    const comande = [
      c(1, 'ritirato', [
        { drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 },
        { drink_id: 'custom-1', custom: true, name: 'Special', unit_price: 9, qty: 1 },
      ]),
      c(2, 'ricevuto', [
        { drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 1 },
        { drink_id: 'custom-2', custom: true, name: 'Special', unit_price: 9, qty: 1 },
      ]),
      c(3, 'annullato', [{ drink_id: 'gin', name: 'Gin', unit_price: 8, qty: 5 }]),
    ]
    const agg = aggregateItems(comande)
    expect(agg.find((i) => i.drink_id === 'mojito').qty).toBe(3)
    expect(agg.filter((i) => i.custom)).toHaveLength(2)
    expect(agg.find((i) => i.drink_id === 'gin')).toBeUndefined()
    expect(itemsTotal(agg)).toBe(3 * 7 + 9 + 9)
  })
})

describe('comandeStatuses', () => {
  it('stati unici presenti', () => {
    expect(comandeStatuses([c(1, 'ritirato'), c(2, 'ricevuto'), c(3, 'ricevuto')]).sort()).toEqual([
      'ricevuto',
      'ritirato',
    ])
  })
})

describe('normalizeOrderDoc (retrocompatibilità)', () => {
  it('doc nuovo modello: passa attraverso', () => {
    const n = normalizeOrderDoc({ status: ORDER_OPEN, comande: [c(1, 'pronto')] })
    expect(n.status).toBe(ORDER_OPEN)
    expect(n.comande).toHaveLength(1)
  })
  it('legacy in lavorazione → ordine aperto + comanda sintetica con lo stato', () => {
    const n = normalizeOrderDoc({
      status: 'in_preparazione',
      items: [{ drink_id: 'x', qty: 1 }],
      status_times: { in_preparazione: 't1' },
      inventory_applied: true,
      inventory_consumption: [{ inventory_item_id: 'rum', qty: 40 }],
    })
    expect(n.status).toBe(ORDER_OPEN)
    expect(n.comande[0]).toMatchObject({
      seq: 1,
      status: 'in_preparazione',
      inventory_applied: true,
    })
    expect(n.comande[0].items).toHaveLength(1)
  })
  it('legacy pagato → ordine pagato, comanda ritirata; annullato → annullato', () => {
    expect(normalizeOrderDoc({ status: 'pagato', items: [] }).status).toBe('pagato')
    expect(normalizeOrderDoc({ status: 'pagato', items: [] }).comande[0].status).toBe('ritirato')
    expect(normalizeOrderDoc({ status: 'annullato', items: [] }).comande[0].status).toBe('annullato')
  })
})
