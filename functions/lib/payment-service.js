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
  mapCheckoutStatus,
  decidePaymentPatch,
} = require('./payment-core')

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
  if (snap.empty) return { status: 200 }

  await verifyCheckoutStatus(deps, { orderId: snap.docs[0].id })
  return { status: 200 }
}

module.exports = { createCheckout, verifyCheckoutStatus, handleOnlineWebhook }
