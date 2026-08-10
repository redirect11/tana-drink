'use strict'

// Unit test della logica pura dei pagamenti (functions/lib/payment-core.js).

import { describe, it, expect } from 'vitest'
import {
  eurosToCents,
  buildCheckoutPayload,
  buildReaderCheckoutPayload,
  mapCheckoutStatus,
  mapTransactionStatus,
  decidePaymentPatch,
  decideAutoAdvance,
  parseReaderWebhookBody,
  parseCheckoutWebhookBody,
} from '../../functions/lib/payment-core.js'

const NOW = '2026-06-12T22:00:00.000Z'

describe('importi', () => {
  it('eurosToCents arrotonda correttamente', () => {
    expect(eurosToCents(12.5)).toBe(1250)
    expect(eurosToCents(0.1 + 0.2)).toBe(30)
    expect(eurosToCents(null)).toBe(0)
  })
})

describe('buildCheckoutPayload', () => {
  it('primo tentativo: reference = orderId', () => {
    const p = buildCheckoutPayload({ orderId: 'o1', total: 12.5, merchantCode: 'MC' })
    expect(p.checkout_reference).toBe('o1')
    expect(p.amount).toBe(12.5)
    expect(p.currency).toBe('EUR')
    expect(p.merchant_code).toBe('MC')
  })

  it('retry: reference univoco con suffisso', () => {
    const p = buildCheckoutPayload({ orderId: 'o1', attempts: 2, total: 5, merchantCode: 'MC' })
    expect(p.checkout_reference).toBe('o1-3')
  })
})

describe('buildReaderCheckoutPayload', () => {
  it('importo in centesimi e return_url', () => {
    const p = buildReaderCheckoutPayload({ total: 8.5, description: 'Ordine #3', returnUrl: 'https://x/wh' })
    expect(p.total_amount).toEqual({ currency: 'EUR', minor_unit: 2, value: 850 })
    expect(p.return_url).toBe('https://x/wh')
    expect(p.affiliate).toBeUndefined()
  })

  it('con affiliate key: app_id, key e foreign_transaction_id', () => {
    const p = buildReaderCheckoutPayload({
      total: 5,
      returnUrl: 'https://x/wh',
      affiliate: { app_id: 'it.tana.app', key: 'aff-1' },
      orderId: 'o9',
    })
    expect(p.affiliate).toEqual({
      app_id: 'it.tana.app',
      key: 'aff-1',
      foreign_transaction_id: 'o9',
    })
  })
})

describe('mapping stati SumUp', () => {
  it('checkout: PAID/FAILED/PENDING', () => {
    expect(mapCheckoutStatus('PAID')).toBe('pagato')
    expect(mapCheckoutStatus('FAILED')).toBe('fallito')
    expect(mapCheckoutStatus('PENDING')).toBe('in_attesa')
    expect(mapCheckoutStatus(undefined)).toBe('in_attesa')
  })
  it('transazioni: SUCCESSFUL/FAILED/CANCELLED', () => {
    expect(mapTransactionStatus('SUCCESSFUL')).toBe('pagato')
    expect(mapTransactionStatus('FAILED')).toBe('fallito')
    expect(mapTransactionStatus('CANCELLED')).toBe('fallito')
  })
})

describe('decidePaymentPatch', () => {
  it('pagato su ordine in corso: solo i campi pagamento', () => {
    const patch = decidePaymentPatch({ status: 'ricevuto' }, { status: 'pagato', transactionId: 'tx1', now: NOW })
    expect(patch).toEqual({ payment_status: 'pagato', paid_at: NOW, sumup_transaction_id: 'tx1' })
  })

  it('pagato su ordine ritirato: chiude anche lo status', () => {
    const patch = decidePaymentPatch({ status: 'ritirato' }, { status: 'pagato', now: NOW })
    expect(patch.status).toBe('pagato')
    expect(patch['status_times.pagato']).toBe(NOW)
  })

  it('pagato su ordine annullato: flag warning, status intatto', () => {
    const patch = decidePaymentPatch({ status: 'annullato' }, { status: 'pagato', now: NOW })
    expect(patch.payment_after_cancel).toBe(true)
    expect(patch.status).toBeUndefined()
  })

  it('fallito: payment_status fallito e importo in volo azzerato', () => {
    expect(decidePaymentPatch({ status: 'ricevuto' }, { status: 'fallito', now: NOW })).toEqual({
      payment_status: 'fallito',
      sumup_pending_amount: null,
      sumup_pending_items: null,
    })
  })

  it('fallito con acconti già incassati: il conto resta "parziale"', () => {
    const order = { status: 'aperto', payments: [{ id: 'p1', amount: 5, method: 'banco' }] }
    expect(decidePaymentPatch(order, { status: 'fallito', now: NOW }).payment_status).toBe('parziale')
  })

  it('in_attesa: nessuna patch', () => {
    expect(decidePaymentPatch({ status: 'ricevuto' }, { status: 'in_attesa', now: NOW })).toBeNull()
  })
})

describe('decidePaymentPatch: incassi PARZIALI sul lettore (split)', () => {
  const base = {
    status: 'aperto',
    total: 22,
    discount_amount: 0,
    comande: [{ status: 'ritirato' }],
  }

  it('importo in volo sotto il residuo: registra il pagamento, conto aperto', () => {
    const order = { ...base, sumup_pending_amount: 7, sumup_pending_items: [{ drink_id: 'mojito', qty: 1 }] }
    const patch = decidePaymentPatch(order, { status: 'pagato', transactionId: 'tx1', now: NOW })
    expect(patch.payment_status).toBe('parziale')
    expect(patch.status).toBeUndefined()
    expect(patch.payments).toHaveLength(1)
    expect(patch.payments[0]).toMatchObject({
      amount: 7,
      method: 'lettore',
      items: [{ drink_id: 'mojito', qty: 1 }],
      transaction_id: 'tx1',
    })
    expect(patch.sumup_pending_amount).toBeNull()
    expect(patch.sumup_client_transaction_id).toBeNull()
  })

  it('importo in volo a saldo del residuo: chiude il conto (servito)', () => {
    const order = {
      ...base,
      payments: [{ id: 'p1', amount: 15, method: 'banco' }],
      sumup_pending_amount: 7,
    }
    const patch = decidePaymentPatch(order, { status: 'pagato', now: NOW })
    expect(patch.payment_status).toBe('pagato')
    expect(patch.payment_method).toBe('misto') // banco + lettore
    expect(patch.status).toBe('pagato')
    expect(patch.payments).toHaveLength(2)
  })

  it('saldo con comande NON servite: chiude e le marca tutte servite', () => {
    const order = {
      ...base,
      comande: [
        { id: 'c1', status: 'pronto', status_times: {} },
        { id: 'c2', status: 'in_preparazione', status_times: {} },
        { id: 'c3', status: 'annullato', status_times: {} },
      ],
      sumup_pending_amount: 22,
    }
    const patch = decidePaymentPatch(order, { status: 'pagato', now: NOW })
    expect(patch.status).toBe('pagato')
    expect(patch.comande.map((c) => c.status)).toEqual(['ritirato', 'ritirato', 'annullato'])
    expect(patch.comande[0].status_times.ritirato).toBe(NOW)
    expect(patch.comande_statuses.sort()).toEqual(['annullato', 'ritirato'])
  })

  it('saldo con sconto: il residuo tiene conto del discount_amount', () => {
    const order = { ...base, discount_amount: 2, sumup_pending_amount: 20 }
    const patch = decidePaymentPatch(order, { status: 'pagato', now: NOW })
    expect(patch.payment_status).toBe('pagato')
    expect(patch.payment_method).toBe('lettore')
  })
})

describe('decideAutoAdvance', () => {
  it('scatta quando ritirato+pagato diventa vero', () => {
    expect(
      decideAutoAdvance(
        { status: 'ritirato', payment_status: 'in_attesa' },
        { status: 'ritirato', payment_status: 'pagato' }
      )
    ).toBe('pagato')
    expect(
      decideAutoAdvance(
        { status: 'pronto', payment_status: 'pagato' },
        { status: 'ritirato', payment_status: 'pagato' }
      )
    ).toBe('pagato')
  })

  it('non scatta se già chiuso o non completo', () => {
    expect(
      decideAutoAdvance(
        { status: 'ritirato', payment_status: 'pagato' },
        { status: 'ritirato', payment_status: 'pagato' }
      )
    ).toBeNull()
    expect(
      decideAutoAdvance(
        { status: 'ricevuto', payment_status: 'in_attesa' },
        { status: 'ricevuto', payment_status: 'pagato' }
      )
    ).toBeNull()
  })
})

describe('parsing webhook (solo identificativi, mai lo status)', () => {
  it('lettore: client_transaction_id in varie forme', () => {
    expect(parseReaderWebhookBody({ payload: { client_transaction_id: 'ct1' } }).clientTransactionId).toBe('ct1')
    expect(parseReaderWebhookBody({ client_transaction_id: 'ct2' }).clientTransactionId).toBe('ct2')
    expect(parseReaderWebhookBody({}).clientTransactionId).toBeNull()
  })

  it('checkout online: id e reference', () => {
    expect(parseCheckoutWebhookBody({ id: 'ck1' }).checkoutId).toBe('ck1')
    expect(parseCheckoutWebhookBody({ payload: { checkout_id: 'ck2', reference: 'o1' } })).toEqual({
      checkoutId: 'ck2',
      reference: 'o1',
    })
  })
})
