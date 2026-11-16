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

// Conto pagato ⇒ tutte le comande risultano SERVITE ('ritirato'); le
// annullate restano annullate (specchio di serveAllComande lato client).
function serveComande(comande, now) {
  return comande.map((c) =>
    !c || c.status === 'annullato' || c.status === 'ritirato'
      ? c
      : { ...c, status: 'ritirato', status_times: { ...(c.status_times || {}), ritirato: now } }
  )
}

// GLI SCONTI DI UN CONTO SONO PIÙ D'UNO. Ognuno viaggia dentro la riscossione
// che se l'è portato via (`payments[].sconto`); sul conto resta solo quello
// preparato per il prossimo incasso (`discount_amount`). Su un conto vecchio
// non c'è nessuno sconto dentro i pagamenti e il conto torna quello di prima.
// Stessa aritmetica di src/lib/pagamento.js lato client.
function scontoConsumato(order) {
  const somma = (order?.payments || []).reduce(
    (s, p) => s + (Number(p?.sconto?.amount) || 0),
    0
  )
  return Math.round(somma * 100) / 100
}

function scontoTotale(order) {
  return Math.round((scontoConsumato(order) + (Number(order?.discount_amount) || 0)) * 100) / 100
}

// Residuo del conto: totale − sconti − pagamenti parziali già registrati.
function orderDue(order) {
  const paid = (order?.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const due = (Number(order?.total) || 0) - scontoTotale(order) - paid
  return Math.max(0, Math.round(due * 100) / 100)
}

// L'IMPORTO IN VOLO SUL LETTORE, azzerato: importo, righe e sconto della
// riscossione partita. Viaggiano sempre insieme — lo sconto è arrivato
// dopo, e ogni posto che li azzera va tenuto uguale: chi ne salta uno lascia
// uno sconto o delle righe «in volo» su un conto chiuso.
const NIENTE_IN_VOLO = Object.freeze({
  sumup_pending_amount: null,
  sumup_pending_items: null,
  sumup_pending_sconto: null,
})

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
      ...NIENTE_IN_VOLO,
    }
  }
  if (status !== 'pagato') return null

  const pending = Number(order?.sumup_pending_amount)
  if (pending > 0) {
    // LO SCONTO SI CONSUMA QUI, come per il contante. La schermata l'aveva
    // preparato sulle righe che sta riscuotendo e l'ha messo in volo insieme
    // all'importo: adesso entra nel pagamento e sul conto non resta niente di
    // preparato, se no il prossimo incasso se lo ritroverebbe addosso.
    const sconto = order?.sumup_pending_sconto || null
    const consumato = sconto && Number(sconto.amount) > 0 ? sconto : null
    const payments = [
      ...(order?.payments || []),
      {
        id: `pay-${now}`,
        amount: pending,
        method: 'lettore',
        items: order?.sumup_pending_items || null,
        at: now,
        ...(consumato ? { sconto: consumato } : {}),
        ...(transactionId ? { transaction_id: transactionId } : {}),
      },
    ]
    const scontoConsumatoOra = consumato
      ? { discount: null, discount_amount: 0, discount_items: null }
      : {}
    const residuo = orderDue({ ...order, ...scontoConsumatoOra, payments })
    if (residuo > 0.005) {
      return {
        payments,
        ...scontoConsumatoOra,
        payment_status: 'parziale',
        ...NIENTE_IN_VOLO,
        sumup_client_transaction_id: null,
      }
    }
    const patch = {
      payments,
      ...scontoConsumatoOra,
      payment_status: 'pagato',
      payment_method: payments.every((p) => p.method === 'lettore') ? 'lettore' : 'misto',
      paid_at: now,
      ...NIENTE_IN_VOLO,
    }
    if (transactionId) patch.sumup_transaction_id = transactionId
    if (order?.status === 'annullato') {
      patch.payment_after_cancel = true
    } else {
      // Il saldo dal POS chiude il conto: le comande ancora in lavorazione
      // risultano SERVITE (stessa regola del pagamento in contanti).
      patch.status = 'pagato'
      patch['status_times.pagato'] = now
      if (Array.isArray(order?.comande)) {
        patch.comande = serveComande(order.comande, now)
        patch.comande_statuses = [...new Set(patch.comande.map((c) => c?.status).filter(Boolean))]
      }
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

// UN ESITO DEL LETTORE SI APPLICA UNA VOLTA SOLA (BUG-162). SumUp ritenta
// una notifica non riuscita dopo 1, 5, 20 minuti e 2 ore, e una Function
// lenta o un'istanza piena bastano a farla rimandare: lo stesso esito può
// arrivare più volte, anche ore dopo. E il conto tiene il suo
// `sumup_client_transaction_id` anche dopo, perché un incasso in contanti
// non lo toglie: un «fallito» rimandato ritrovava il conto già pagato in
// contanti e lo riportava a «parziale».
//   · «fallito» vale solo per un conto che aspetta ancora il lettore;
//   · «pagato» non si riapplica se quella transazione è già fra gli
//     incassi del conto — ma si applica anche dopo un annullo dal banco:
//     se SumUp dice che i soldi sono stati presi, il conto risulta pagato.
//     (Con acconti già presi, in quel caso l'importo non entra negli
//     incassi: l'annullo ha azzerato quello in volo. Limite di prima.)
function esitoLettoreDaApplicare(order, { status, transactionId = null } = {}) {
  if (!order) return false
  if (status === 'fallito') {
    return order.payment_status === 'in_attesa' && order.payment_method === 'lettore'
  }
  if (status !== 'pagato') return false
  if (transactionId) {
    const giaIncassata =
      order.sumup_transaction_id === transactionId ||
      (order.payments || []).some((p) => p?.transaction_id === transactionId)
    return !giaIncassata
  }
  // Senza l'id della transazione: un conto già pagato e senza importo in
  // volo non ha niente da ricevere.
  return order.payment_status !== 'pagato' || Number(order.sumup_pending_amount) > 0
}

module.exports = {
  isServed,
  orderDue,
  serveComande,
  eurosToCents,
  buildCheckoutPayload,
  buildReaderCheckoutPayload,
  mapCheckoutStatus,
  mapTransactionStatus,
  decidePaymentPatch,
  esitoLettoreDaApplicare,
  NIENTE_IN_VOLO,
  groupOrderPaidPatch,
  decideAutoAdvance,
  parseReaderWebhookBody,
  parseCheckoutWebhookBody,
}
