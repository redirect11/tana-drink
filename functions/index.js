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
const { onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')

const { buildSumupHeaders, buildSumupUrl } = require('./lib/sumup-core')
const { syncProducts, createSale, updateSaleStatus, handleWebhook } = require('./lib/sumup-service')
const { decideOrderPush } = require('./lib/push-core')

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

// ── Notifiche push al cliente (FCM) ───────────────────────────────────────────
// Quando un ordine passa a "pronto" (drink pronto) o ad "annullato" da parte
// del bartender con notifica richiesta, invia una push al dispositivo del
// cliente (token salvato sull'ordine alla creazione). La decisione su cosa
// inviare vive in lib/push-core.js (pura, testata).
exports.notifyOrderUpdate = onDocumentUpdated({ ...OPTS, document: 'orders/{orderId}' }, async (event) => {
  const before = event.data?.before?.data()
  const after = event.data?.after?.data()
  const msg = decideOrderPush(before, after)
  if (!msg) return

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
})
