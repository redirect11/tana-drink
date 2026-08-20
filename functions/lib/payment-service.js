'use strict'

// Servizio pagamenti SumUp (checkout online). Dipendenze iniettate:
//   db            — Firestore admin
//   paymentsFetch — fetch autenticato su api.sumup.com (path, options)
//   isConfigured  — () => bool (API key + merchant code presenti)
//   merchantCode  — () => string
//   now           — () => ISO string
// Gli errori sono { code, message } compatibili con HttpsError.

const {
  buildCheckoutPayload,
  buildReaderCheckoutPayload,
  mapCheckoutStatus,
  mapTransactionStatus,
  decidePaymentPatch,
  groupOrderPaidPatch,
  orderDue,
} = require('./payment-core')

// Chi può incassare (tutto il personale) e chi configura il lettore
// (chi sta al banco). L'admin fa quello che fa il bartender: lasciarlo
// fuori vorrebbe dire non poter nemmeno passare una carta.
const STAFF_ROLES = ['admin', 'bartender', 'staff']
const BANCO = ['admin', 'bartender']

function err(code, message) {
  return { code, message }
}

async function getOrder(db, orderId) {
  if (!orderId) throw err('invalid-argument', 'orderId obbligatorio.')
  const ref = db.collection('orders').doc(orderId)
  const snap = await ref.get()
  if (!snap.exists) throw err('not-found', 'Ordine non trovato.')
  return { ref, order: snap.data() }
}

// Crea (o riusa) il checkout online per un ordine. Idempotente:
// - già pagato → { alreadyPaid: true }
// - checkout PENDING con lo stesso importo → riusato
// - checkout FAILED o importo cambiato → se ne crea uno nuovo
async function createCheckout(deps, { orderId } = {}) {
  const { db, paymentsFetch, isConfigured, merchantCode, now } = deps
  if (!isConfigured()) return { unavailable: true }

  const { ref, order } = await getOrder(db, orderId)
  if (order.status === 'annullato') {
    throw err('failed-precondition', 'Ordine annullato: niente da pagare.')
  }
  if (order.payment_status === 'pagato') return { alreadyPaid: true }

  // Checkout esistente: verifica se è riusabile.
  if (order.sumup_checkout_id) {
    const existing = await paymentsFetch(`/v0.1/checkouts/${order.sumup_checkout_id}`)
    if (existing?.status === 'PAID') {
      const patch = decidePaymentPatch(order, {
        status: 'pagato',
        transactionId: existing.transaction_id || null,
        now: now(),
      })
      if (patch) await ref.update(patch)
      return { alreadyPaid: true }
    }
    const sameAmount =
      Math.abs(Number(existing?.amount || 0) - Number(order.total || 0)) < 0.005
    if (existing?.status === 'PENDING' && sameAmount) {
      return { checkoutId: order.sumup_checkout_id }
    }
    // FAILED o importo cambiato: si prosegue creando un nuovo checkout.
  }

  const attempts = Number(order.sumup_checkout_attempts || 0) + (order.sumup_checkout_id ? 1 : 0)
  const payload = buildCheckoutPayload({
    orderId,
    attempts,
    total: order.total,
    merchantCode: merchantCode(),
    description: `Ordine #${order.daily_number ?? '—'} — La Tana del Coniglio`,
  })
  const created = await paymentsFetch('/v0.1/checkouts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!created?.id) throw err('internal', 'SumUp non ha restituito un checkout valido.')

  await ref.update({
    sumup_checkout_id: created.id,
    sumup_checkout_attempts: attempts,
    payment_method: 'online',
    payment_status: 'in_attesa',
  })
  return { checkoutId: created.id }
}

// Verifica lo stato del checkout via API (fonte di verità: chiamata dal
// client dopo l'esito del widget; il webhook è solo cintura) e applica
// la patch sull'ordine.
async function verifyCheckoutStatus(deps, { orderId } = {}) {
  const { db, paymentsFetch, isConfigured, now } = deps
  if (!isConfigured()) return { unavailable: true }

  const { ref, order } = await getOrder(db, orderId)
  if (!order.sumup_checkout_id) return { status: order.payment_status }
  if (order.payment_status === 'pagato') return { status: 'pagato' }

  const checkout = await paymentsFetch(`/v0.1/checkouts/${order.sumup_checkout_id}`)
  const status = mapCheckoutStatus(checkout?.status)
  if (status !== order.payment_status) {
    const patch = decidePaymentPatch(order, {
      status,
      transactionId: checkout?.transaction_id || checkout?.transaction_code || null,
      now: now(),
    })
    if (patch) await ref.update(patch)
  }
  return { status }
}

// Webhook del checkout online: trova l'ordine dal checkout id e
// ri-verifica SEMPRE via API (mai fidarsi del payload).
async function handleOnlineWebhook(deps, { checkoutId } = {}) {
  const { db, isConfigured } = deps
  if (!isConfigured() || !checkoutId) return { status: 200 }

  const snap = await db
    .collection('orders')
    .where('sumup_checkout_id', '==', checkoutId)
    .limit(1)
    .get()
  if (!snap.empty) {
    await verifyCheckoutStatus(deps, { orderId: snap.docs[0].id })
    return { status: 200 }
  }

  // Non è un ordine singolo: forse è un pagamento di gruppo.
  const psnap = await db
    .collection('payments')
    .where('sumup_checkout_id', '==', checkoutId)
    .limit(1)
    .get()
  if (!psnap.empty) {
    await verifyGroupPayment(deps, { paymentId: psnap.docs[0].id })
  }
  return { status: 200 }
}

// ── Lettore SumUp Solo (Cloud API) ──────────────────────────────────

function requireRole(auth, roles) {
  const role = auth?.token?.role
  if (!roles.includes(role)) {
    throw err('permission-denied', 'Operazione riservata allo staff.')
  }
}

async function readerSettings(db) {
  const snap = await db.collection('settings').doc('bar').get()
  return snap.exists ? snap.data() : {}
}

// Associa il lettore: il codice si genera dal menu API del lettore Solo.
async function pairReader(deps, auth, { pairing_code } = {}) {
  const { db, paymentsFetch, isConfigured, merchantCode } = deps
  requireRole(auth, BANCO)
  if (!isConfigured()) return { unavailable: true }
  const code = String(pairing_code || '').trim().toUpperCase()
  if (!code) throw err('invalid-argument', 'Inserisci il codice di pairing.')

  let reader
  try {
    reader = await paymentsFetch(`/v0.1/merchants/${merchantCode()}/readers`, {
      method: 'POST',
      body: JSON.stringify({ pairing_code: code }),
    })
  } catch (e) {
    if (e?.status === 422 || e?.status === 400 || e?.status === 404) {
      throw err('invalid-argument', 'Codice non valido o scaduto: rigeneralo dal lettore.')
    }
    throw e
  }
  if (!reader?.id) throw err('internal', 'SumUp non ha restituito un lettore valido.')

  await db.collection('settings').doc('bar').set(
    {
      sumup_reader_id: reader.id,
      sumup_reader_name: reader.name || 'Lettore SumUp',
    },
    { merge: true }
  )
  return { id: reader.id, name: reader.name || 'Lettore SumUp' }
}

// Dissocia il lettore (best-effort lato SumUp, azzera sempre i settings).
async function unpairReader(deps, auth) {
  const { db, paymentsFetch, isConfigured, merchantCode } = deps
  requireRole(auth, BANCO)
  const settings = await readerSettings(db)
  if (settings.sumup_reader_id && isConfigured()) {
    await paymentsFetch(
      `/v0.1/merchants/${merchantCode()}/readers/${settings.sumup_reader_id}`,
      { method: 'DELETE' }
    ).catch(() => {})
  }
  await db.collection('settings').doc('bar').set(
    { sumup_reader_id: null, sumup_reader_name: null },
    { merge: true }
  )
  return { ok: true }
}

// Sveglia il lettore con l'importo dell'ordine: il cliente paga lì,
// l'esito arriva via webhook (return_url) e viene verificato via API.
// `amount` (euro) opzionale per gli incassi PARZIALI (split del conto):
// se assente si incassa tutto il residuo (totale − sconti − già pagato).
// `sconto` è quello preparato dalla schermata per QUESTE righe: arriva col
// gesto perché la sua scrittura sul conto parte in sottofondo e qui si
// leggerebbe il documento di un istante prima — quello senza sconto (BUG-046).
async function readerCheckout(deps, auth, { orderId, amount = null, items = null, sconto = null } = {}) {
  const { db, paymentsFetch, isConfigured, merchantCode, webhookUrl } = deps
  requireRole(auth, STAFF_ROLES)
  if (!isConfigured()) return { unavailable: true }

  const settings = await readerSettings(db)
  if (!settings.sumup_reader_id) {
    throw err('failed-precondition', 'Nessun lettore associato: fai il pairing dalle impostazioni.')
  }

  const { ref, order } = await getOrder(db, orderId)
  if (order.status === 'annullato') {
    throw err('failed-precondition', 'Ordine annullato: niente da incassare.')
  }
  if (order.payment_status === 'pagato') {
    throw err('failed-precondition', 'Ordine già pagato.')
  }

  const scontoOra = sconto && Number(sconto.amount) > 0 ? sconto : null
  const due = orderDue(scontoOra ? { ...order, discount_amount: scontoOra.amount } : order)
  if (!(due > 0)) {
    throw err('failed-precondition', 'Niente da incassare: residuo a zero.')
  }
  const toCharge = amount == null ? due : Math.round(Number(amount) * 100) / 100
  if (!(toCharge > 0) || toCharge > due + 0.005) {
    throw err('invalid-argument', 'Importo non valido rispetto al residuo del conto.')
  }

  const payload = buildReaderCheckoutPayload({
    total: toCharge,
    description: `Ordine #${order.daily_number ?? '—'} — La Tana del Coniglio`,
    returnUrl: webhookUrl(),
    affiliate: typeof deps.affiliate === 'function' ? deps.affiliate() : null,
    orderId,
  })

  let res
  try {
    res = await paymentsFetch(
      `/v0.1/merchants/${merchantCode()}/readers/${settings.sumup_reader_id}/checkout`,
      { method: 'POST', body: JSON.stringify(payload) }
    )
  } catch (e) {
    if (e?.status === 404) {
      throw err('not-found', 'Lettore non associato: rifai il pairing dalle impostazioni.')
    }
    if (e?.status === 422) {
      throw err('unavailable', 'Lettore spento o senza Wi-Fi: controllalo e riprova.')
    }
    throw e
  }

  const clientTransactionId = res?.data?.client_transaction_id || null
  if (!clientTransactionId) {
    throw err('internal', 'SumUp non ha avviato la transazione sul lettore.')
  }

  await ref.update({
    payment_method: 'lettore',
    payment_status: 'in_attesa',
    sumup_client_transaction_id: clientTransactionId,
    // Importo in volo sul lettore: il webhook lo registra come pagamento
    // (parziale o a saldo) quando la transazione va a buon fine.
    sumup_pending_amount: toCharge,
    sumup_pending_items: Array.isArray(items) && items.length ? items : null,
    // Lo sconto preparato per QUESTA riscossione viaggia col pagamento: il
    // webhook lo scrive dentro l'incasso e lo toglie dal conto.
    sumup_pending_sconto: scontoOra,
  })
  return { clientTransactionId }
}

// Annulla la transazione in corso sul lettore.
async function readerTerminate(deps, auth, { orderId } = {}) {
  const { db, paymentsFetch, isConfigured, merchantCode } = deps
  requireRole(auth, STAFF_ROLES)
  if (!isConfigured()) return { unavailable: true }

  const settings = await readerSettings(db)
  const { ref, order } = await getOrder(db, orderId)

  if (settings.sumup_reader_id) {
    await paymentsFetch(
      `/v0.1/merchants/${merchantCode()}/readers/${settings.sumup_reader_id}/terminate`,
      { method: 'POST' }
    ).catch(() => {})
  }
  if (order.payment_status === 'in_attesa' && order.payment_method === 'lettore') {
    await ref.update({
      payment_status: (order.payments || []).length ? 'parziale' : 'fallito',
      payment_method: null,
      sumup_pending_amount: null,
      sumup_pending_items: null,
      sumup_pending_sconto: null,
    })
  }
  return { ok: true }
}

// Webhook del lettore: dal payload SOLO il client_transaction_id;
// l'esito si legge dalla Transactions API.
async function handleReaderWebhook(deps, { clientTransactionId } = {}) {
  const { db, paymentsFetch, isConfigured, now } = deps
  if (!isConfigured() || !clientTransactionId) return { status: 200 }

  const snap = await db
    .collection('orders')
    .where('sumup_client_transaction_id', '==', clientTransactionId)
    .limit(1)
    .get()

  // Verifica l'esito reale dalla Transactions API (mai dal payload).
  const tx = await paymentsFetch(
    `/v0.1/me/transactions?client_transaction_id=${encodeURIComponent(clientTransactionId)}`
  ).catch(() => null)
  if (!tx) return { status: 200 }
  const status = mapTransactionStatus(tx.status)
  if (status === 'in_attesa') return { status: 200 }
  const txId = tx.id || tx.transaction_code || null

  if (!snap.empty) {
    const orderSnap = snap.docs[0]
    const patch = decidePaymentPatch(orderSnap.data(), { status, transactionId: txId, now: now() })
    if (patch) await orderSnap.ref.update(patch)
    return { status: 200 }
  }

  // Non è un ordine singolo: forse un pagamento di gruppo sul lettore.
  const psnap = await db
    .collection('payments')
    .where('sumup_client_transaction_id', '==', clientTransactionId)
    .limit(1)
    .get()
  if (!psnap.empty && status === 'pagato') {
    await settleGroupPayment(deps, psnap.docs[0].id, { transactionId: txId })
  }
  return { status: 200 }
}

// ── Pagamento di un GRUPPO (multi-ordine) via SumUp ──────────────────
// Il documento `payments` (pre-creato dal client, status 'in_attesa')
// porta l'importo e gli order_ids: il checkout SumUp è su quell'importo
// e alla conferma si saldano tutti gli ordini elencati.

async function getPaymentDoc(db, paymentId) {
  if (!paymentId) throw err('invalid-argument', 'paymentId obbligatorio.')
  const ref = db.collection('payments').doc(paymentId)
  const snap = await ref.get()
  if (!snap.exists) throw err('not-found', 'Pagamento non trovato.')
  return { ref, payment: snap.data() }
}

// Salda un pagamento di gruppo: marca pagato il payment e tutti i suoi
// ordini (sequenziale, idempotente: salta quelli già pagati).
async function settleGroupPayment(deps, paymentId, { transactionId = null } = {}) {
  const { db, now } = deps
  const { ref, payment } = await getPaymentDoc(db, paymentId)
  if (payment.status === 'pagato') return
  const nowIso = now()
  for (const oid of payment.order_ids || []) {
    const oref = db.collection('orders').doc(oid)
    const osnap = await oref.get()
    if (!osnap.exists) continue
    const patch = groupOrderPaidPatch(osnap.data(), {
      method: payment.method || 'online',
      paymentId,
      now: nowIso,
    })
    if (patch) await oref.update(patch)
  }
  await ref.update({
    status: 'pagato',
    paid_at: nowIso,
    ...(transactionId ? { sumup_transaction_id: transactionId } : {}),
  })
}

// Checkout online sull'importo del pagamento di gruppo. Idempotente.
async function createGroupCheckout(deps, { paymentId } = {}) {
  const { db, paymentsFetch, isConfigured, merchantCode } = deps
  if (!isConfigured()) return { unavailable: true }
  const { ref, payment } = await getPaymentDoc(db, paymentId)
  if (payment.status === 'pagato') return { alreadyPaid: true }

  if (payment.sumup_checkout_id) {
    const existing = await paymentsFetch(`/v0.1/checkouts/${payment.sumup_checkout_id}`)
    if (existing?.status === 'PAID') {
      await settleGroupPayment(deps, paymentId, { transactionId: existing.transaction_id || null })
      return { alreadyPaid: true }
    }
    if (existing?.status === 'PENDING') return { checkoutId: payment.sumup_checkout_id }
  }

  const created = await paymentsFetch('/v0.1/checkouts', {
    method: 'POST',
    body: JSON.stringify(
      buildCheckoutPayload({
        orderId: paymentId,
        total: payment.amount,
        merchantCode: merchantCode(),
        description: 'Conto gruppo — La Tana del Coniglio',
      })
    ),
  })
  if (!created?.id) throw err('internal', 'SumUp non ha restituito un checkout valido.')
  await ref.update({ sumup_checkout_id: created.id })
  return { checkoutId: created.id }
}

// Verifica via API lo stato del checkout di gruppo e salda se PAID.
async function verifyGroupPayment(deps, { paymentId } = {}) {
  const { db, paymentsFetch, isConfigured } = deps
  if (!isConfigured()) return { unavailable: true }
  const { payment } = await getPaymentDoc(db, paymentId)
  if (payment.status === 'pagato') return { status: 'pagato' }
  if (!payment.sumup_checkout_id) return { status: payment.status }
  const checkout = await paymentsFetch(`/v0.1/checkouts/${payment.sumup_checkout_id}`)
  const status = mapCheckoutStatus(checkout?.status)
  if (status === 'pagato') {
    await settleGroupPayment(deps, paymentId, {
      transactionId: checkout?.transaction_id || checkout?.transaction_code || null,
    })
  }
  return { status }
}

// Incasso del conto di gruppo sul lettore SumUp.
async function groupReaderCheckout(deps, auth, { paymentId } = {}) {
  const { db, paymentsFetch, isConfigured, merchantCode, webhookUrl } = deps
  requireRole(auth, STAFF_ROLES)
  if (!isConfigured()) return { unavailable: true }
  const settings = await readerSettings(db)
  if (!settings.sumup_reader_id) {
    throw err('failed-precondition', 'Nessun lettore associato: fai il pairing dalle impostazioni.')
  }
  const { ref, payment } = await getPaymentDoc(db, paymentId)
  if (payment.status === 'pagato') throw err('failed-precondition', 'Conto già pagato.')

  let res
  try {
    res = await paymentsFetch(
      `/v0.1/merchants/${merchantCode()}/readers/${settings.sumup_reader_id}/checkout`,
      {
        method: 'POST',
        body: JSON.stringify(
          buildReaderCheckoutPayload({
            total: payment.amount,
            description: 'Conto gruppo — La Tana del Coniglio',
            returnUrl: webhookUrl(),
            affiliate: typeof deps.affiliate === 'function' ? deps.affiliate() : null,
            orderId: paymentId,
          })
        ),
      }
    )
  } catch (e) {
    if (e?.status === 404) throw err('not-found', 'Lettore non associato: rifai il pairing.')
    if (e?.status === 422) throw err('unavailable', 'Lettore spento o senza Wi-Fi.')
    throw e
  }
  const clientTransactionId = res?.data?.client_transaction_id || null
  if (!clientTransactionId) throw err('internal', 'SumUp non ha avviato la transazione sul lettore.')
  await ref.update({ payment_method: 'lettore', sumup_client_transaction_id: clientTransactionId })
  return { clientTransactionId }
}

module.exports = {
  createCheckout,
  verifyCheckoutStatus,
  handleOnlineWebhook,
  pairReader,
  unpairReader,
  readerCheckout,
  readerTerminate,
  handleReaderWebhook,
  createGroupCheckout,
  verifyGroupPayment,
  groupReaderCheckout,
  settleGroupPayment,
  getPaymentDoc,
}
