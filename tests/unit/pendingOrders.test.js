// @vitest-environment happy-dom
'use strict'

// Unit test dello store ordini POS in invio (src/lib/pendingOrders.js):
// invio in background con serata risolta LÌ (il chiamante non aspetta rete).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/dom'

vi.mock('../../src/lib/api.js', () => ({
  createOrder: vi.fn(() =>
    Promise.resolve({ id: 'ord1', daily_number: 5, comande: [{ id: 'c1' }] })
  ),
  ensureTodaySerata: vi.fn(() => Promise.resolve({ id: 'serata-oggi' })),
}))
vi.mock('../../src/lib/printer.js', () => ({
  printComanda: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../src/lib/cart.js', () => ({
  rememberOrderId: vi.fn(),
}))

import { submitPosOrder, subscribePending } from '../../src/lib/pendingOrders.js'
import { createOrder, ensureTodaySerata } from '../../src/lib/api.js'
import { printComanda } from '../../src/lib/printer.js'

beforeEach(() => vi.clearAllMocks())

const ITEMS = [{ drink_id: 'mojito', name: 'Mojito', price: 7, qty: 2 }]

describe('submitPosOrder', () => {
  it('ritorna SUBITO con il placeholder completo; serata e creazione in background', async () => {
    let stato = null
    const unsub = subscribePending((s) => (stato = s))
    submitPosOrder({ serata_id: null, items: ITEMS, customer_name: 'Marco' })
    // sincrono: placeholder già presente con le info dell'ordine
    const p = stato.pending.at(-1)
    expect(p.state).toBe('sending')
    expect(p.order.customer_name).toBe('Marco')
    expect(p.order.workflow_status).toBe('in_preparazione')
    expect(p.order.total).toBe(14)
    // in background: risolve la serata di oggi e crea l'ordine con quella
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1))
    expect(ensureTodaySerata).toHaveBeenCalledTimes(1)
    expect(createOrder.mock.calls[0][0].serata_id).toBe('serata-oggi')
    // niente stampa automatica alla conferma
    await waitFor(() => expect(stato.pending.every((x) => x.tempId !== p.tempId)).toBe(true))
    expect(printComanda).not.toHaveBeenCalled()
    unsub()
  })

  it('con serata già nota non la risolve di nuovo', async () => {
    submitPosOrder({ serata_id: 's1', items: ITEMS })
    await waitFor(() => expect(createOrder).toHaveBeenCalled())
    expect(ensureTodaySerata).not.toHaveBeenCalled()
    expect(createOrder.mock.calls[0][0].serata_id).toBe('s1')
  })

  it('printNow: stampa la comanda appena creata (esplicita)', async () => {
    submitPosOrder({ serata_id: 's1', items: ITEMS, printNow: true })
    await waitFor(() => expect(printComanda).toHaveBeenCalledTimes(1))
  })
})
