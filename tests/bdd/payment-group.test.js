'use strict'

// BDD — pagamento di un GRUPPO via SumUp (functions/lib/payment-service.js).

import { describe, it, expect, vi } from 'vitest'
import {
  createGroupCheckout,
  verifyGroupPayment,
  groupReaderCheckout,
  handleOnlineWebhook,
  handleReaderWebhook,
} from '../../functions/lib/payment-service.js'
import { createFakeFirestore } from '../helpers/fakeFirestore.js'

const NOW = '2026-06-14T20:00:00.000Z'
const bartender = { token: { role: 'bartender' } }

function makeDeps({ configured = true, seed = {}, responses = {}, errors = {} } = {}) {
  const { db, store } = createFakeFirestore(seed)
  if (!store.settings) store.settings = {}
  const paymentsFetch = vi.fn(async (path, options = {}) => {
    const key = `${options.method || 'GET'} ${path}`
    if (key in errors) {
      const e = new Error(`SumUp ${errors[key]}`)
      e.status = errors[key]
      throw e
    }
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
      webhookUrl: () => 'https://fn/paymentWebhook',
    },
    store,
    paymentsFetch,
  }
}

const groupPayment = {
  serata_id: 's1',
  method: 'online',
  status: 'in_attesa',
  amount: 18,
  order_ids: ['o1', 'o2'],
}
const seedBase = {
  payments: { pay1: { ...groupPayment } },
  orders: {
    o1: { status: 'ritirato', total: 10, payment_status: 'non_richiesto' },
    o2: { status: 'pronto', total: 8, payment_status: 'non_richiesto' },
  },
}

describe('Feature: checkout online di gruppo', () => {
  it('non configurato → unavailable', async () => {
    const { deps } = makeDeps({ configured: false, seed: seedBase })
    expect(await createGroupCheckout(deps, { paymentId: 'pay1' })).toEqual({ unavailable: true })
  })

  it('crea il checkout sull’importo del gruppo e lo salva sul payment', async () => {
    const { deps, store, paymentsFetch } = makeDeps({
      seed: seedBase,
      responses: { 'POST /v0.1/checkouts': { id: 'ck1' } },
    })
    expect(await createGroupCheckout(deps, { paymentId: 'pay1' })).toEqual({ checkoutId: 'ck1' })
    const body = JSON.parse(paymentsFetch.mock.calls[0][1].body)
    expect(body.amount).toBe(18)
    expect(body.checkout_reference).toBe('pay1')
    expect(store.payments.pay1.sumup_checkout_id).toBe('ck1')
  })

  it('verifica PAID → salda payment e tutti gli ordini', async () => {
    const { deps, store } = makeDeps({
      seed: { ...seedBase, payments: { pay1: { ...groupPayment, sumup_checkout_id: 'ck1' } } },
      responses: { 'GET /v0.1/checkouts/ck1': { status: 'PAID', transaction_id: 'tx9' } },
    })
    expect(await verifyGroupPayment(deps, { paymentId: 'pay1' })).toEqual({ status: 'pagato' })
    expect(store.payments.pay1.status).toBe('pagato')
    expect(store.payments.pay1.sumup_transaction_id).toBe('tx9')
    expect(store.orders.o1.payment_status).toBe('pagato')
    expect(store.orders.o1.status).toBe('pagato') // era ritirato → chiuso
    expect(store.orders.o2.payment_status).toBe('pagato')
    expect(store.orders.o2.status).toBe('pronto') // non ritirato → resta in preparazione
    expect(store.orders.o2.payment_id).toBe('pay1')
  })
})

describe('Feature: lettore di gruppo', () => {
  it('avvia il checkout sul lettore con l’importo del gruppo', async () => {
    const { deps, store, paymentsFetch } = makeDeps({
      seed: { ...seedBase, settings: { bar: { sumup_reader_id: 'rdr1' } } },
      responses: {
        'POST /v0.1/merchants/MC123/readers/rdr1/checkout': { data: { client_transaction_id: 'ctx1' } },
      },
    })
    expect(await groupReaderCheckout(deps, bartender, { paymentId: 'pay1' })).toEqual({ clientTransactionId: 'ctx1' })
    const body = JSON.parse(paymentsFetch.mock.calls[0][1].body)
    expect(body.total_amount.value).toBe(1800)
    expect(store.payments.pay1.sumup_client_transaction_id).toBe('ctx1')
  })

  it('lettore non associato → failed-precondition', async () => {
    const { deps } = makeDeps({ seed: { ...seedBase, settings: { bar: {} } } })
    await expect(groupReaderCheckout(deps, bartender, { paymentId: 'pay1' })).rejects.toMatchObject({
      code: 'failed-precondition',
    })
  })
})

describe('Feature: webhook salda i pagamenti di gruppo', () => {
  it('webhook online di gruppo chiude tutti gli ordini', async () => {
    const { deps, store } = makeDeps({
      seed: { ...seedBase, payments: { pay1: { ...groupPayment, sumup_checkout_id: 'ck1' } } },
      responses: { 'GET /v0.1/checkouts/ck1': { status: 'PAID' } },
    })
    expect(await handleOnlineWebhook(deps, { checkoutId: 'ck1' })).toEqual({ status: 200 })
    expect(store.payments.pay1.status).toBe('pagato')
    expect(store.orders.o1.payment_status).toBe('pagato')
    expect(store.orders.o2.payment_status).toBe('pagato')
  })

  it('webhook lettore di gruppo: verifica via Transactions API e salda', async () => {
    const { deps, store } = makeDeps({
      seed: {
        ...seedBase,
        payments: { pay1: { ...groupPayment, method: 'lettore', sumup_client_transaction_id: 'ctx1' } },
      },
      responses: {
        'GET /v0.1/me/transactions?client_transaction_id=ctx1': { status: 'SUCCESSFUL', id: 'tx5' },
      },
    })
    expect(await handleReaderWebhook(deps, { clientTransactionId: 'ctx1' })).toEqual({ status: 200 })
    expect(store.payments.pay1.status).toBe('pagato')
    expect(store.orders.o1.payment_status).toBe('pagato')
  })
})
