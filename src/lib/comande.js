// Logica pura del modello Ordine (conto) / Comande (ticket).
//
// L'ORDINE è il conto: resta `aperto` anche tutta la serata, si chiude solo
// con il pagamento (`pagato`) o con l'annullo (`annullato`).
// Ogni invio di articoli è una COMANDA: è la comanda ad avere il ciclo di
// lavorazione (ricevuto → in_preparazione → pronto → ritirato), come i
// kitchen ticket dei POS di ristorazione.

import { ORDER_STATUSES } from './orderStatus.js'

// Stati dell'ORDINE (conto).
export const ORDER_OPEN = 'aperto'

// Flusso di lavorazione della COMANDA.
export const COMANDA_FLOW = [
  ORDER_STATUSES.RICEVUTO,
  ORDER_STATUSES.IN_PREPARAZIONE,
  ORDER_STATUSES.PRONTO,
  ORDER_STATUSES.RITIRATO,
]

export function nextComandaStatus(status) {
  const idx = COMANDA_FLOW.indexOf(status)
  if (idx === -1 || idx === COMANDA_FLOW.length - 1) return null
  return COMANDA_FLOW[idx + 1]
}

// Una comanda è "chiusa" quando servita o annullata.
export function comandaDone(c) {
  return c.status === ORDER_STATUSES.RITIRATO || c.status === ORDER_STATUSES.ANNULLATO
}

// La comanda "attiva": la più vecchia ancora in lavorazione (o null).
export function activeComanda(order) {
  return (order?.comande || []).find((c) => !comandaDone(c)) ?? null
}

// Riepilogo comande per le card della coda: attive / pronte / servite.
export function comandeSummary(order) {
  const comande = order?.comande || []
  let attive = 0
  let pronte = 0
  let servite = 0
  for (const c of comande) {
    if (c.status === ORDER_STATUSES.ANNULLATO) continue
    if (c.status === ORDER_STATUSES.RITIRATO) servite += 1
    else {
      attive += 1
      if (c.status === ORDER_STATUSES.PRONTO) pronte += 1
    }
  }
  return { attive, pronte, servite, totale: attive + servite }
}

// Tutte le comande servite (o annullate)? Un conto "completo" da incassare.
export function allServed(order) {
  const comande = (order?.comande || []).filter((c) => c.status !== ORDER_STATUSES.ANNULLATO)
  return comande.length > 0 && comande.every((c) => c.status === ORDER_STATUSES.RITIRATO)
}

export function orderIsOpen(order) {
  return order?.status === ORDER_OPEN
}

export function orderIsClosed(order) {
  return order?.status === ORDER_STATUSES.PAGATO || order?.status === ORDER_STATUSES.ANNULLATO
}

// Aggregato item dell'ordine: somma gli item di tutte le comande non
// annullate (stesso drink su comande diverse → riga unica con qty sommata;
// gli item custom restano righe separate).
export function aggregateItems(comande) {
  const out = []
  const byDrink = new Map()
  for (const c of comande || []) {
    if (c.status === ORDER_STATUSES.ANNULLATO) continue
    for (const i of c.items || []) {
      if (!i.custom && i.drink_id && byDrink.has(i.drink_id)) {
        const ex = byDrink.get(i.drink_id)
        ex.qty += i.qty
      } else {
        const copy = { ...i }
        out.push(copy)
        if (!i.custom && i.drink_id) byDrink.set(i.drink_id, copy)
      }
    }
  }
  return out
}

// Totale drink dell'ordine (senza coperto/servizio/mancia).
export function itemsTotal(items) {
  return (items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_price ?? i.price) || 0), 0)
}

// Stati presenti tra le comande (campo derivato `comande_statuses` sul doc,
// usato dalle query array-contains: coda ETA cliente, tabellone pronti).
export function comandeStatuses(comande) {
  return [...new Set((comande || []).map((c) => c.status))]
}

// ── Retrocompatibilità ─────────────────────────────────────────────────
// Normalizza un doc ordine (raw Firestore) nel nuovo modello. I doc legacy
// (senza `comande`) diventano un ordine con una comanda sintetica che porta
// il vecchio stato di lavorazione.
export function normalizeOrderDoc(o) {
  if (Array.isArray(o.comande)) {
    return {
      status: o.status ?? ORDER_OPEN,
      comande: o.comande,
    }
  }
  const legacy = o.status
  const isPagato = legacy === ORDER_STATUSES.PAGATO
  const isAnnullato = legacy === ORDER_STATUSES.ANNULLATO
  const comanda = {
    id: 'c1',
    seq: 1,
    items: Array.isArray(o.items) ? o.items : [],
    // Un ordine legacy pagato era stato servito; annullato → comanda annullata.
    status: isPagato ? ORDER_STATUSES.RITIRATO : isAnnullato ? ORDER_STATUSES.ANNULLATO : (legacy ?? ORDER_STATUSES.RICEVUTO),
    status_times: o.status_times ?? {},
    inventory_applied: o.inventory_applied ?? false,
    inventory_consumption: o.inventory_consumption ?? null,
    created_at: o.created_at ?? null,
  }
  return {
    status: isPagato || isAnnullato ? legacy : ORDER_OPEN,
    comande: [comanda],
  }
}
