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

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { defineString } = require('firebase-functions/params')

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

function sumupHeaders() {
  return {
    'Content-Type': 'application/json',
    'Vendor-Id': SUMUP_VENDOR_ID.value(),
    'Outlet-Id': SUMUP_OUTLET_ID.value(),
  }
}

async function sumupFetch(path, options = {}) {
  const url = `${SUMUP_API_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: { ...sumupHeaders(), ...(options.headers || {}) },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new HttpsError('internal', `SumUp API ${res.status} su ${path}: ${text}`)
  }
  return text ? JSON.parse(text) : null
}

// ── Sincronizza prodotti SumUp → Firestore ────────────────────────────────────
// Scarica il catalogo da SumUp POS Pro e aggiorna la collezione `drinks`.
// I prodotti già presenti (identificati da sumup_product_id) vengono aggiornati;
// i nuovi vengono creati.
exports.syncSumUpProducts = onCall(OPTS, async () => {
  if (!isSumUpConfigured()) {
    return { skipped: true, message: 'SUMUP_VENDOR_ID o SUMUP_OUTLET_ID non configurati.' }
  }

  const data = await sumupFetch('/products')
  // Il formato della risposta può variare: array diretto o oggetto con chiave
  // "products" / "items". Adattare se necessario dopo aver visto la risposta reale.
  const products = Array.isArray(data)
    ? data
    : data.products || data.items || []

  const drinksCol = db.collection('drinks')
  let synced = 0

  for (const p of products) {
    const sumupId = String(p.id || p.product_id || '')
    if (!sumupId) continue

    const drinkData = {
      name: p.name || p.product_name || '',
      price: Number(p.price || p.unit_price || 0),
      category: p.category || p.department_name || null,
      description: p.description || null,
      available: p.active !== false && p.available !== false,
      sumup_product_id: sumupId,
    }

    const snap = await drinksCol
      .where('sumup_product_id', '==', sumupId)
      .limit(1)
      .get()

    if (snap.empty) {
      await drinksCol.add({ ...drinkData, created_at: FieldValue.serverTimestamp() })
    } else {
      await snap.docs[0].ref.update(drinkData)
    }
    synced++
  }

  return { synced, total: products.length }
})

// ── Invia ordine a SumUp POS Pro ──────────────────────────────────────────────
// Chiamata dopo createOrder su Firestore. L'ID della vendita SumUp viene
// salvato sull'ordine Firebase per consentire aggiornamenti di stato futuri.
exports.createSumUpSale = onCall(OPTS, async (request) => {
  if (!isSumUpConfigured()) return { skipped: true }

  const { orderId, tableLabel, items, note } = request.data

  // Payload External Sale — formato da verificare con documentazione ufficiale.
  // Campi comuni Goodtill External Sale API:
  const payload = {
    customer_name: tableLabel ? `Tavolo ${tableLabel}` : 'Cliente',
    notes: note || null,
    sale_items: items.map((i) => ({
      product_id: i.sumup_product_id || null,
      product_name: i.name,
      quantity: i.qty,
      unit_price: i.unit_price,
      total_price: Number((i.qty * i.unit_price).toFixed(2)),
    })),
  }

  const sale = await sumupFetch('/external_sales', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  // Persisti l'ID vendita SumUp sull'ordine Firebase
  if (orderId && sale?.id) {
    await db.collection('orders').doc(orderId).update({
      sumup_sale_id: String(sale.id),
    })
  }

  return { saleId: sale?.id ?? null }
})

// ── Aggiorna stato vendita su SumUp POS Pro ───────────────────────────────────
exports.updateSumUpSaleStatus = onCall(OPTS, async (request) => {
  if (!isSumUpConfigured()) return { skipped: true }

  const { saleId, status } = request.data
  if (!saleId) return { skipped: true, reason: 'nessun sumup_sale_id' }

  await sumupFetch(`/external_sales/${saleId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })

  return { updated: true }
})

// ── Webhook in entrata da SumUp POS Pro ───────────────────────────────────────
// Quando il bartender cambia stato su SumUp POS Pro, questo endpoint aggiorna
// l'ordine corrispondente su Firestore (e quindi in tempo reale sul cliente).
//
// Configura l'URL nel Back Office di SumUp POS Pro:
//   Impostazioni → Integrazioni → Webhook
//   URL: https://europe-west1-<project-id>.cloudfunctions.net/sumupWebhook
exports.sumupWebhook = onRequest({ ...OPTS, cors: false }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed')
    return
  }

  const body = req.body ?? {}
  const saleId = String(body.sale_id || body.id || '')
  const status = String(body.status || '')

  if (!saleId) {
    res.status(400).send('Missing sale_id')
    return
  }

  // Mappa stato SumUp → stato Tana Drink
  const STATUS_MAP = {
    ACCEPTED: 'in_preparazione',
    COMPLETED: 'ritirato',
    CANCELLED: 'ritirato',
  }
  const ourStatus = STATUS_MAP[status]
  if (!ourStatus) {
    // Stato non mappato (es. CREATED): ignora silenziosamente
    res.status(200).send('OK')
    return
  }

  const snap = await db
    .collection('orders')
    .where('sumup_sale_id', '==', saleId)
    .limit(1)
    .get()

  if (!snap.empty) {
    await snap.docs[0].ref.update({ status: ourStatus })
  }

  res.status(200).send('OK')
})
