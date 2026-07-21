// PREZZO CONSIGLIATO di un drink a partire dal costo degli ingredienti.
//
// Il costo al dettaglio di ogni ingrediente (€ per cl/ml/g/mg/pz) si
// ricava dall'inventario: costo confezione ÷ contenuto (vedi costPerUnit
// in inventory.js). Sommando qty × costo unitario si ottiene il costo
// della ricetta; il prezzo consigliato è quel costo moltiplicato per il
// RICARICO — di norma ×3, ma dipende dal drink e da quanto costano gli
// ingredienti, quindi è un'impostazione e resta sempre modificabile a mano.
//
// Logica pura (niente Firebase), interamente testabile.

import { costPerUnit } from './inventory.js'

export const DEFAULT_MARKUP = 3
export const DEFAULT_ROUND_STEP = 0.5

// Costo degli ingredienti di una ricetta.
//   rows: [{ inventory_item_id, name, qty, unit }]
//   itemsById: { [id]: item di inventario }
// Ritorna { cost, missing } dove `missing` elenca gli ingredienti di cui
// non si conosce il costo: il totale è quindi PARZIALE e va detto.
export function recipeCost(rows, itemsById, { gross = true } = {}) {
  let cost = 0
  const missing = []
  for (const r of rows || []) {
    const qty = Number(r?.qty) || 0
    if (qty <= 0) continue
    const item = itemsById?.[r.inventory_item_id]
    const per = item ? costPerUnit(item, r.unit, { gross }) : null
    if (per == null) {
      missing.push(r?.name || r?.inventory_item_id || '?')
      continue
    }
    cost += per * qty
  }
  return { cost: Math.round(cost * 10000) / 10000, missing }
}

// Arrotondamento "da listino": per eccesso al passo scelto (0,50 €).
export function roundPrice(value, step = DEFAULT_ROUND_STEP) {
  const v = Number(value)
  const s = Number(step) > 0 ? Number(step) : DEFAULT_ROUND_STEP
  if (!Number.isFinite(v) || v <= 0) return null
  return Math.round(Math.ceil(v / s) * s * 100) / 100
}

// Prezzo consigliato = costo × ricarico, arrotondato. Null se non si può
// calcolare (costo sconosciuto o nullo).
export function suggestedPrice(cost, { markup = DEFAULT_MARKUP, step = DEFAULT_ROUND_STEP } = {}) {
  const c = Number(cost) || 0
  const m = Number(markup) || 0
  if (!(c > 0) || !(m > 0)) return null
  return roundPrice(c * m, step)
}

// Ricarico effettivo di un prezzo rispetto al costo (es. 2.8 = ×2,8):
// serve a mostrare al bartender dove si sta posizionando davvero.
export function markupOf(price, cost) {
  const p = Number(price) || 0
  const c = Number(cost) || 0
  if (!(c > 0) || !(p > 0)) return null
  return Math.round((p / c) * 100) / 100
}

// Margine in euro (prezzo − costo).
export function marginOf(price, cost) {
  const p = Number(price) || 0
  const c = Number(cost) || 0
  if (!(p > 0)) return null
  return Math.round((p - c) * 100) / 100
}
