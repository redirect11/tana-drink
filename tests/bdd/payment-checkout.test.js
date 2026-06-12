'use strict'

// BDD — checkout online SumUp (functions/lib/payment-service.js).

import { describe, it, expect, vi } from 'vitest'
import {
  createCheckout,
  verifyCheckoutStatus,
  handleOnlineWebhook,
} from '../../functions/lib/payment-service.js'
import { createFakeFirestore } from '../helpers/fakeFirestore.js'

const NOW = '2026-06-12T22:00:00.000Z'

function makeDeps({ configured = true, seed = {}, responses = {} } = {}) {
  const { db, store } = createFakeFirestore(seed)
  // responses: { 'GET /v0.1/checkouts/ck1': {...}, 'POST /v0.1/checkouts': {...} }
  const paymentsFetch = vi.fn(async (path, options = {}) => {
    const key = `${options.method || 'GET'} ${path}`
    if (key in responses) return responses[key]
    throw new Error(`risposta non mockata: ${key}`)
  })
  return {
    deps: {
      db,
      paymentsFetch,
      isConfigured: () => configured,
      merchantCode: () => 'MC123',
      now: () => NOW,
    },
    store,
    paymentsFetch,
  }
}

const baseOrder = {
  status: 'ricevuto',
  total: 12.5,
  daily_number: 7,
  payment_method: 'online',
  payment_status: 'in_attesa',
}

describe('Feature: creazione checkout online', () => {
  it('non configurato → unavailable', async () => {
    const { deps } = makeDeps({ configured: false })
    expect(await createCheckout(deps, { orderId: 'o1' })).toEqual({ unavailable: true })
  })

  it('ordine inesistente → not-found', async () => {
    const { deps } = makeDeps()
    await expect(createCheckout(deps, { orderId: 'manca' })).rejects.toMatchObject({
      code: 'not-found',
    })
  })

  it('ordine annullato → failed-precondition', async () => {
    const { deps } = makeDeps({ seed: { orders: { o1: { ...baseOrder, status: 'annullato' } } } })
    await expect(createCheckout(deps, { orderId: 'o1' })).rejects.toMatchObject({
      code: 'failed-precondition',
    })
  })

  it('già pagato → alreadyPaid senza chiamate SumUp', async () => {
    const { deps, paymentsFetch } = makeDeps({
      seed: { orders: { o1: { ...baseOrder, payment_status: 'pagato' } } },
    })
    expect(await createCheckout(deps, { orderId: 'o1' })).toEqual({ alreadyPaid: true })
    expect(paymentsFetch).not.toHaveBeenCalled()
  })

  it('crea il checkout e salva id/metodo sull\'ordine', async () => {
    const { deps, store, paymentsFetch } = makeDeps({
      seed: { orders: { o1: { ...baseOrder, payment_method: null, payment_status: 'non_richiesto' } } },
      responses: { 'POST /v0.1/checkouts': { id: 'ck1' } },
    })
    expect(await createCheckout(deps, { orderId: 'o1' })).toEqual({ checkoutId: 'ck1' })
    const [, options] = paymentsFetch.mock.calls[0]
    const payload = JSON.parse(options.body)
    expect(payload.checkout_reference).toBe('o1')
    expect(payload.amount).toBe(12.5)
    expect(payload.merchant_code).toBe('MC123')
    expect(store.orders.o1.sumup_checkout_id).toBe('ck1')
    expect(store.orders.o1.payment_method).toBe('online')
    expect(store.orders.o1.payment_status).toBe('in_attesa')
  })

  it('idempotente: riusa il checkout PENDING con stesso importo', async () => {
    const { deps, paymentsFetch } = makeDeps({
      seed: { orders: { o1: { ...baseOrder, sumup_checkout_id: 'ck1' } } },
      responses: { 'GET /v0.1/checkouts/ck1': { status: 'PENDING', amount: 12.5 } },
    })
    expect(await createCheckout(deps, { orderId: 'o1' })).toEqual({ checkoutId: 'ck1' })
    expect(paymentsFetch).toHaveBeenCalledTimes(1)
  })

  it('checkout esistente già PAID → patch e alreadyPaid', async () => {
    const { deps, store } = makeDeps({
      seed: { orders: { o1: { ...baseOrder, sumup_checkout_id: 'ck1' } } },
      responses: { 'GET /v0.1/checkouts/ck1': { status: 'PAID', amount: 12.5, transaction_id: 'tx9' } },
    })
    expect(await createCheckout(deps, { orderId: 'o1' })).toEqual({ alreadyPaid: true })
    expect(store.orders.o1.payment_status).toBe('pagato')
    expect(store.orders.o1.sumup_transaction_id).toBe('tx9')
  })

  it('importo cambiato → nuovo checkout con reference univoco', async () => {
    const { deps, store, paymentsFetch } = makeDeps({
      seed: { orders: { o1: { ...baseOrder, sumup_checkout_id: 'ck1', sumup_checkout_attempts: 0 } } },
      responses: {
        'GET /v0.1/checkouts/ck1': { status: 'PENDING', amount: 9 },
        'POST /v0.1/checkouts': { id: 'ck2' },
      },
    })
    expect(await createCheckout(deps, { orderId: 'o1' })).toEqual({ checkoutId: 'ck2' })
    const post = paymentsFetch.mock.calls.find(([, o]) => o?.method === 'POST')
    expect(JSON.parse(post[1].body).checkout_reference).toBe('o1-2')
    expect(store.orders.o1.sumup_checkout_id).toBe('ck2')
    expect(store.orders.o1.sumup_checkout_attempts).toBe(1)
  })
})

describe('Feature: verifica stato pagamento', () => {
  it('PAID → ordine pagato (con auto-chiusura se ritirato)', async () => {
    const { deps, store } = makeDeps({
      seed: { orders: { o1: { ...baseOrder, status: 'ritirato', sumup_checkout_id: 'ck1' } } },
      responses: { 'GET /v0.1/checkouts/ck1': { status: 'PAID', transaction_id: 'tx1' } },
    })
    expect(await verifyCheckoutStatus(deps, { orderId: 'o1' })).toEqual({ status: 'pagato' })
    expect(store.orders.o1.payment_status).toBe('pagato')
    expect(store.orders.o1.status).toBe('pagato')
  })

  it('FAILED → fallito', async () => {
    const { deps, store } = makeDeps({
      seed: { orders: { o1: { ...baseOrder, sumup_checkout_id: 'ck1' } } },
      responses: { 'GET /v0.1/checkouts/ck1': { status: 'FAILED' } },
    })
    expect(await verifyCheckoutStatus(deps, { orderId: 'o1' })).toEqual({ status: 'fallito' })
    expect(store.orders.o1.payment_status).toBe('fallito')
  })

  it('pagamento su ordine annullato → payment_after_cancel, status intatto', async () => {
    const { deps, store } = makeDeps({
      seed: { orders: { o1: { ...baseOrder, status: 'annullato', sumup_checkout_id: 'ck1' } } },
      responses: { 'GET /v0.1/checkouts/ck1': { status: 'PAID' } },
    })
    await verifyCheckoutStatus(deps, { orderId: 'o1' })
    expect(store.orders.o1.payment_after_cancel).toBe(true)
    expect(store.orders.o1.status).toBe('annullato')
  })

  it('senza checkout → restituisce lo stato attuale senza chiamate', async () => {
    const { deps, paymentsFetch } = makeDeps({
      seed: { orders: { o1: { ...baseOrder, payment_status: 'non_richiesto' } } },
    })
    expect(await verifyCheckoutStatus(deps, { orderId: 'o1' })).toEqual({ status: 'non_richiesto' })
    expect(paymentsFetch).not.toHaveBeenCalled()
  })
})

describe('Feature: webhook checkout online', () => {
  it('trova l\'ordine dal checkout id e ri-verifica via API', async () => {
    const { deps, store } = makeDeps({
      seed: { orders: { o1: { ...baseOrder, sumup_checkout_id: 'ck1' } } },
      responses: { 'GET /v0.1/checkouts/ck1': { status: 'PAID' } },
    })
    expect(await handleOnlineWebhook(deps, { checkoutId: 'ck1' })).toEqual({ status: 200 })
    expect(store.orders.o1.payment_status).toBe('pagato')
  })

  it('checkout sconosciuto → 200 senza effetti', async () => {
    const { deps } = makeDeps({ seed: { orders: {} } })
    expect(await handleOnlineWebhook(deps, { checkoutId: 'boh' })).toEqual({ status: 200 })
  })
})
