'use strict'

// Unit test della logica pura coda (src/lib/coda.js).

import { describe, it, expect } from 'vitest'
import { bucketByStatus, ordersRecap, openOrdersCount } from '../../src/lib/coda.js'

const orders = [
  { id: '1', status: 'ricevuto', total: 10 },
  { id: '2', status: 'ricevuto', total: 5 },
  { id: '3', status: 'in_preparazione', total: 8 },
  { id: '4', status: 'pronto', total: 12 },
  { id: '5', status: 'ritirato', total: 20 },
  { id: '6', status: 'annullato', total: 99 },
  { id: '7', status: 'pagato', total: 15 },
]

describe('bucketByStatus', () => {
  it('smista per stato ed esclude gli annullati', () => {
    const b = bucketByStatus(orders)
    expect(b.ricevuto.map((o) => o.id)).toEqual(['1', '2'])
    expect(b.in_preparazione.map((o) => o.id)).toEqual(['3'])
    expect(b.pronto.map((o) => o.id)).toEqual(['4'])
    expect(b.ritirato.map((o) => o.id)).toEqual(['5'])
    expect(b.pagato.map((o) => o.id)).toEqual(['7'])
    // l'annullato non compare in nessun bucket
    expect(Object.values(b).flat().some((o) => o.id === '6')).toBe(false)
  })
})

describe('ordersRecap', () => {
  it('conta e somma i non annullati', () => {
    const r = ordersRecap(orders)
    expect(r.count).toBe(6) // esclude l'annullato, include il pagato
    expect(r.total).toBe(10 + 5 + 8 + 12 + 20 + 15)
  })
  it('separa aperti e chiusi con il predicato', () => {
    const isClosed = (o) => o.payment_status === 'pagato'
    const r = ordersRecap(orders, isClosed)
    expect(r.aperti + r.chiusi).toBe(r.count)
    expect(r.chiusi).toBe(orders.filter((o) => o.status !== 'annullato' && o.payment_status === 'pagato').length)
  })
  it('coda vuota', () => {
    expect(ordersRecap([])).toEqual({ count: 0, total: 0, aperti: 0, chiusi: 0 })
  })
})

describe('openOrdersCount', () => {
  it('conta i CONTI aperti (non pagati né annullati)', () => {
    // Nel modello conto/comande anche un ordine "ritirato" resta un conto
    // aperto finché non viene incassato.
    expect(openOrdersCount(orders)).toBe(5) // 1,2,3,4,5
  })
})

// ── Chiusura del conto: pagato NON basta ───────────────────────────────
// Regola voluta dal locale: con la preparazione tracciata un conto esce
// dalla coda solo se è stato PAGATO **e** SERVITO. Pagare in anticipo è
// normale; farlo sparire vorrebbe dire dimenticarsi di consegnarlo.
import { allServed } from '../../src/lib/comande.js'

describe('un conto pagato ma non servito resta da fare', () => {
  const conto = (statoComanda, paymentStatus) => ({
    payment_status: paymentStatus,
    comande: [{ id: 'c1', status: statoComanda }],
  })
  const pagato = (o) => o.payment_status === 'pagato'
  const chiuso = (o, workflowOn) => (workflowOn ? pagato(o) && allServed(o) : pagato(o))

  it('con la preparazione attiva: pagato ma non servito NON è chiuso', () => {
    expect(chiuso(conto('in_preparazione', 'pagato'), true)).toBe(false)
    expect(chiuso(conto('pronto', 'pagato'), true)).toBe(false)
  })

  it('con la preparazione attiva: serve pagato E servito', () => {
    expect(chiuso(conto('ritirato', 'pagato'), true)).toBe(true)
    expect(chiuso(conto('ritirato', 'non_richiesto'), true)).toBe(false) // servito ma da incassare
  })

  it('senza preparazione: il pagamento chiude e basta', () => {
    expect(chiuso(conto('ricevuto', 'pagato'), false)).toBe(true)
  })
})
