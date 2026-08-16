// ── LE SCORTE IMPEGNATE DAI CONTI APERTI ─────────────────────────────
//
// La giacenza dice quello che c'è **adesso** sullo scaffale. Ma a metà
// serata, sui tavoli, ci sono già drink fatti e conti non ancora chiusi:
// quel gin è promesso, anche se il magazzino non l'ha ancora scalato.
// Chi guarda il magazzino per decidere se manda qualcuno a prendere una
// bottiglia deve vedere quello che si ritroverà a FINE SERATA, non quello
// che risulta in questo istante.
//
// Qui si contano gli ingredienti PROMESSI e non ancora scalati: le
// comande dei conti ancora aperti che il magazzino non ha già scaricato.
// Le altre no, e non è una dimenticanza: quelle la giacenza le ha già
// tolte: contarle di nuovo vorrebbe dire togliere due volte lo stesso
// drink.
//
// SI CALCOLA E BASTA, non si scrive niente. Una «prenotazione» scritta sul
// database andrebbe poi disfatta a ogni riga tolta, a ogni conto annullato
// o riaperto, e ogni volta che una di quelle strade salta — offline, app
// chiusa a metà — il magazzino resterebbe con un impegno fantasma che
// nessuno sa più togliere. Il conto rifatto ogni volta dai conti aperti,
// invece, non può sbagliarsi: quando l'ultimo conto si chiude torna zero
// da solo.
//
// Lo scarico VERO — il «commit» — resta dov'è: alla comanda presa in
// carico o alla riscossione. Questo è quello che c'è nel mezzo.

import { computeConsumption, qtyInStockUnit } from './inventory.js'
import { ORDER_STATUSES } from './orderStatus.js'

// Un conto impegna finché non è annullato. INCASSATO NON BASTA: con gli
// stati del servizio si paga anche in anticipo, e un conto pagato può avere
// ancora tre drink da fare — quegli ingredienti sono ancora in ballo. Quello
// che dice la parola fine è la comanda SERVITA, che è anche il momento in
// cui il magazzino scala davvero: da lì in poi la comanda risulta scaricata
// e smette da sola di contare (vedi comandeImpegnate).
// Il conto annullato invece no: se c'era da scalare qualcosa lo ha già
// fatto il suo scarico, e riaggiungerlo qui sarebbe contarlo due volte.
export function contoImpegna(o) {
  if (!o) return false
  return o.status !== ORDER_STATUSES.ANNULLATO && o.workflow_status !== ORDER_STATUSES.ANNULLATO
}

// Le comande che pesano ancora: non annullate e non già scaricate.
export function comandeImpegnate(o) {
  return (o?.comande || []).filter(
    (c) =>
      c &&
      c.status !== ORDER_STATUSES.ANNULLATO &&
      c.inventory_applied !== true &&
      Array.isArray(c.items) &&
      c.items.length > 0
  )
}

// Gli ingredienti promessi da tutti i conti aperti, nella stessa forma che
// usa lo scarico: [{ inventory_item_id, unit, qty }], per articolo E unità.
export function consumoImpegnato(ordini, drinksById) {
  const righe = []
  for (const o of ordini || []) {
    if (!contoImpegna(o)) continue
    for (const c of comandeImpegnate(o)) righe.push(...c.items)
  }
  return computeConsumption(righe, drinksById)
}

// Quanto pesa l'impegno sulla GIACENZA, articolo per articolo: dalla
// ricetta (40 ml) all'unità in cui si conta lo scaffale (0,05 pz). È lo
// stesso passaggio che fa lo scarico — se qui si contasse in un altro modo,
// la previsione non tornerebbe mai con quello che succede davvero.
export function impegnatoPerArticolo(ordini, drinksById, itemsById) {
  const out = {}
  for (const c of consumoImpegnato(ordini, drinksById)) {
    const item = itemsById?.[c.inventory_item_id]
    if (!item) continue
    out[c.inventory_item_id] = (out[c.inventory_item_id] || 0) + qtyInStockUnit(c.qty, c.unit, item)
  }
  return out
}

// Quello che ci si ritrova a fine serata, se tutti i conti aperti vengono
// incassati così come sono. `null` quando non c'è niente di impegnato: la
// colonna resta vuota invece di ripetere la giacenza, che si legge già
// accanto.
export function previstoAFineSerata(item, impegnato) {
  const q = Number(impegnato) || 0
  if (q <= 0) return null
  return (Number(item?.stock) || 0) - q
}

// L'articolo COM'È PREVISTO a fine serata: stesso articolo, giacenza già
// tolta di quello che i conti aperti si sono presi. Serve a mostrarlo con
// le stesse regole della giacenza vera — pezzi, bottiglie, contenuto — senza
// riscrivere quei conti una seconda volta, che è il modo migliore per farli
// dire due numeri diversi.
export function articoloPrevisto(item, impegnato) {
  const previsto = previstoAFineSerata(item, impegnato)
  return previsto == null ? null : { ...item, stock: previsto }
}
