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
function parseWebhookBody(body) {
  const b = body || {}
  return {
    saleId: String(b.sale_id || b.id || ''),
    status: String(b.status || ''),
  }
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
  extractProducts,
  mapProductToDrink,
  buildSalePayload,
  WEBHOOK_STATUS_MAP,
  mapWebhookStatus,
  parseWebhookBody,
  buildSumupHeaders,
  buildSumupUrl,
}
