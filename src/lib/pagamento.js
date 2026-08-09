'use strict'

// ── Pagamento del conto: sconto, pagamenti parziali (split) e residuo ──
// Logica pura, senza Firebase, per la schermata Pagamento in stile POS:
// a sinistra gli articoli selezionabili e pagabili singolarmente, a destra
// sconto (percentuale o in euro) e metodi di pagamento. Il conto si chiude
// quando il residuo arriva a zero.
//
// Modello sul doc ordine:
//   discount:        { type: 'percent'|'euro', value } | null
//   discount_amount: sconto in euro già calcolato (persistito)
//   payments:        [{ id, amount, method, items|null, at, transaction_id? }]

import { aggregateItems } from './comande.js'

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// Tolleranza di confronto in euro (mezzo centesimo).
const EPS = 0.005

// Sconto in euro a partire dal totale e dallo sconto impostato.
export function discountAmount(total, discount) {
  const t = Number(total) || 0
  if (!discount || !(Number(discount.value) > 0) || t <= 0) return 0
  const v = Number(discount.value)
  const amount = discount.type === 'percent' ? (t * Math.min(v, 100)) / 100 : Math.min(v, t)
  return round2(amount)
}

// Somma dei pagamenti già registrati sull'ordine.
export function paidAmount(order) {
  return round2((order?.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0))
}

// Totale EFFETTIVO del conto: quello che il cliente paga davvero, cioè il
// totale degli articoli meno lo sconto applicato. È il numero da mostrare
// ovunque si dica "totale": mostrare il lordo faceva sembrare che lo sconto
// non fosse stato registrato.
export function orderTotal(order) {
  const total = Number(order?.total) || 0
  const disc = Number(order?.discount_amount) || 0
  return Math.max(0, round2(total - disc))
}

// Residuo da incassare: totale − sconto − già pagato (mai negativo).
export function orderDue(order) {
  const total = Number(order?.total) || 0
  const disc = Number(order?.discount_amount) || 0
  return Math.max(0, round2(total - disc - paidAmount(order)))
}

export const isFullyPaid = (order) => orderDue(order) <= EPS && (Number(order?.total) || 0) > 0

// Articoli ancora da pagare: aggregato dell'ordine meno le quantità già
// coperte dai pagamenti registrati (match per drink_id; i custom hanno
// un drink_id univoco per ordine).
export function remainingItems(order) {
  const items = order?.comande?.length
    ? aggregateItems(order.comande)
    : order?.order_items || []
  const paidQty = {}
  for (const p of order?.payments || [])
    for (const i of p.items || [])
      if (i.drink_id) paidQty[i.drink_id] = (paidQty[i.drink_id] || 0) + (Number(i.qty) || 0)
  return items
    .map((i) => ({
      drink_id: i.drink_id ?? null,
      name: i.name,
      unit_price: Number(i.unit_price) || 0,
      qty: (Number(i.qty) || 0) - (paidQty[i.drink_id] || 0),
      custom: i.custom ?? false,
    }))
    .filter((i) => i.qty > 0)
}

// Importo di una selezione di articoli, con lo sconto dell'ordine ripartito
// in proporzione. Se la selezione copre TUTTO il residuo si incassa il
// residuo esatto (niente derive di arrotondamento; include anche coperto e
// servizio, che non sono articoli).
export function selectionAmount(order, selection) {
  const rows = selection.filter((i) => (Number(i.qty) || 0) > 0)
  if (rows.length === 0) return orderDue(order)
  const remaining = remainingItems(order)
  const coversAll =
    remaining.length > 0 &&
    remaining.every((r) => {
      const sel = rows.find((s) => s.drink_id === r.drink_id)
      return sel && (Number(sel.qty) || 0) >= r.qty
    })
  if (coversAll) return orderDue(order)
  const gross = rows.reduce((s, i) => s + (Number(i.unit_price) || 0) * (Number(i.qty) || 0), 0)
  const total = Number(order?.total) || 0
  const disc = Number(order?.discount_amount) || 0
  const factor = total > 0 ? Math.max(0, total - disc) / total : 1
  return Math.min(round2(gross * factor), orderDue(order))
}

// Un pagamento copre il residuo? (chiude il conto)
export function paymentCloses(order, amount) {
  return orderDue(order) - (Number(amount) || 0) <= EPS
}

// Metodo "riassuntivo" del conto dopo l'ultimo pagamento: se i metodi
// usati sono diversi il conto risulta pagato "misto".
export function summaryMethod(payments) {
  const methods = [...new Set((payments || []).map((p) => p.method).filter(Boolean))]
  if (methods.length === 0) return null
  return methods.length === 1 ? methods[0] : 'misto'
}
