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
import { createRequire } from 'node:module'

// Col require nativo, come lo carica payment-service.js nelle Functions
// (stesso motivo di licenza-functions.test.js: la coverage resta stabile).
const { esitoLettoreDaApplicare } = createRequire(import.meta.url)('../../functions/lib/payment-core.js')

const NOW = '2026-06-12T23:00:00.000Z'
const bartender = { token: { role: 'bartender' } }
const staff = { token: { role: 'staff' } }
const cliente = { token: {} }

function makeDeps({ configured = true, seed = {}, responses = {}, errors = {} } = {}) {
  const { db, store } = createFakeFirestore(seed)
  // Un locale col modulo SumUp (BUG-134): le Functions dei pagamenti lo
  // chiedono alla licenza. Chi prova il rifiuto ne scrive un'altra.
  if (!store.licenza) store.licenza = { attuale: { stato: 'attiva', moduli: { sumup: true } } }
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
      affiliate: () => ({ app_id: 'it.tana.app', key: 'aff-1' }),
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
    expect(payload.affiliate).toEqual({
      app_id: 'it.tana.app',
      key: 'aff-1',
      foreign_transaction_id: 'o1',
    })
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

  it('transazione sconosciuta → 200 senza effetti, e senza chiedere niente a SumUp', async () => {
    // REQ-DEV-026: il webhook è un indirizzo pubblico. Prima un id
    // inventato arrivava fino all'API di SumUp: chi lo bombardava faceva
    // lavorare Function, Firestore e SumUp a spese del locale.
    const { deps } = makeDeps({ seed: { orders: {}, payments: {} } })
    expect(await handleReaderWebhook(deps, { clientTransactionId: 'boh' })).toEqual({ status: 200 })
    expect(deps.paymentsFetch).not.toHaveBeenCalled()
  })
})

// BUG-162: SumUp ritenta una notifica non riuscita dopo 1, 5, 20 minuti e 2
// ore (regia, 16/11/2026, dalla documentazione dei webhook di SumUp): lo
// stesso esito può arrivare più volte, anche ore dopo. Il conto tiene il suo
// `sumup_client_transaction_id` anche dopo l'esito, e un incasso in contanti
// non lo toglie.
describe('Feature: lo stesso esito del lettore arriva due volte', () => {
  const inAttesa = {
    ...ordine,
    status: 'ritirato',
    payment_method: 'lettore',
    payment_status: 'in_attesa',
    sumup_client_transaction_id: 'ctx1',
    sumup_pending_amount: 12.5,
  }

  it('un «fallito» rimandato non riporta a «parziale» un conto pagato in contanti nel frattempo', async () => {
    const pagatoInContanti = {
      ...inAttesa,
      status: 'pagato',
      payment_method: 'contanti',
      payment_status: 'pagato',
      sumup_pending_amount: null,
      payments: [{ id: 'pay-cash', amount: 12.5, method: 'contanti', at: NOW }],
    }
    const { deps, store } = makeDeps({
      seed: { orders: { o1: pagatoInContanti } },
      responses: { 'GET /v0.1/me/transactions?client_transaction_id=ctx1': { status: 'FAILED' } },
    })
    expect(await handleReaderWebhook(deps, { clientTransactionId: 'ctx1' })).toEqual({ status: 200 })
    expect(store.orders.o1.payment_status).toBe('pagato')
    expect(store.orders.o1.status).toBe('pagato')
  })

  it('un rifiuto arrivato dopo un incasso a parte: lo stato resta, l’importo in volo se ne va', async () => {
    // Al banco si è preso un acconto in contanti mentre la carta era sul
    // lettore (il conto è passato a «parziale»), poi la carta è stata
    // rifiutata.
    const parziale = {
      ...inAttesa,
      payment_status: 'parziale',
      payments: [{ id: 'pay-cash', amount: 5, method: 'contanti', at: NOW }],
      sumup_pending_items: [{ id: 'r1' }],
    }
    const { deps, store } = makeDeps({
      seed: { orders: { o1: parziale } },
      responses: { 'GET /v0.1/me/transactions?client_transaction_id=ctx1': { status: 'FAILED' } },
    })
    await handleReaderWebhook(deps, { clientTransactionId: 'ctx1' })
    expect(store.orders.o1.payment_status).toBe('parziale')
    expect(store.orders.o1.payments).toHaveLength(1)
    expect(store.orders.o1.sumup_pending_amount).toBeNull()
    expect(store.orders.o1.sumup_pending_items).toBeNull()
  })

  it('un «pagato» ripetuto non registra il pagamento due volte né ne cambia l’ora', async () => {
    const { deps, store } = makeDeps({
      seed: { orders: { o1: { ...inAttesa } } },
      responses: { 'GET /v0.1/me/transactions?client_transaction_id=ctx1': { status: 'SUCCESSFUL', id: 'tx77' } },
    })
    await handleReaderWebhook(deps, { clientTransactionId: 'ctx1' })
    const dopoIlPrimo = structuredClone(store.orders.o1)
    expect(dopoIlPrimo.payment_status).toBe('pagato')
    deps.now = () => '2026-06-13T01:00:00.000Z' // il tentativo delle due ore dopo
    await handleReaderWebhook(deps, { clientTransactionId: 'ctx1' })
    expect(store.orders.o1).toEqual(dopoIlPrimo)
  })

  it('un «pagato» dopo l’annullo dal banco si applica: i soldi sono stati presi', async () => {
    // readerTerminate ha già segnato il conto «fallito», ma la carta era
    // passata un attimo prima: il conto deve risultare pagato.
    const annullato = { ...inAttesa, payment_status: 'fallito', payment_method: null, sumup_pending_amount: null }
    const { deps, store } = makeDeps({
      seed: { orders: { o1: annullato } },
      responses: { 'GET /v0.1/me/transactions?client_transaction_id=ctx1': { status: 'SUCCESSFUL', id: 'tx77' } },
    })
    await handleReaderWebhook(deps, { clientTransactionId: 'ctx1' })
    expect(store.orders.o1.payment_status).toBe('pagato')
    expect(store.orders.o1.sumup_transaction_id).toBe('tx77')
  })
})

describe('esitoLettoreDaApplicare: quando un esito del lettore vale ancora', () => {
  it('«fallito» solo per un conto che aspetta il lettore', () => {
    expect(esitoLettoreDaApplicare({ payment_status: 'in_attesa', payment_method: 'lettore' }, { status: 'fallito' })).toBe(true)
    expect(esitoLettoreDaApplicare({ payment_status: 'fallito', payment_method: null }, { status: 'fallito' })).toBe(false)
    expect(esitoLettoreDaApplicare({ payment_status: 'pagato', payment_method: 'contanti' }, { status: 'fallito' })).toBe(false)
  })

  it('«pagato» una volta per transazione, anche se registrata fra gli incassi di un parziale', () => {
    const parziale = { payment_status: 'parziale', payments: [{ transaction_id: 'tx1', amount: 5 }] }
    expect(esitoLettoreDaApplicare(parziale, { status: 'pagato', transactionId: 'tx1' })).toBe(false)
    expect(esitoLettoreDaApplicare(parziale, { status: 'pagato', transactionId: 'tx2' })).toBe(true)
  })

  it('senza id della transazione: niente da ricevere per un conto già pagato senza importo in volo', () => {
    expect(esitoLettoreDaApplicare({ payment_status: 'pagato' }, { status: 'pagato' })).toBe(false)
    expect(esitoLettoreDaApplicare({ payment_status: 'pagato', sumup_pending_amount: 4 }, { status: 'pagato' })).toBe(true)
    expect(esitoLettoreDaApplicare({ payment_status: 'in_attesa' }, { status: 'pagato' })).toBe(true)
  })

  it('niente conto, o un esito ancora in attesa: non si applica niente', () => {
    expect(esitoLettoreDaApplicare(null, { status: 'pagato' })).toBe(false)
    expect(esitoLettoreDaApplicare({ payment_status: 'in_attesa' }, { status: 'in_attesa' })).toBe(false)
  })
})
