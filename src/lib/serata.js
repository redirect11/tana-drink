// Logica pura della serata (niente Firebase): smistamento ordini per stato e
// riepilogo. Interamente testabile a unità.

import { ORDER_STATUSES } from './orderStatus.js'

// Smista gli ordini negli stati di lavorazione (esclude gli annullati).
export function bucketByStatus(orders) {
  const buckets = {
    [ORDER_STATUSES.RICEVUTO]: [],
    [ORDER_STATUSES.IN_PREPARAZIONE]: [],
    [ORDER_STATUSES.PRONTO]: [],
    [ORDER_STATUSES.RITIRATO]: [],
    [ORDER_STATUSES.PAGATO]: [],
  }
  for (const o of orders || []) {
    if (o.status === ORDER_STATUSES.ANNULLATO) continue
    if (buckets[o.status]) buckets[o.status].push(o)
  }
  return buckets
}

// Riepilogo serata: numero ordini e totale (esclude gli annullati).
export function serataRecap(orders) {
  let count = 0
  let total = 0
  for (const o of orders || []) {
    if (o.status === ORDER_STATUSES.ANNULLATO) continue
    count += 1
    total += Number(o.total) || 0
  }
  return { count, total }
}

// Ordini ancora "aperti" (non ritirati, pagati né annullati): usato per
// avvisare alla chiusura della serata.
export function openOrdersCount(orders) {
  return (orders || []).filter(
    (o) =>
      o.status !== ORDER_STATUSES.RITIRATO &&
      o.status !== ORDER_STATUSES.PAGATO &&
      o.status !== ORDER_STATUSES.ANNULLATO
  ).length
}
