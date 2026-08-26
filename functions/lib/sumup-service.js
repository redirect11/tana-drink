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

// CHI PUÒ TOCCARE SUMUP. Queste tre callable non chiedevano NIENTE: un
// `onCall` v2 non richiede autenticazione di suo, e qui non c'era né un
// controllo di ruolo né App Check. A integrazione accesa, chiunque conoscesse
// l'id del progetto — sta nel bundle — poteva da internet riscrivere il menù
// con la risposta di SumUp, attaccare una vendita a un ordine altrui con i
// prezzi che voleva, o far avanzare di stato una vendita qualsiasi.
//
// Stesso metro dei pagamenti (payment-service.js): il ruolo vive nel custom
// claim, che nessuno può darsi da solo.
//   · BANCO per il catalogo: riscrivere il menù è back-office, non servizio.
//   · Tutto il personale per vendite e stati: la sala prende gli ordini al
//     tavolo, e deve poterli mandare al POS.
const STAFF_ROLES = ['admin', 'bartender', 'staff']
const BANCO = ['admin', 'bartender']

function err(code, message) {
  return { code, message }
}

function requireRole(auth, roles) {
  const role = auth?.token?.role
  if (!roles.includes(role)) {
    throw err('permission-denied', 'Operazione riservata allo staff.')
  }
}

// Sincronizza il catalogo SumUp → collezione Firestore `drinks`.
// I prodotti già presenti (per sumup_product_id) vengono aggiornati, i nuovi creati.
async function syncProducts({ db, sumupFetch, isConfigured, serverTimestamp }, auth) {
  // PRIMA se è spento, POI chi sei. Non è distrazione: SumUp è spento
  // (functions/.env vuoto) e da spenta questa funzione non fa NIENTE — nessuna
  // chiamata, nessuna scrittura. Mettere il controllo di ruolo davanti
  // cambierebbe un no-op silenzioso in un errore, e il primo a prenderlo
  // sarebbe il telefono del cliente, che chiama createSale a ogni ordine.
  if (!isConfigured()) {
    return { skipped: true, message: 'SUMUP_VENDOR_ID o SUMUP_OUTLET_ID non configurati.' }
  }
  requireRole(auth, BANCO)

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
async function createSale({ db, sumupFetch, isConfigured }, auth, data) {
  if (!isConfigured()) return { skipped: true }
  requireRole(auth, STAFF_ROLES)

  const { orderId, tableLabel, items, note } = data || {}

  // I PREZZI LI METTE IL SERVER, non chi chiama. Prima `unit_price` e `qty`
  // arrivavano dal client e finivano tali e quali nella vendita SumUp: bastava
  // chiamare la funzione a mano per registrare due Negroni a un centesimo.
  // Se l'ordine è già sul server si prende da lì, che è l'unica copia di cui
  // ci si fidi.
  //
  // Se non c'è ancora si usa quello che è arrivato, e NON è una svista: il
  // conto è local-first — `creaOrdine` scrive senza aspettare e chiama subito
  // questa — quindi il documento può essere ancora per strada. Pretenderlo
  // vorrebbe dire perdere la vendita di ogni conto battuto con la linea lenta.
  // Adesso che di qui passa solo il personale, il salto vale la pena.
  let vendita = { tableLabel, note, items }
  if (orderId) {
    const snap = await db.collection('orders').doc(orderId).get()
    if (snap.exists) {
      const order = snap.data() || {}
      vendita = {
        tableLabel: order.table_label ?? tableLabel,
        note: order.note ?? note,
        items: (order.items || []).map((i) => ({
          sumup_product_id: i.sumup_product_id ?? null,
          name: i.name,
          qty: i.qty,
          unit_price: i.unit_price,
        })),
      }
    }
  }
  const payload = buildSalePayload(vendita)

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
async function updateSaleStatus({ sumupFetch, isConfigured }, auth, data) {
  if (!isConfigured()) return { skipped: true }
  requireRole(auth, STAFF_ROLES)

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
