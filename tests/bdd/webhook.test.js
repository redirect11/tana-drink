'use strict'

// BDD — sumupWebhook (functions/lib/sumup-service.js → handleWebhook)
// Feature: webhook in entrata da SumUp POS Pro che aggiorna lo stato dell'ordine.

import { describe, it, expect } from 'vitest'
import { handleWebhook } from '../../functions/lib/sumup-service.js'
import { createFakeFirestore } from '../helpers/fakeFirestore.js'

function makeDeps(seed = {}) {
  const { db, store, calls } = createFakeFirestore(seed)
  return { deps: { db }, db, store, calls }
}

const seededOrder = {
  orders: {
    'order-1': { status: 'ricevuto', sumup_sale_id: 'sale-1' },
  },
}

describe('Feature: webhook SumUp', () => {
  it('TC-HOOK-001: Dato un metodo non POST, Allora risponde 405', async () => {
    const { deps, calls } = makeDeps()

    const res = await handleWebhook(deps, { method: 'GET', body: {} })

    expect(res).toEqual({ status: 405, body: 'Method Not Allowed' })
    expect(calls.updates).toHaveLength(0)
  })

  it('TC-HOOK-002: Dato un POST senza sale_id, Allora risponde 400', async () => {
    const { deps } = makeDeps()

    const res = await handleWebhook(deps, { method: 'POST', body: { status: 'ACCEPTED' } })

    expect(res).toEqual({ status: 400, body: 'Missing sale_id' })
  })

  it('TC-HOOK-003: Dato uno stato non mappato, Allora 200 OK senza modifiche', async () => {
    const { deps, store, calls } = makeDeps(seededOrder)

    const res = await handleWebhook(deps, { method: 'POST', body: { sale_id: 'sale-1', status: 'CREATED' } })

    expect(res).toEqual({ status: 200, body: 'OK' })
    expect(calls.updates).toHaveLength(0)
    expect(store.orders['order-1'].status).toBe('ricevuto')
  })

  it('TC-HOOK-004: Dato uno stato mappato e ordine corrispondente, Allora aggiorna lo status', async () => {
    const { deps, store } = makeDeps(seededOrder)

    const res = await handleWebhook(deps, { method: 'POST', body: { sale_id: 'sale-1', status: 'ACCEPTED' } })

    expect(res).toEqual({ status: 200, body: 'OK' })
    expect(store.orders['order-1'].status).toBe('in_preparazione')
  })

  it('TC-HOOK-004b: COMPLETED e CANCELLED mappano entrambi su "ritirato"', async () => {
    const a = makeDeps(seededOrder)
    await handleWebhook(a.deps, { method: 'POST', body: { sale_id: 'sale-1', status: 'COMPLETED' } })
    expect(a.store.orders['order-1'].status).toBe('ritirato')

    const b = makeDeps(seededOrder)
    await handleWebhook(b.deps, { method: 'POST', body: { sale_id: 'sale-1', status: 'CANCELLED' } })
    expect(b.store.orders['order-1'].status).toBe('ritirato')
  })

  it('TC-HOOK-005: Dato nessun ordine corrispondente, Allora 200 OK senza errori', async () => {
    const { deps, calls } = makeDeps(seededOrder)

    const res = await handleWebhook(deps, { method: 'POST', body: { sale_id: 'sale-ignota', status: 'ACCEPTED' } })

    expect(res).toEqual({ status: 200, body: 'OK' })
    expect(calls.updates).toHaveLength(0)
  })
})
