// @vitest-environment happy-dom
'use strict'

// Unit test dello store ordini POS in invio (src/lib/pendingOrders.js):
// invio in background (il chiamante non aspetta la rete).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/dom'

vi.mock('../../src/lib/api.js', () => ({
  createOrder: vi.fn(() =>
    Promise.resolve({ id: 'ord1', daily_number: 5, comande: [{ id: 'c1' }] })
  ),
}))
vi.mock('../../src/lib/printer.js', () => ({
  printComanda: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../src/lib/cart.js', () => ({
  rememberOrderId: vi.fn(),
}))

import { submitPosOrder, subscribePending } from '../../src/lib/pendingOrders.js'
import { createOrder } from '../../src/lib/api.js'
import { printComanda } from '../../src/lib/printer.js'

beforeEach(() => vi.clearAllMocks())

const ITEMS = [{ drink_id: 'mojito', name: 'Mojito', price: 7, qty: 2 }]

describe('submitPosOrder', () => {
  it('ritorna SUBITO con il placeholder completo; creazione in background', async () => {
    let stato = null
    const unsub = subscribePending((s) => (stato = s))
    submitPosOrder({ items: ITEMS, customer_name: 'Marco' })
    // sincrono: placeholder già presente con le info dell'ordine
    const p = stato.pending.at(-1)
    expect(p.state).toBe('sending')
    expect(p.order.customer_name).toBe('Marco')
    // IL PLACEHOLDER NASCE COME NASCERÀ L'ORDINE VERO. Qui c'era scritto
    // «in preparazione», ma era una terza copia a mano della regola: la
    // card in coda diceva «Al banco» e appena arrivava dal server saltava
    // in «Da fare» da sola. Adesso lo dice statoComandaNuova, che è l'unico
    // posto dove si decide, e di suo una comanda nasce «da fare».
    expect(p.order.workflow_status).toBe('ricevuto')
    expect(p.order.total).toBe(14)
    // in background: crea l'ordine (nessuna serata da risolvere)
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1))
    // l'ordine reale porta l'id del placeholder (scambio senza doppioni)
    expect(createOrder.mock.calls[0][0].client_temp_id).toBe(p.tempId)
    // a creazione avvenuta il placeholder resta ('done', con realId): lo
    // scambia la griglia quando l'ordine reale arriva dalla sottoscrizione
    await waitFor(() => expect(stato.pending.find((x) => x.tempId === p.tempId)?.state).toBe('done'))
    expect(stato.pending.find((x) => x.tempId === p.tempId).realId).toBe('ord1')
    // niente stampa automatica alla conferma
    expect(printComanda).not.toHaveBeenCalled()
    unsub()
  })

  it('printNow: stampa la comanda appena creata (esplicita)', async () => {
    submitPosOrder({ items: ITEMS, printNow: true })
    await waitFor(() => expect(printComanda).toHaveBeenCalledTimes(1))
  })
})
