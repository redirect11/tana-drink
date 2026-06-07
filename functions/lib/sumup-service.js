'use strict'

// Logica di servizio dell'integrazione SumUp POS Pro.
//
// Ogni funzione riceve le proprie dipendenze (Firestore, fetch SumUp,
// flag di configurazione, serverTimestamp) tramite un oggetto `deps`, così da
// poter essere testata con mock in-memory senza il runtime Firebase
// (vedi tests/bdd/*.test.js). `index.js` inietta le implementazioni reali.

const {
  extractProducts,
  mapProductToDrink,
  buildSalePayload,
  mapWebhookStatus,
  parseWebhookBody,
} = require('./sumup-core')

// Sincronizza il catalogo SumUp → collezione Firestore `drinks`.
// I prodotti già presenti (per sumup_product_id) vengono aggiornati, i nuovi creati.
async function syncProducts({ db, sumupFetch, isConfigured, serverTimestamp }) {
  if (!isConfigured()) {
    return { skipped: true, message: 'SUMUP_VENDOR_ID o SUMUP_OUTLET_ID non configurati.' }
  }

  const data = await sumupFetch('/products')
  const products = extractProducts(data)
  const drinksCol = db.collection('drinks')
  let synced = 0

  for (const p of products) {
    const drinkData = mapProductToDrink(p)
    if (!drinkData) continue

    const snap = await drinksCol
      .where('sumup_product_id', '==', drinkData.sumup_product_id)
      .limit(1)
      .get()

    if (snap.empty) {
      await drinksCol.add({ ...drinkData, created_at: serverTimestamp() })
    } else {
      await snap.docs[0].ref.update(drinkData)
    }
    synced++
  }

  return { synced, total: products.length }
}

// Invia un ordine a SumUp POS Pro come External Sale e persiste il sale id
// sull'ordine Firebase per consentire aggiornamenti di stato futuri.
async function createSale({ db, sumupFetch, isConfigured }, data) {
  if (!isConfigured()) return { skipped: true }

  const { orderId, tableLabel, items, note } = data || {}
  const payload = buildSalePayload({ tableLabel, note, items })

  const sale = await sumupFetch('/external_sales', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (orderId && sale && sale.id) {
    await db.collection('orders').doc(orderId).update({
      sumup_sale_id: String(sale.id),
    })
  }

  return { saleId: (sale && sale.id) ?? null }
}

// Aggiorna lo stato di una vendita su SumUp POS Pro.
async function updateSaleStatus({ sumupFetch, isConfigured }, data) {
  if (!isConfigured()) return { skipped: true }

  const { saleId, status } = data || {}
  if (!saleId) return { skipped: true, reason: 'nessun sumup_sale_id' }

  await sumupFetch(`/external_sales/${saleId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })

  return { updated: true }
}

// Gestisce il webhook in entrata da SumUp POS Pro: traduce lo stato e aggiorna
// l'ordine Firestore corrispondente. Restituisce { status, body } HTTP da inoltrare.
async function handleWebhook({ db }, { method, body }) {
  if (method !== 'POST') {
    return { status: 405, body: 'Method Not Allowed' }
  }

  const { saleId, status } = parseWebhookBody(body)
  if (!saleId) {
    return { status: 400, body: 'Missing sale_id' }
  }

  const ourStatus = mapWebhookStatus(status)
  if (!ourStatus) {
    // Stato non mappato (es. CREATED): ignora silenziosamente.
    return { status: 200, body: 'OK' }
  }

  const snap = await db
    .collection('orders')
    .where('sumup_sale_id', '==', saleId)
    .limit(1)
    .get()

  if (!snap.empty) {
    await snap.docs[0].ref.update({ status: ourStatus })
  }

  return { status: 200, body: 'OK' }
}

module.exports = {
  syncProducts,
  createSale,
  updateSaleStatus,
  handleWebhook,
}
