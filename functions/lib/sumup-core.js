'use strict'

// Logica pura dell'integrazione SumUp POS Pro.
//
// Questo modulo NON dipende da firebase-admin, firebase-functions o da `fetch`:
// contiene solo trasformazioni di dati deterministiche. È quindi interamente
// testabile a unità senza emulatori né mock di rete (vedi tests/unit/sumup-core.test.js).

// ── Catalogo prodotti ─────────────────────────────────────────────────────────

// Normalizza la risposta di GET /products in un array di prodotti.
// SumUp può restituire un array diretto oppure un oggetto con chiave
// "products" o "items". Qualsiasi input non valido produce un array vuoto.
function extractProducts(data) {
  if (Array.isArray(data)) return data
  if (!data) return []
  return data.products || data.items || []
}

// Mappa un prodotto SumUp alla forma del documento Firestore `drinks`.
// Restituisce null se il prodotto non ha un id utilizzabile (va saltato).
function mapProductToDrink(p) {
  const sumupId = String((p && (p.id || p.product_id)) || '')
  if (!sumupId) return null

  return {
    name: p.name || p.product_name || '',
    price: Number(p.price || p.unit_price || 0),
    category: p.category || p.department_name || null,
    description: p.description || null,
    // Disponibile a meno che SumUp non lo marchi esplicitamente come non attivo.
    available: p.active !== false && p.available !== false,
    sumup_product_id: sumupId,
  }
}

// ── External Sale ─────────────────────────────────────────────────────────────

// Costruisce il payload External Sale a partire da un ordine Tana Drink.
function buildSalePayload({ tableLabel, note, items }) {
  const list = Array.isArray(items) ? items : []
  return {
    customer_name: tableLabel ? `Tavolo ${tableLabel}` : 'Cliente',
    notes: note || null,
    sale_items: list.map((i) => ({
      product_id: i.sumup_product_id || null,
      product_name: i.name,
      quantity: i.qty,
      unit_price: i.unit_price,
      total_price: Number((i.qty * i.unit_price).toFixed(2)),
    })),
  }
}

// ── Webhook ───────────────────────────────────────────────────────────────────

// Mappa uno stato SumUp POS Pro nello stato interno Tana Drink.
// Gli stati non presenti (es. CREATED) restituiscono undefined e vanno ignorati.
const WEBHOOK_STATUS_MAP = {
  ACCEPTED: 'in_preparazione',
  COMPLETED: 'ritirato',
  CANCELLED: 'ritirato',
}

function mapWebhookStatus(sumupStatus) {
  return WEBHOOK_STATUS_MAP[sumupStatus]
}

// Estrae sale id e stato dal corpo del webhook (campi alternativi tollerati).
//
// LA FORMA VERA del messaggio di SumUp POS Pro annida la vendita:
//   { "event_type": "sale.completed",
//     "data": { "sale": { "id": "…", "url": "https://api.thegoodtill.com/…" } } }
// Qui si leggeva solo `sale_id`/`id` in cima, e di quel messaggio non si
// sarebbe trovato niente. Si tollerano tutt'e due le forme.
//
// LO STATO SI ESTRAE MA NON SI CREDE: serve solo a capire se il messaggio
// riguarda qualcosa che ci interessa. Quello che finisce sull'ordine si
// rilegge dall'API (vedi handleWebhook).
function parseWebhookBody(body) {
  const b = body || {}
  const sale = b.data?.sale || {}
  return {
    saleId: String(b.sale_id || b.id || sale.id || ''),
    status: String(b.status || sale.status || b.event_type || ''),
  }
}

// Il gettone di verifica del webhook, come lo manda SumUp POS Pro.
//
// SumUp POS Pro NON FIRMA i webhook: non c'è HMAC, non c'è timestamp firmato,
// non c'è anti-replay. L'unica cosa che offre è un SEGRETO CONDIVISO statico
// nell'header `Verification-Token`, che si legge nel back office (Impostazioni
// → Integrazioni → Webhook). È un bearer, non una firma: dice chi bussa, non
// garantisce che il corpo non sia stato toccato. Per questo autentica la
// chiamata ma non basta, e lo stato si rilegge comunque dall'API.
//
// Gli header di una richiesta HTTP arrivano in minuscolo su Cloud Run, ma non
// si dà per scontato.
function leggiTokenWebhook(headers) {
  const h = headers || {}
  return String(h['verification-token'] || h['Verification-Token'] || '')
}

// Confronto a tempo costante: la lunghezza la si lascia trapelare (è quella
// del token vero, che non è un segreto in sé), i caratteri no.
function tokenCorrisponde(atteso, ricevuto) {
  const a = String(atteso || '')
  const b = String(ricevuto || '')
  if (!a || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// ── Helpers HTTP ──────────────────────────────────────────────────────────────

function buildSumupHeaders(vendorId, outletId) {
  return {
    'Content-Type': 'application/json',
    'Vendor-Id': vendorId,
    'Outlet-Id': outletId,
  }
}

function buildSumupUrl(base, path) {
  return `${base}${path}`
}

module.exports = {
  leggiTokenWebhook,
  tokenCorrisponde,
  extractProducts,
  mapProductToDrink,
  buildSalePayload,
  WEBHOOK_STATUS_MAP,
  mapWebhookStatus,
  parseWebhookBody,
  buildSumupHeaders,
  buildSumupUrl,
}
