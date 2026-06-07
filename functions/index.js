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
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { defineString } = require('firebase-functions/params')

const { buildSumupHeaders, buildSumupUrl } = require('./lib/sumup-core')
const { syncProducts, createSale, updateSaleStatus, handleWebhook } = require('./lib/sumup-service')

initializeApp()
const db = getFirestore()

const SUMUP_VENDOR_ID = defineString('SUMUP_VENDOR_ID', { default: '' })
const SUMUP_OUTLET_ID = defineString('SUMUP_OUTLET_ID', { default: '' })

// URL base da confermare con SumUp support al momento del rilascio del Vendor-Id.
// Goodtill (il sistema dietro SumUp POS Pro) usa tipicamente:
//   https://api.thegoodtill.com/api
// Potrebbe anche essere un endpoint dedicato SumUp — verificare via email.
const SUMUP_API_BASE = process.env.SUMUP_API_BASE || 'https://api.thegoodtill.com/api'

const OPTS = { region: 'europe-west1' }

function isSumUpConfigured() {
  return Boolean(SUMUP_VENDOR_ID.value() && SUMUP_OUTLET_ID.value())
}

async function sumupFetch(path, options = {}) {
  const url = buildSumupUrl(SUMUP_API_BASE, path)
  const headers = buildSumupHeaders(SUMUP_VENDOR_ID.value(), SUMUP_OUTLET_ID.value())
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
