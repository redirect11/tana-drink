// Logica pura della CODA ordini (niente Firebase): smistamento per stato e
// riepilogo. Il servizio è perpetuo: non esistono più "serate", i conti
// restano aperti finché non li si chiude a mano. Testabile a unità.

import { ORDER_STATUSES } from './orderStatus.js'

// Smista gli ordini negli stati di lavorazione della COMANDA ATTIVA
// (workflow_status; esclude gli annullati).
export function bucketByStatus(orders) {
  const buckets = {
    [ORDER_STATUSES.RICEVUTO]: [],
    [ORDER_STATUSES.IN_PREPARAZIONE]: [],
    [ORDER_STATUSES.PRONTO]: [],
    [ORDER_STATUSES.RITIRATO]: [],
    [ORDER_STATUSES.PAGATO]: [],
  }
  for (const o of orders || []) {
    const w = o.workflow_status ?? o.status
    if (w === ORDER_STATUSES.ANNULLATO) continue
    if (buckets[w]) buckets[w].push(o)
  }
  return buckets
}

// Riepilogo: numero ordini e totale (esclude gli annullati).
export function ordersRecap(orders, isClosed = () => false) {
  let count = 0
  let total = 0
  let aperti = 0
  let chiusi = 0
  for (const o of orders || []) {
    if (o.status === ORDER_STATUSES.ANNULLATO) continue
    count += 1
    total += Number(o.total) || 0
    if (isClosed(o)) chiusi += 1
    else aperti += 1
  }
  return { count, total, aperti, chiusi }
}

// Conti ancora aperti (non pagati né annullati).
export function openOrdersCount(orders) {
  return (orders || []).filter(
    (o) => o.status !== ORDER_STATUSES.PAGATO && o.status !== ORDER_STATUSES.ANNULLATO
  ).length
}

// "Questo conto risponde a quello che sto cercando?" — numero, cliente,
// tavolo, chi l'ha battuto, drink dentro.
//
// Sta qui, in una riga sola, perché la ricerca della coda ha DUE modi di
// usarla: filtrare la lista, oppure lasciarla intera e accendere il conto
// trovato. Se le due strade rispondessero in modo diverso, cambiando
// impostazione lo stesso testo troverebbe conti diversi.
export function ordineCorrisponde(o, query) {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q || !o) return false
  return (
    String(o.daily_number ?? '').includes(q) ||
    !!o.customer_name?.toLowerCase().includes(q) ||
    !!o.table_label?.toLowerCase().includes(q) ||
    !!o.placed_by?.email?.toLowerCase().includes(q) ||
    !!o.placed_by?.name?.toLowerCase().includes(q) ||
    (o.order_items || []).some((i) => i.name?.toLowerCase().includes(q))
  )
}

// Il PRIMO conto che risponde, nell'ordine in cui sta sullo schermo: è
// quello da accendere e da portare sotto gli occhi. L'ordine lo decide chi
// chiama, passando la lista già come la si vede.
export function primoCorrispondente(orders, query) {
  return (orders || []).find((o) => ordineCorrisponde(o, query)) || null
}
