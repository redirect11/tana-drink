'use strict'

// BDD — createSumUpSale (functions/lib/sumup-service.js → createSale)
// Feature: invio di un ordine a SumUp POS Pro come External Sale.

import { describe, it, expect, vi } from 'vitest'
import { createSale } from '../../functions/lib/sumup-service.js'
import { createFakeFirestore } from '../helpers/fakeFirestore.js'

function makeDeps({ configured = true, saleResponse = { id: 'sale-1' }, seed = {} } = {}) {
  const { db, store, calls } = createFakeFirestore(seed)
  const sumupFetch = vi.fn(async () => saleResponse)
  const deps = { db, sumupFetch, isConfigured: () => configured }
  return { deps, db, store, calls, sumupFetch }
}

const orderData = {
  orderId: 'order-1',
  tableLabel: '5',
  note: 'poco ghiaccio',
  items: [{ sumup_product_id: 'p1', name: 'Negroni', qty: 2, unit_price: 8.5 }],
}

describe('Feature: invio ordine a SumUp', () => {
  it('TC-SALE-001: Dato SumUp non configurato, Quando invio la vendita, Allora è no-op', async () => {
    const { deps, sumupFetch } = makeDeps({ configured: false })

    const res = await createSale(deps, orderData)

    expect(res).toEqual({ skipped: true })
    expect(sumupFetch).not.toHaveBeenCalled()
  })

  it('TC-SALE-002: Dato un ordine, Quando invio, Allora POST /external_sales con il payload corretto', async () => {
    const { deps, sumupFetch } = makeDeps({ seed: { orders: { 'order-1': { status: 'ricevuto' } } } })

    const res = await createSale(deps, orderData)

    expect(res).toEqual({ saleId: 'sale-1' })
    expect(sumupFetch).toHaveBeenCalledTimes(1)
    const [path, options] = sumupFetch.mock.calls[0]
    expect(path).toBe('/external_sales')
    expect(options.method).toBe('POST')
    const payload = JSON.parse(options.body)
    expect(payload.customer_name).toBe('Tavolo 5')
    expect(payload.sale_items[0].total_price).toBe(17)
  })

  it('TC-SALE-003: Data una vendita con id, Quando invio, Allora persisto sumup_sale_id sull\'ordine', async () => {
    const { deps, store } = makeDeps({ seed: { orders: { 'order-1': { status: 'ricevuto' } } } })

    await createSale(deps, orderData)

    expect(store.orders['order-1'].sumup_sale_id).toBe('sale-1')
  })

  it('Data una vendita senza id, Quando invio, Allora non scrivo sumup_sale_id', async () => {
    const { deps, store, calls } = makeDeps({
      saleResponse: {},
      seed: { orders: { 'order-1': { status: 'ricevuto' } } },
    })

    const res = await createSale(deps, orderData)

    expect(res).toEqual({ saleId: null })
    expect(calls.updates).toHaveLength(0)
    expect(store.orders['order-1'].sumup_sale_id).toBeUndefined()
  })
})
