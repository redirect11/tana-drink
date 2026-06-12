'use strict'

// BDD — lettore SumUp Solo via Cloud API (functions/lib/payment-service.js).

import { describe, it, expect, vi } from 'vitest'
import {
  pairReader,
  unpairReader,
  readerCheckout,
  readerTerminate,
  handleReaderWebhook,
} from '../../functions/lib/payment-service.js'
import { createFakeFirestore } from '../helpers/fakeFirestore.js'

const NOW = '2026-06-12T23:00:00.000Z'
const bartender = { token: { role: 'bartender' } }
const staff = { token: { role: 'staff' } }
const cliente = { token: {} }

function makeDeps({ configured = true, seed = {}, responses = {}, errors = {} } = {}) {
  const { db, store } = createFakeFirestore(seed)
  // settings doc serve a quasi tutti i test
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

describe('Feature: pairing del lettore', () => {
  it('solo il bartender può associare', async () => {
    const { deps } = makeDeps()
    await expect(pairReader(deps, staff, { pairing_code: 'ABC' })).rejects.toMatchObject({
      code: 'permission-denied',
    })
    await expect(pairReader(deps, cliente, { pairing_code: 'ABC' })).rejects.toMatchObject({
      code: 'permission-denied',
    })
  })

  it('associa e salva id/nome nei settings', async () => {
    const { deps, store } = makeDeps({
      responses: { 'POST /v0.1/merchants/MC123/readers': { id: 'rdr1', name: 'Solo Bancone' } },
    })
    const res = await pairReader(deps, bartender, { pairing_code: 'abc123' })
    expect(res).toEqual({ id: 'rdr1', name: 'Solo Bancone' })
    expect(store.settings.bar.sumup_reader_id).toBe('rdr1')
    expect(store.settings.bar.sumup_reader_name).toBe('Solo Bancone')
  })

  it('codice scaduto → messaggio chiaro', async () => {
    const { deps } = makeDeps({ errors: { 'POST /v0.1/merchants/MC123/readers': 422 } })
    await expect(pairReader(deps, bartender, { pairing_code: 'OLD' })).rejects.toMatchObject({
      code: 'invalid-argument',
    })
  })

  it('dissocia: azzera i settings anche se SumUp fallisce', async () => {
    const { deps, store } = makeDeps({
      seed: { settings: { bar: { sumup_reader_id: 'rdr1', sumup_reader_name: 'Solo' } } },
      errors: { 'DELETE /v0.1/merchants/MC123/readers/rdr1': 500 },
    })
    await unpairReader(deps, bartender)
    expect(store.settings.bar.sumup_reader_id).toBeNull()
  })
})

const ordine = {
  status: 'pronto',
  total: 12.5,
  daily_number: 7,
  payment_status: 'non_richiesto',
}

describe('Feature: incasso sul lettore', () => {
  const seedBase = {
    settings: { bar: { sumup_reader_id: 'rdr1' } },
    orders: { o1: { ...ordine } },
  }

  it('staff e bartender possono incassare, i clienti no', async () => {
    const { deps } = makeDeps({ seed: seedBase })
    await expect(readerCheckout(deps, cliente, { orderId: 'o1' })).rejects.toMatchObject({
      code: 'permission-denied',
    })
  })

  it('avvia il checkout: importo in centesimi, return_url, stato in_attesa', async () => {
    const { deps, store, paymentsFetch } = makeDeps({
      seed: seedBase,
      responses: {
        'POST /v0.1/merchants/MC123/readers/rdr1/checkout': {
          data: { client_transaction_id: 'ctx1' },
        },
      },
    })
    const res = await readerCheckout(deps, staff, { orderId: 'o1' })
    expect(res).toEqual({ clientTransactionId: 'ctx1' })
    const [, options] = paymentsFetch.mock.calls[0]
    const payload = JSON.parse(options.body)
    expect(payload.total_amount).toEqual({ currency: 'EUR', minor_unit: 2, value: 1250 })
    expect(payload.return_url).toBe('https://fn/paymentWebhook')
    expect(store.orders.o1.payment_method).toBe('lettore')
    expect(store.orders.o1.payment_status).toBe('in_attesa')
    expect(store.orders.o1.sumup_client_transaction_id).toBe('ctx1')
  })

  it('lettore offline (422) → messaggio dedicato', async () => {
    const { deps } = makeDeps({
      seed: seedBase,
      errors: { 'POST /v0.1/merchants/MC123/readers/rdr1/checkout': 422 },
    })
    await expect(readerCheckout(deps, bartender, { orderId: 'o1' })).rejects.toMatchObject({
      code: 'unavailable',
    })
  })

  it('lettore sconosciuto (404) → invito a rifare il pairing', async () => {
    const { deps } = makeDeps({
      seed: seedBase,
      errors: { 'POST /v0.1/merchants/MC123/readers/rdr1/checkout': 404 },
    })
    await expect(readerCheckout(deps, bartender, { orderId: 'o1' })).rejects.toMatchObject({
      code: 'not-found',
    })
  })

  it('nessun lettore associato → failed-precondition', async () => {
    const { deps } = makeDeps({ seed: { settings: { bar: {} }, orders: { o1: { ...ordine } } } })
    await expect(readerCheckout(deps, bartender, { orderId: 'o1' })).rejects.toMatchObject({
      code: 'failed-precondition',
    })
  })

  it('ordine già pagato o annullato → rifiutato', async () => {
    const { deps } = makeDeps({
      seed: {
        settings: { bar: { sumup_reader_id: 'rdr1' } },
        orders: {
          o1: { ...ordine, payment_status: 'pagato' },
          o2: { ...ordine, status: 'annullato' },
        },
      },
    })
    await expect(readerCheckout(deps, bartender, { orderId: 'o1' })).rejects.toMatchObject({
      code: 'failed-precondition',
    })
    await expect(readerCheckout(deps, bartender, { orderId: 'o2' })).rejects.toMatchObject({
      code: 'failed-precondition',
    })
  })

  it('terminate: ferma il lettore e marca fallito', async () => {
    const { deps, store } = makeDeps({
      seed: {
        settings: { bar: { sumup_reader_id: 'rdr1' } },
        orders: {
          o1: { ...ordine, payment_method: 'lettore', payment_status: 'in_attesa' },
        },
      },
      responses: { 'POST /v0.1/merchants/MC123/readers/rdr1/terminate': {} },
    })
    await readerTerminate(deps, staff, { orderId: 'o1' })
    expect(store.orders.o1.payment_status).toBe('fallito')
    expect(store.orders.o1.payment_method).toBeNull()
  })
})

describe('Feature: webhook del lettore (verifica via Transactions API)', () => {
  it('SUCCESSFUL su ordine ritirato → pagato e chiuso', async () => {
    const { deps, store } = makeDeps({
      seed: {
        orders: {
          o1: {
            ...ordine,
            status: 'ritirato',
            payment_method: 'lettore',
            payment_status: 'in_attesa',
            sumup_client_transaction_id: 'ctx1',
          },
        },
      },
      responses: {
        'GET /v0.1/me/transactions?client_transaction_id=ctx1': {
          status: 'SUCCESSFUL',
          id: 'tx77',
        },
      },
    })
    expect(await handleReaderWebhook(deps, { clientTransactionId: 'ctx1' })).toEqual({ status: 200 })
    expect(store.orders.o1.payment_status).toBe('pagato')
    expect(store.orders.o1.status).toBe('pagato')
    expect(store.orders.o1.sumup_transaction_id).toBe('tx77')
  })

  it('FAILED → fallito', async () => {
    const { deps, store } = makeDeps({
      seed: {
        orders: {
          o1: { ...ordine, payment_method: 'lettore', payment_status: 'in_attesa', sumup_client_transaction_id: 'ctx1' },
        },
      },
      responses: {
        'GET /v0.1/me/transactions?client_transaction_id=ctx1': { status: 'FAILED' },
      },
    })
    await handleReaderWebhook(deps, { clientTransactionId: 'ctx1' })
    expect(store.orders.o1.payment_status).toBe('fallito')
  })

  it('transazione sconosciuta → 200 senza effetti', async () => {
    const { deps } = makeDeps({ seed: { orders: {} } })
    expect(await handleReaderWebhook(deps, { clientTransactionId: 'boh' })).toEqual({ status: 200 })
  })
})
