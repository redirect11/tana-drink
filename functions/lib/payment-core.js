'use strict'

// Logica pura dei pagamenti SumUp (checkout online + lettore Solo):
// nessuna dipendenza Firebase, interamente testabile.

// Totale ordine in centesimi (l'API del lettore vuole minor units).
function eurosToCents(total) {
  return Math.round(Number(total || 0) * 100)
}

// Payload per POST /v0.1/checkouts (pagamento online).
// `attempts` > 0 → checkout_reference univoco sui retry (SumUp rifiuta
// reference duplicati di checkout andati a buon fine o pendenti altrove).
function buildCheckoutPayload({ orderId, attempts = 0, total, merchantCode, description }) {
  return {
    checkout_reference: attempts > 0 ? `${orderId}-${attempts + 1}` : orderId,
    amount: Math.round(Number(total || 0) * 100) / 100,
    currency: 'EUR',
    merchant_code: merchantCode,
    description: description || null,
  }
}

// Payload per POST /readers/{id}/checkout (pagamento sul lettore).
// L'affiliate key è OBBLIGATORIA per le integrazioni card-present via
// Cloud API (identifica l'applicazione, non autentica); il
// foreign_transaction_id lega la transazione SumUp all'ordine.
function buildReaderCheckoutPayload({ total, description, returnUrl, affiliate = null, orderId = null }) {
  return {
    total_amount: {
      currency: 'EUR',
      minor_unit: 2,
      value: eurosToCents(total),
    },
    description: description || undefined,
    return_url: returnUrl,
    ...(affiliate
      ? {
          affiliate: {
            app_id: affiliate.app_id,
            key: affiliate.key,
            ...(orderId ? { foreign_transaction_id: orderId } : {}),
          },
        }
      : {}),
  }
}

// Stato SumUp del checkout online → stato di pagamento dell'ordine.
function mapCheckoutStatus(sumupStatus) {
  if (sumupStatus === 'PAID') return 'pagato'
  if (sumupStatus === 'FAILED') return 'fallito'
  return 'in_attesa' // PENDING o sconosciuto
}

// Stato di una transazione (Transactions API, esito lettore).
function mapTransactionStatus(txStatus) {
  if (txStatus === 'SUCCESSFUL') return 'pagato'
  if (txStatus === 'FAILED' || txStatus === 'CANCELLED') return 'fallito'
  return 'in_attesa'
}

// Tutte le comande servite? (modello conto/comande; i doc legacy valgono
// come una sola comanda con lo stato dell'ordine)
function isServed(o) {
  if (!o) return false
  if (Array.isArray(o.comande)) {
    const attive = o.comande.filter((c) => c && c.status !== 'annullato')
    return attive.length > 0 && attive.every((c) => c.status === 'ritirato')
  }
  return o.status === 'ritirato'
}

// Residuo del conto: totale − sconto − pagamenti parziali già registrati
// (stessa aritmetica di src/lib/pagamento.js lato client).
function orderDue(order) {
  const paid = (order?.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const due = (Number(order?.total) || 0) - (Number(order?.discount_amount) || 0) - paid
  return Math.max(0, Math.round(due * 100) / 100)
}

// Patch Firestore da applicare all'ordine per un esito di pagamento.
// - pagato su ordine "ritirato" → chiude anche lo status (auto-avanzamento)
// - pagato su ordine "annullato" → NON tocca lo status: segna
//   payment_after_cancel per la gestione manuale (rimborso dal dashboard)
// - incasso PARZIALE sul lettore (sumup_pending_amount < residuo): registra
//   il pagamento nello storico e lascia il conto aperto ('parziale')
function decidePaymentPatch(order, { status, transactionId = null, now }) {
  if (status === 'fallito') {
    return {
      payment_status: (order?.payments || []).length ? 'parziale' : 'fallito',
      sumup_pending_amount: null,
      sumup_pending_items: null,
    }
  }
  if (status !== 'pagato') return null

  const pending = Number(order?.sumup_pending_amount)
  if (pending > 0) {
    const payments = [
      ...(order?.payments || []),
      {
        id: `pay-${now}`,
        amount: pending,
        method: 'lettore',
        items: order?.sumup_pending_items || null,
        at: now,
        ...(transactionId ? { transaction_id: transactionId } : {}),
      },
    ]
    const residuo = orderDue({ ...order, payments })
    if (residuo > 0.005) {
      return {
        payments,
        payment_status: 'parziale',
        sumup_pending_amount: null,
        sumup_pending_items: null,
        sumup_client_transaction_id: null,
      }
    }
    const patch = {
      payments,
      payment_status: 'pagato',
      payment_method: payments.every((p) => p.method === 'lettore') ? 'lettore' : 'misto',
      paid_at: now,
      sumup_pending_amount: null,
      sumup_pending_items: null,
    }
    if (transactionId) patch.sumup_transaction_id = transactionId
    if (order?.status === 'annullato') {
      patch.payment_after_cancel = true
    } else if (isServed(order)) {
      patch.status = 'pagato'
      patch['status_times.pagato'] = now
    }
    return patch
  }

  const patch = {
    payment_status: 'pagato',
    paid_at: now,
  }
  if (transactionId) patch.sumup_transaction_id = transactionId

  if (order?.status === 'annullato') {
    patch.payment_after_cancel = true
  } else if (isServed(order)) {
    patch.status = 'pagato'
    patch['status_times.pagato'] = now
  }
  return patch
}

// Patch per un singolo ordine saldato da un pagamento di GRUPPO: marca
// pagato (metodo del pagamento, payment_id) e chiude lo status solo se
// l'ordine era già ritirato. `null` se l'ordine è già pagato/da saltare.
function groupOrderPaidPatch(order, { method, paymentId, now }) {
  if (!order || order.payment_status === 'pagato' || order.status === 'annullato') return null
  const patch = {
    payment_status: 'pagato',
    payment_method: method || 'online',
    paid_at: now,
    payment_id: paymentId,
  }
  if (isServed(order)) {
    patch.status = 'pagato'
    patch['status_times.pagato'] = now
  }
  return patch
}

// Cintura server (trigger onDocumentUpdated): un ordine ritirato e
// pagato — in qualunque ordine siano arrivate le due cose — si chiude.
function decideAutoAdvance(before, after) {
  if (!after) return null
  if (after.status === 'pagato' || after.status === 'annullato') return null
  const nowClosed = isServed(after) && after.payment_status === 'pagato'
  const wasClosed = before && isServed(before) && before.payment_status === 'pagato'
  return nowClosed && !wasClosed ? 'pagato' : null
}

// Dal body del webhook del lettore si estrae SOLO l'identificativo:
// l'esito si verifica sempre via Transactions API, mai dal payload.
function parseReaderWebhookBody(body) {
  const id =
    body?.payload?.client_transaction_id ||
    body?.client_transaction_id ||
    body?.data?.client_transaction_id ||
    null
  return { clientTransactionId: id }
}

// Dal body del webhook del checkout online: solo id/reference.
function parseCheckoutWebhookBody(body) {
  return {
    checkoutId: body?.payload?.checkout_id || body?.checkout_id || body?.id || null,
    reference:
      body?.payload?.reference || body?.checkout_reference || body?.reference || null,
  }
}

module.exports = {
  isServed,
  orderDue,
  eurosToCents,
  buildCheckoutPayload,
  buildReaderCheckoutPayload,
  mapCheckoutStatus,
  mapTransactionStatus,
  decidePaymentPatch,
  groupOrderPaidPatch,
  decideAutoAdvance,
  parseReaderWebhookBody,
  parseCheckoutWebhookBody,
}
