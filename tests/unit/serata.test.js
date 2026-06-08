'use strict'

// Unit test della logica pura serata (src/lib/serata.js).

import { describe, it, expect } from 'vitest'
import { bucketByStatus, serataRecap, openOrdersCount } from '../../src/lib/serata.js'

const orders = [
  { id: '1', status: 'ricevuto', total: 10 },
  { id: '2', status: 'ricevuto', total: 5 },
  { id: '3', status: 'in_preparazione', total: 8 },
  { id: '4', status: 'pronto', total: 12 },
  { id: '5', status: 'ritirato', total: 20 },
  { id: '6', status: 'annullato', total: 99 },
]

describe('bucketByStatus', () => {
  it('smista per stato ed esclude gli annullati', () => {
    const b = bucketByStatus(orders)
    expect(b.ricevuto.map((o) => o.id)).toEqual(['1', '2'])
    expect(b.in_preparazione.map((o) => o.id)).toEqual(['3'])
    expect(b.pronto.map((o) => o.id)).toEqual(['4'])
    expect(b.ritirato.map((o) => o.id)).toEqual(['5'])
    // l'annullato non compare in nessun bucket
    expect(Object.values(b).flat().some((o) => o.id === '6')).toBe(false)
  })
})

describe('serataRecap', () => {
  it('conta e somma i non annullati', () => {
    const r = serataRecap(orders)
    expect(r.count).toBe(5) // esclude l'annullato
    expect(r.total).toBe(10 + 5 + 8 + 12 + 20)
  })
  it('serata vuota', () => {
    expect(serataRecap([])).toEqual({ count: 0, total: 0 })
  })
})

describe('openOrdersCount', () => {
  it('conta gli ordini non ritirati né annullati', () => {
    expect(openOrdersCount(orders)).toBe(4) // 1,2,3,4
  })
})
