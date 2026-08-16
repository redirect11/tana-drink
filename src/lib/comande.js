// Logica pura del modello Ordine (conto) / Comande (ticket).
//
// L'ORDINE è il conto: resta `aperto` quanto serve (anche giorni), si chiude solo
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

// La comanda "attiva": quella AL PASSO PIÙ INDIETRO tra le aperte (a parità
// di passo, la più vecchia), o null. È lei a dare lo stato dell'ordine in
// coda: se su un conto con una comanda già "pronta" arriva un'aggiunta in
// preparazione, l'ordine TORNA "in preparazione" — c'è di nuovo lavoro al
// banco (il concetto richiesto: nuova aggiunta ⇒ si riparte a preparare).
export function activeComanda(order) {
  const aperte = (order?.comande || []).filter((c) => !comandaDone(c))
  if (aperte.length === 0) return null
  return aperte.reduce((best, c) =>
    COMANDA_FLOW.indexOf(c.status) < COMANDA_FLOW.indexOf(best.status) ? c : best
  )
}

// Un conto PAGATO risulta interamente servito: le comande ancora in
// lavorazione passano a 'ritirato' (le annullate restano annullate, le
// già servite non vengono toccate).
export function serveAllComande(comande, nowIso) {
  return (comande || []).map((c) =>
    c.status === ORDER_STATUSES.ANNULLATO || c.status === ORDER_STATUSES.RITIRATO
      ? c
      : {
          ...c,
          status: ORDER_STATUSES.RITIRATO,
          status_times: { ...(c.status_times || {}), [ORDER_STATUSES.RITIRATO]: nowIso },
        }
  )
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

// Il conto ha contenuto? (almeno un item in una comanda non annullata)
export function orderHasContent(order) {
  return (order?.comande || []).some(
    (c) => c.status !== ORDER_STATUSES.ANNULLATO && (c.items || []).length > 0
  )
}

// Vista iniziale del dettaglio POS: se il conto ha già contenuto si apre
// sulle COMANDE (si vede subito cosa contiene); se è vuoto, sul menù.
export function initialDetailView(order) {
  return orderHasContent(order) ? 'comande' : 'menu'
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

// ── Vista aggregata dell'ordine (UX senza comande in vista) ────────────
// Il bartender lavora sull'ordine aggregato: gli AUMENTI diventano una nuova
// comanda (gestita internamente), le DIMINUZIONI toccano solo le comande
// ancora modificabili. Una comanda pronta o servita non si tocca più.

// Modificabile = non ancora pronta/servita/annullata.
// QUANDO IL MAGAZZINO SI SCALA DAVVERO. Alla comanda SERVITA, non alla
// presa in carico: un drink iniziato e poi non fatto — riga tolta, cliente
// che cambia idea, comanda annullata — aveva già portato via gli
// ingredienti. Servito vuol dire che quel drink è uscito per certo.
// Una volta sola: se lo scarico è già stato applicato non si ripete.
// Senza gli stati del servizio le comande risultano servite alla
// riscossione, ed è lì che si scala (vedi unappliedEntries in api.js).
export function comandaDaScaricare(comanda, nuovoStato) {
  return nuovoStato === ORDER_STATUSES.RITIRATO && comanda?.inventory_applied !== true
}

export function comandaEditable(c) {
  return c.status === ORDER_STATUSES.RICEVUTO || c.status === ORDER_STATUSES.IN_PREPARAZIONE
}

// Quantità per item bloccate (comande pronte/servite): sotto questa soglia
// l'aggregato non può scendere.
export function lockedQtyByItem(comande) {
  const m = {}
  for (const c of comande || []) {
    if (c.status === ORDER_STATUSES.ANNULLATO || comandaEditable(c)) continue
    for (const i of c.items || []) {
      m[i.drink_id] = (m[i.drink_id] || 0) + (Number(i.qty) || 0)
    }
  }
  return m
}

// Piano per togliere 1 unità di `drinkId` dall'ordine: sceglie la comanda
// modificabile PIÙ RECENTE che contiene l'item e restituisce
// { comandaId, items } con la quantità decrementata (item rimosso a zero).
// null se l'item vive solo in comande non modificabili.
export function planDecrement(comande, drinkId) {
  const editable = (comande || []).filter(comandaEditable)
  for (let k = editable.length - 1; k >= 0; k--) {
    const c = editable[k]
    const idx = (c.items || []).findIndex((i) => i.drink_id === drinkId && (Number(i.qty) || 0) > 0)
    if (idx === -1) continue
    const items = c.items
      .map((i, j) => (j === idx ? { ...i, qty: i.qty - 1 } : i))
      .filter((i) => i.qty > 0)
    return { comandaId: c.id, items }
  }
  return null
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
