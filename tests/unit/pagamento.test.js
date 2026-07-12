'use strict'

// Unit test della logica pura del pagamento del conto (split, sconto,
// residuo) — src/lib/pagamento.js

import { describe, it, expect } from 'vitest'
import {
  discountAmount,
  paidAmount,
  orderDue,
  isFullyPaid,
  remainingItems,
  selectionAmount,
  paymentCloses,
  summaryMethod,
} from '../../src/lib/pagamento.js'

const order = (over = {}) => ({
  total: 22,
  discount_amount: 0,
  payments: [],
  comande: [
    {
      id: 'c1',
      seq: 1,
      status: 'ritirato',
      items: [
        { drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 },
        { drink_id: 'gin', name: 'Gin Tonic', unit_price: 8, qty: 1 },
      ],
    },
  ],
  ...over,
})

describe('discountAmount', () => {
  it('percentuale e importo fisso, arrotondati ai centesimi', () => {
    expect(discountAmount(22, { type: 'percent', value: 10 })).toBe(2.2)
    expect(discountAmount(22, { type: 'euro', value: 5 })).toBe(5)
    expect(discountAmount(9.99, { type: 'percent', value: 33 })).toBe(3.3)
  })
  it('clamp: mai oltre il totale né oltre il 100%', () => {
    expect(discountAmount(22, { type: 'euro', value: 50 })).toBe(22)
    expect(discountAmount(22, { type: 'percent', value: 150 })).toBe(22)
  })
  it('zero senza sconto o con valori non validi', () => {
    expect(discountAmount(22, null)).toBe(0)
    expect(discountAmount(22, { type: 'percent', value: 0 })).toBe(0)
    expect(discountAmount(0, { type: 'percent', value: 10 })).toBe(0)
  })
})

describe('orderDue / paidAmount / isFullyPaid / paymentCloses', () => {
  it('residuo = totale − sconto − pagato', () => {
    const o = order({
      discount_amount: 2,
      payments: [{ id: 'p1', amount: 10, method: 'banco' }],
    })
    expect(paidAmount(o)).toBe(10)
    expect(orderDue(o)).toBe(10)
    expect(isFullyPaid(o)).toBe(false)
    expect(paymentCloses(o, 10)).toBe(true)
    expect(paymentCloses(o, 9.5)).toBe(false)
  })
  it('mai negativo e tollerante al mezzo centesimo', () => {
    const o = order({ payments: [{ id: 'p1', amount: 22.004, method: 'banco' }] })
    expect(orderDue(o)).toBe(0)
    expect(isFullyPaid(o)).toBe(true)
  })
})

describe('remainingItems: aggregato meno quantità già pagate', () => {
  it('scala le quantità pagate per drink_id', () => {
    const o = order({
      payments: [
        {
          id: 'p1',
          amount: 7,
          method: 'banco',
          items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 1 }],
        },
      ],
    })
    const rem = remainingItems(o)
    expect(rem.find((i) => i.drink_id === 'mojito').qty).toBe(1)
    expect(rem.find((i) => i.drink_id === 'gin').qty).toBe(1)
  })
  it('un pagamento senza items non tocca la lista articoli', () => {
    const o = order({ payments: [{ id: 'p1', amount: 5, method: 'banco', items: null }] })
    expect(remainingItems(o).find((i) => i.drink_id === 'mojito').qty).toBe(2)
  })
})

describe('selectionAmount: split con sconto ripartito', () => {
  it('selezione vuota = tutto il residuo', () => {
    expect(selectionAmount(order(), [])).toBe(22)
  })
  it('selezione parziale ai prezzi di listino (senza sconto)', () => {
    const amount = selectionAmount(order(), [
      { drink_id: 'mojito', unit_price: 7, qty: 1 },
    ])
    expect(amount).toBe(7)
  })
  it('lo sconto si ripartisce in proporzione sulla selezione', () => {
    const o = order({ discount_amount: 2.2 }) // 10% su 22
    const amount = selectionAmount(o, [{ drink_id: 'gin', unit_price: 8, qty: 1 }])
    expect(amount).toBe(7.2) // 8 − 10%
  })
  it('selezione che copre tutto il residuo → residuo esatto (niente derive)', () => {
    const o = order({ discount_amount: 2.2 })
    const amount = selectionAmount(o, [
      { drink_id: 'mojito', unit_price: 7, qty: 2 },
      { drink_id: 'gin', unit_price: 8, qty: 1 },
    ])
    expect(amount).toBe(orderDue(o))
  })
  it('include coperto/servizio quando la selezione copre tutti gli articoli', () => {
    // totale 25 = 22 articoli + 3 coperto: pagando tutti gli articoli si
    // incassa il residuo intero, coperto compreso.
    const o = order({ total: 25 })
    const amount = selectionAmount(o, [
      { drink_id: 'mojito', unit_price: 7, qty: 2 },
      { drink_id: 'gin', unit_price: 8, qty: 1 },
    ])
    expect(amount).toBe(25)
  })
})

describe('summaryMethod', () => {
  it('unico metodo → quello; metodi diversi → misto', () => {
    expect(summaryMethod([{ method: 'banco' }])).toBe('banco')
    expect(summaryMethod([{ method: 'banco' }, { method: 'lettore' }])).toBe('misto')
    expect(summaryMethod([])).toBeNull()
  })
})
