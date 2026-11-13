'use strict'

// Unit test della logica pura dei pagamenti (functions/lib/payment-core.js).

import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

// Col require nativo, come lo carica payment-service.js nelle Functions. Se
// lo si importa passando da Vite, V8 vede due versioni dello stesso file con
// posizioni diverse e la coverage le fonde in un ordine che cambia da un giro
// all'altro: il 10/11/2026 i rami di functions/lib passavano da 75,6 a 71,1%
// sullo stesso codice, e una PR è stata bocciata senza motivo.
const require = createRequire(import.meta.url)
const {
  eurosToCents,
  buildCheckoutPayload,
  buildReaderCheckoutPayload,
  mapCheckoutStatus,
  mapTransactionStatus,
  decidePaymentPatch,
  decideAutoAdvance,
  parseReaderWebhookBody,
  parseCheckoutWebhookBody,
  groupOrderPaidPatch,
  isServed,
} = require('../../functions/lib/payment-core.js')

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

  // Un incasso dal lettore senza conto (importo libero): la chiave c'è, il
  // legame con l'ordine no.
  it('con affiliate key ma senza ordine: niente foreign_transaction_id', () => {
    const p = buildReaderCheckoutPayload({ total: 5, returnUrl: 'https://x/wh', affiliate: { app_id: 'a', key: 'k' } })
    expect(p.affiliate).toEqual({ app_id: 'a', key: 'k' })
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
  // Una transazione ancora in corso (o uno stato che SumUp aggiungerà) non
  // è né pagata né fallita: si aspetta, il conto resta com'è.
  it('transazione in corso o sconosciuta: si aspetta', () => {
    expect(mapTransactionStatus('PENDING')).toBe('in_attesa')
    expect(mapTransactionStatus(undefined)).toBe('in_attesa')
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
      sumup_pending_sconto: null,
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

  // ── LO SCONTO VIAGGIA COL PAGAMENTO, ANCHE SUL LETTORE ────────────
  // La schermata l'ha preparato sulle righe che sta riscuotendo e l'ha messo
  // in volo insieme all'importo: qui entra dentro l'incasso e sul conto non
  // resta niente di preparato, se no il prossimo se lo ritroverebbe addosso.
  // Gli sconti dei pagamenti precedenti pesano sul residuo come il pagato.
  it('lo sconto in volo finisce dentro il pagamento e sparisce dal conto', () => {
    const order = {
      ...base,
      sumup_pending_amount: 6,
      sumup_pending_items: [{ drink_id: 'gin', qty: 1 }],
      sumup_pending_sconto: {
        type: 'euro',
        value: 2,
        amount: 2,
        items: [{ drink_id: 'gin', qty: 1 }],
      },
      discount: { type: 'euro', value: 2 },
      discount_amount: 2,
    }
    const patch = decidePaymentPatch(order, { status: 'pagato', now: NOW })
    expect(patch.payments[0].sconto).toMatchObject({ amount: 2 })
    expect(patch.discount_amount).toBe(0)
    expect(patch.discount).toBeNull()
    expect(patch.sumup_pending_sconto).toBeNull()
    // 22 − 2 di sconto − 6 incassati = 14 ancora da prendere: conto aperto.
    expect(patch.payment_status).toBe('parziale')
  })

  it('un secondo incasso sul lettore salda quello che resta dopo il primo sconto', () => {
    const order = {
      ...base,
      payments: [
        {
          id: 'p1',
          amount: 6,
          method: 'lettore',
          sconto: { type: 'euro', value: 2, amount: 2, items: [{ drink_id: 'gin', qty: 1 }] },
        },
      ],
      sumup_pending_amount: 12.6,
      sumup_pending_sconto: { type: 'percent', value: 10, amount: 1.4, items: [{ qty: 2 }] },
    }
    const patch = decidePaymentPatch(order, { status: 'pagato', now: NOW })
    // 22 − 2 − 1,40 − 6 − 12,60 = 0: due sconti, due incassi, conto chiuso.
    expect(patch.payment_status).toBe('pagato')
    expect(patch.payments.map((p) => p.sconto.amount)).toEqual([2, 1.4])
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

// I casi del lettore che al banco capitano davvero, anche se di rado.
describe('decidePaymentPatch: il saldo dal lettore nei casi di confine', () => {
  const conto = { total: 10, payments: [], sumup_pending_amount: 10 }

  it('il codice della transazione resta sul conto, saldato tutto o in un colpo', () => {
    expect(decidePaymentPatch(conto, { status: 'pagato', transactionId: 'tx9', now: NOW }).sumup_transaction_id).toBe('tx9')
    expect(decidePaymentPatch({ status: 'ritirato' }, { status: 'pagato', now: NOW }).sumup_transaction_id).toBeUndefined()
  })

  // Il conto è stato annullato mentre la carta era sul lettore: i soldi
  // sono entrati, il conto non si riapre. Si segnala per il rimborso.
  it('saldo arrivato su un conto annullato nel frattempo: segnalato, non riaperto', () => {
    const patch = decidePaymentPatch({ ...conto, status: 'annullato' }, { status: 'pagato', now: NOW })
    expect(patch.payment_after_cancel).toBe(true)
    expect(patch.status).toBeUndefined()
    expect(patch.payment_status).toBe('pagato')
  })

  // I conti di prima delle comande non hanno righe da segnare servite.
  it('saldo di un conto senza comande (modello vecchio): si chiude e basta', () => {
    const patch = decidePaymentPatch({ ...conto, status: 'ricevuto' }, { status: 'pagato', now: NOW })
    expect(patch.status).toBe('pagato')
    expect(patch.comande).toBeUndefined()
  })
})

// Un pagamento di GRUPPO salda più conti insieme: ognuno riceve la sua patch.
describe('groupOrderPaidPatch', () => {
  const opts = { method: 'lettore', paymentId: 'pg1', now: NOW }

  it('un conto che non c’è, già pagato o annullato si salta', () => {
    expect(groupOrderPaidPatch(null, opts)).toBeNull()
    expect(groupOrderPaidPatch({ payment_status: 'pagato' }, opts)).toBeNull()
    expect(groupOrderPaidPatch({ status: 'annullato' }, opts)).toBeNull()
  })

  it('un conto ancora da servire si segna pagato ma resta aperto', () => {
    expect(groupOrderPaidPatch({ status: 'ricevuto' }, opts)).toEqual({
      payment_status: 'pagato', payment_method: 'lettore', paid_at: NOW, payment_id: 'pg1',
    })
  })

  it('un conto già servito si chiude; senza metodo vale «online»', () => {
    const patch = groupOrderPaidPatch({ status: 'ritirato' }, { paymentId: 'pg1', now: NOW })
    expect(patch.status).toBe('pagato')
    expect(patch['status_times.pagato']).toBe(NOW)
    expect(patch.payment_method).toBe('online')
  })
})

describe('isServed', () => {
  it('nessun conto non è servito', () => {
    expect(isServed(null)).toBe(false)
  })
})

describe('decideAutoAdvance', () => {
  // Il documento cancellato arriva come «dopo» vuoto: niente da chiudere.
  it('niente da fare su un conto cancellato, già chiuso o annullato', () => {
    const servito = { status: 'ritirato', payment_status: 'pagato' }
    expect(decideAutoAdvance(servito, null)).toBeNull()
    expect(decideAutoAdvance(servito, { ...servito, status: 'pagato' })).toBeNull()
    expect(decideAutoAdvance(servito, { ...servito, status: 'annullato' })).toBeNull()
    expect(decideAutoAdvance(null, servito)).toBe('pagato')
  })

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
