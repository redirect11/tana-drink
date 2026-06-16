'use strict'

// SumUp POS Pro (Goodtill) External Sale API — proxy server-side.
// Le credenziali non devono mai essere esposte lato client.
//
// Configura le variabili prima del deploy:
//   firebase functions:secrets:set SUMUP_VENDOR_ID
//   firebase functions:secrets:set SUMUP_OUTLET_ID
//
// L'URL base e il formato esatto dei payload vanno verificati con SumUp support
// dopo aver ricevuto il Vendor-Id: pos.support.uk.ie@sumup.com
//
// Questo file è solo il "wiring" Firebase: la logica vive in lib/sumup-core.js
// (puro) e lib/sumup-service.js (servizio), entrambi coperti da test.

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https')
const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore')
const { defineSecret } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')
const { getAuth } = require('firebase-admin/auth')

const { buildSumupHeaders, buildSumupUrl } = require('./lib/sumup-core')
const { syncProducts, createSale, updateSaleStatus, handleWebhook } = require('./lib/sumup-service')
const {
  decideOrderPush,
  decideStaffCallPush,
  decideStaffServePush,
  decideNewOrderStaffPush,
} = require('./lib/push-core')
const { staffAdmin } = require('./lib/staff-service')
const {
  createCheckout,
  verifyCheckoutStatus,
  handleOnlineWebhook,
  pairReader,
  unpairReader,
  readerCheckout: readerCheckoutSvc,
  readerTerminate: readerTerminateSvc,
  handleReaderWebhook,
  createGroupCheckout,
  verifyGroupPayment,
  groupReaderCheckout: groupReaderCheckoutSvc,
} = require('./lib/payment-service')
const {
  decideAutoAdvance,
  parseCheckoutWebhookBody,
  parseReaderWebhookBody,
} = require('./lib/payment-core')

initializeApp()
const db = getFirestore()

// Configurazione SumUp via variabili d'ambiente della function (vuote = no-op).
// Si usano variabili d'ambiente e non i param (defineString) perché un default
// vuoto non viene serializzato nel manifest e bloccherebbe il deploy
// non-interattivo. Per attivare SumUp: valorizza SUMUP_VENDOR_ID / SUMUP_OUTLET_ID
// (es. in functions/.env oppure come secret) e ridepl.
const SUMUP_VENDOR_ID = process.env.SUMUP_VENDOR_ID || ''
const SUMUP_OUTLET_ID = process.env.SUMUP_OUTLET_ID || ''

// URL base da confermare con SumUp support al momento del rilascio del Vendor-Id.
// Goodtill (il sistema dietro SumUp POS Pro) usa tipicamente:
//   https://api.thegoodtill.com/api
// Potrebbe anche essere un endpoint dedicato SumUp — verificare via email.
const SUMUP_API_BASE = process.env.SUMUP_API_BASE || 'https://api.thegoodtill.com/api'

const OPTS = { region: 'europe-west1' }

function isSumUpConfigured() {
  return Boolean(SUMUP_VENDOR_ID && SUMUP_OUTLET_ID)
}

async function sumupFetch(path, options = {}) {
  const url = buildSumupUrl(SUMUP_API_BASE, path)
  const headers = buildSumupHeaders(SUMUP_VENDOR_ID, SUMUP_OUTLET_ID)
  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new HttpsError('internal', `SumUp API ${res.status} su ${path}: ${text}`)
  }
  return text ? JSON.parse(text) : null
}

// Dipendenze iniettate nei servizi. In test vengono sostituite da mock.
const deps = {
  db,
  sumupFetch,
  isConfigured: isSumUpConfigured,
  serverTimestamp: () => FieldValue.serverTimestamp(),
}

// ── Sincronizza prodotti SumUp → Firestore ────────────────────────────────────
exports.syncSumUpProducts = onCall(OPTS, () => syncProducts(deps))

// ── Invia ordine a SumUp POS Pro ──────────────────────────────────────────────
// Chiamata dopo createOrder su Firestore. L'ID della vendita SumUp viene
// salvato sull'ordine Firebase per consentire aggiornamenti di stato futuri.
exports.createSumUpSale = onCall(OPTS, (request) => createSale(deps, request.data))

// ── Aggiorna stato vendita su SumUp POS Pro ───────────────────────────────────
exports.updateSumUpSaleStatus = onCall(OPTS, (request) => updateSaleStatus(deps, request.data))

// ── Webhook in entrata da SumUp POS Pro ───────────────────────────────────────
// Quando il bartender cambia stato su SumUp POS Pro, questo endpoint aggiorna
// l'ordine corrispondente su Firestore (e quindi in tempo reale sul cliente).
//
// Configura l'URL nel Back Office di SumUp POS Pro:
//   Impostazioni → Integrazioni → Webhook
//   URL: https://europe-west1-<project-id>.cloudfunctions.net/sumupWebhook
exports.sumupWebhook = onRequest({ ...OPTS, cors: false }, async (req, res) => {
  const { status, body } = await handleWebhook(deps, { method: req.method, body: req.body })
  res.status(status).send(body)
})

// ── Gestione utenze staff (solo bartender) ────────────────────────────────────
// Crea/elenca/modifica/elimina gli account dello staff con il ruolo
// (custom claim). La logica vive in lib/staff-service.js (testata).
exports.staffAdmin = onCall(OPTS, async (request) => {
  try {
    return await staffAdmin(getAuth(), request.auth, request.data)
  } catch (e) {
    if (e?.code && e?.message) throw new HttpsError(e.code, e.message)
    throw new HttpsError('internal', e?.message || 'Errore interno.')
  }
})

// ── Notifiche push al cliente (FCM) ───────────────────────────────────────────
// Quando un ordine passa a "pronto" (drink pronto) o ad "annullato" da parte
// del bartender con notifica richiesta, invia una push al dispositivo del
// cliente (token salvato sull'ordine alla creazione). La decisione su cosa
// inviare vive in lib/push-core.js (pura, testata).
exports.notifyOrderUpdate = onDocumentUpdated({ ...OPTS, document: 'orders/{orderId}' }, async (event) => {
  const before = event.data?.before?.data()
  const after = event.data?.after?.data()

  // 1) Push al cliente (drink pronto / ordine annullato).
  const msg = decideOrderPush(before, after)
  if (msg) {
    try {
      await getMessaging().send({
        token: after.push_token,
        notification: { title: msg.title, body: msg.body },
        data: { url: `/ordine/${event.params.orderId}` },
        webpush: {
          fcmOptions: { link: `/ordine/${event.params.orderId}` },
          notification: { icon: '/logo.png', badge: '/logo.png' },
        },
      })
    } catch (e) {
      // Token scaduto/non valido: rimuovilo dall'ordine, niente retry.
      if (e?.code === 'messaging/registration-token-not-registered') {
        await event.data.after.ref.update({ push_token: null }).catch(() => {})
      } else {
        console.error('[push] invio fallito:', e?.message || e)
      }
    }
  }

  // 2) Push allo staff al bancone quando un ordine in attesa di pagamento
  //    obbligatorio viene saldato ed entra in coda (è "nuovo" per la cucina).
  const newOrderMsg = decideNewOrderStaffPush(before, after)
  if (newOrderMsg) {
    await pushToStaff({ kind: 'new_order', orderId: event.params.orderId, msg: newOrderMsg })
  }

  // 3) Push allo staff di sala quando c'è un ordine pronto da servire
  //    al tavolo (tutti i dispositivi registrati in staff_tokens).
  const serveMsg = decideStaffServePush(before, after)
  if (serveMsg) {
    await pushToStaff({ kind: 'staff_serve', orderId: event.params.orderId, msg: serveMsg })
  }
})

// Invia una push data-only a TUTTI i dispositivi staff registrati
// (staff_tokens). La notifica vera (titolo/corpo/vibrazione) la costruisce il
// service worker dal campo `kind`, così arriva anche ad app in background o
// chiusa. Rimuove in automatico i token scaduti.
async function pushToStaff({ kind, orderId, msg, url = '/bar' }) {
  const tokensSnap = await db.collection('staff_tokens').get()
  const docs = tokensSnap.docs.filter((d) => d.get('token'))
  if (docs.length === 0) return

  const res = await getMessaging().sendEachForMulticast({
    tokens: docs.map((d) => d.get('token')),
    data: { kind, order_id: orderId, title: msg.title, body: msg.body, url },
    webpush: { headers: { Urgency: 'high', TTL: '600' } },
  })

  await Promise.all(
    res.responses.map((r, i) =>
      r.error?.code === 'messaging/registration-token-not-registered'
        ? docs[i].ref.delete().catch(() => {})
        : null
    )
  )
}

// ── Push nuovo ordine allo staff (FCM) ────────────────────────────────────────
// Quando arriva un ordine, avvisa tutti i dispositivi al bancone: è l'unico
// modo per ricevere l'avviso a schermo bloccato / app in background su iPad
// (lì il listener realtime della pagina è sospeso dal sistema). Gli ordini con
// pagamento obbligatorio non ancora saldato NON si notificano qui: lo farà
// notifyOrderUpdate quando risulteranno pagati.
exports.notifyNewOrder = onDocumentCreated({ ...OPTS, document: 'orders/{orderId}' }, async (event) => {
  const after = event.data?.data()
  const msg = decideNewOrderStaffPush(null, after)
  if (!msg) return
  await pushToStaff({ kind: 'new_order', orderId: event.params.orderId, msg })
})

// ── Push cerca-persone allo staff (FCM) ───────────────────────────────────────
// Quando il bartender crea una chiamata, invia una push al dispositivo del
// membro dello staff chiamato (token in staff_tokens/{uid}, registrato
// quando lo staff apre il gestionale). Messaggio data-only: la notifica
// con vibrazione la costruisce il service worker, così arriva anche con
// l'app in background o chiusa.
exports.notifyStaffCall = onDocumentCreated({ ...OPTS, document: 'staff_calls/{callId}' }, async (event) => {
  const call = event.data?.data()
  const msg = decideStaffCallPush(call)
  if (!msg) return

  const tokenSnap = await db.doc(`staff_tokens/${call.to_uid}`).get()
  const token = tokenSnap.get('token')
  if (!token) return

  try {
    await getMessaging().send({
      token,
      data: {
        kind: 'staff_call',
        title: msg.title,
        body: msg.body,
        url: '/bar',
      },
      webpush: {
        // Consegna immediata: la chiamata ha senso solo nel momento.
        headers: { Urgency: 'high', TTL: '180' },
      },
    })
  } catch (e) {
    if (e?.code === 'messaging/registration-token-not-registered') {
      await db.doc(`staff_tokens/${call.to_uid}`).delete().catch(() => {})
    } else {
      console.error('[push staff] invio fallito:', e?.message || e)
    }
  }
})

// ── Pagamenti SumUp (checkout online + lettore) ───────────────────────────────
// La chiave API è un secret runtime (firebase functions:secrets:set
// SUMUP_API_KEY); il merchant code non è segreto e vive in functions/.env.
// Senza configurazione le funzioni rispondono { unavailable: true }.
const SUMUP_API_KEY = defineSecret('SUMUP_API_KEY')
const SUMUP_MERCHANT_CODE = process.env.SUMUP_MERCHANT_CODE || ''
const SUMUP_PAYMENTS_BASE = process.env.SUMUP_PAYMENTS_BASE || 'https://api.sumup.com'
// Affiliate key: obbligatoria per il checkout sul lettore (Cloud API).
// Non è un segreto (identifica l'app, non autentica): vive in .env.
const SUMUP_AFFILIATE_KEY = process.env.SUMUP_AFFILIATE_KEY || ''
const SUMUP_AFFILIATE_APP_ID = process.env.SUMUP_AFFILIATE_APP_ID || 'it.latanadelconiglio.drink'

function paymentDeps() {
  const apiKey = SUMUP_API_KEY.value() || ''
  return {
    db,
    isConfigured: () => Boolean(apiKey && SUMUP_MERCHANT_CODE),
    merchantCode: () => SUMUP_MERCHANT_CODE,
    now: () => new Date().toISOString(),
    webhookUrl: () =>
      `https://${OPTS.region}-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/paymentWebhook`,
    affiliate: () =>
      SUMUP_AFFILIATE_KEY
        ? { app_id: SUMUP_AFFILIATE_APP_ID, key: SUMUP_AFFILIATE_KEY }
        : null,
    paymentsFetch: async (path, options = {}) => {
      const res = await fetch(`${SUMUP_PAYMENTS_BASE}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      })
      const text = await res.text()
      if (!res.ok) {
        const e = new Error(`SumUp ${res.status} su ${path}: ${text}`)
        e.status = res.status
        throw e
      }
      return text ? JSON.parse(text) : null
    },
  }
}

function toHttpsError(e) {
  if (e?.code && e?.message && typeof e.code === 'string') {
    return new HttpsError(e.code, e.message)
  }
  return new HttpsError('internal', e?.message || 'Errore interno.')
}

// Checkout online: chiamabile anche da clienti anonimi (l'id ordine fa
// da capability token, come per la pagina ordine pubblica).
exports.createPaymentCheckout = onCall({ ...OPTS, secrets: [SUMUP_API_KEY] }, async (request) => {
  try {
    return await createCheckout(paymentDeps(), request.data || {})
  } catch (e) {
    throw toHttpsError(e)
  }
})

exports.getPaymentStatus = onCall({ ...OPTS, secrets: [SUMUP_API_KEY] }, async (request) => {
  try {
    return await verifyCheckoutStatus(paymentDeps(), request.data || {})
  } catch (e) {
    throw toHttpsError(e)
  }
})

// Webhook esiti di pagamento (checkout online + return_url del lettore).
// Smista per forma del payload; l'esito viene SEMPRE ri-verificato via
// API SumUp, quindi un payload malformato è innocuo.
exports.paymentWebhook = onRequest({ ...OPTS, secrets: [SUMUP_API_KEY], cors: false }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('')
  try {
    const deps = paymentDeps()
    const reader = parseReaderWebhookBody(req.body)
    if (reader.clientTransactionId) {
      await handleReaderWebhook(deps, reader)
    } else {
      const online = parseCheckoutWebhookBody(req.body)
      await handleOnlineWebhook(deps, online)
    }
  } catch (e) {
    console.error('[payments] webhook:', e?.message || e)
  }
  // Sempre 200: gli esiti veri si leggono dall'API, niente retry storm.
  res.status(200).json({ ok: true })
})

// Cintura server: ordine ritirato + pagato (in qualunque ordine) → chiuso.
exports.autoAdvancePaid = onDocumentUpdated({ ...OPTS, document: 'orders/{orderId}' }, async (event) => {
  const before = event.data?.before?.data()
  const after = event.data?.after?.data()
  const advance = decideAutoAdvance(before, after)
  if (!advance) return
  const nowIso = new Date().toISOString()
  await event.data.after.ref
    .update({ status: advance, [`status_times.${advance}`]: nowIso })
    .catch((e) => console.error('[payments] auto-advance:', e?.message || e))
})

// ── Lettore SumUp Solo (Cloud API): pairing e incasso dalla coda ──────────────
exports.pairSumUpReader = onCall({ ...OPTS, secrets: [SUMUP_API_KEY] }, async (request) => {
  try {
    return await pairReader(paymentDeps(), request.auth, request.data || {})
  } catch (e) {
    throw toHttpsError(e)
  }
})

exports.unpairSumUpReader = onCall({ ...OPTS, secrets: [SUMUP_API_KEY] }, async (request) => {
  try {
    return await unpairReader(paymentDeps(), request.auth)
  } catch (e) {
    throw toHttpsError(e)
  }
})

exports.readerCheckout = onCall({ ...OPTS, secrets: [SUMUP_API_KEY] }, async (request) => {
  try {
    return await readerCheckoutSvc(paymentDeps(), request.auth, request.data || {})
  } catch (e) {
    throw toHttpsError(e)
  }
})

exports.readerTerminate = onCall({ ...OPTS, secrets: [SUMUP_API_KEY] }, async (request) => {
  try {
    return await readerTerminateSvc(paymentDeps(), request.auth, request.data || {})
  } catch (e) {
    throw toHttpsError(e)
  }
})

// ── Pagamento di un GRUPPO via SumUp (online + lettore) ───────────────────────
exports.createGroupCheckout = onCall({ ...OPTS, secrets: [SUMUP_API_KEY] }, async (request) => {
  try {
    return await createGroupCheckout(paymentDeps(), request.data || {})
  } catch (e) {
    throw toHttpsError(e)
  }
})

exports.getGroupPaymentStatus = onCall({ ...OPTS, secrets: [SUMUP_API_KEY] }, async (request) => {
  try {
    return await verifyGroupPayment(paymentDeps(), request.data || {})
  } catch (e) {
    throw toHttpsError(e)
  }
})

exports.groupReaderCheckout = onCall({ ...OPTS, secrets: [SUMUP_API_KEY] }, async (request) => {
  try {
    return await groupReaderCheckoutSvc(paymentDeps(), request.auth, request.data || {})
  } catch (e) {
    throw toHttpsError(e)
  }
})
