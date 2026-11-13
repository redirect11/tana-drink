// ── GLI STRUMENTI DI LETTURA DELLA CHAT (REQ-AI-006) ──────────────────
//
// Il modello li chiede, l'app li esegue qui, coi dati che chi scrive vede
// già, e rimanda l'esito. Nomi e numeri, niente dati di persone; quantità
// nelle unità base del magazzino (ml, g, pz). Le righe sono contate
// (accordo con la regia del 13/11/2026): ogni riga in più si paga a ogni
// turno della conversazione, perché la conversazione viaggia intera.
//
// Logica pura: i dati li passa chi chiama (magazzino, prodotti, conti del
// periodo).

import { aggregateItems } from './comande.js'
import { scontoTotale } from './pagamento.js'
import { ORDER_STATUSES } from './orderStatus.js'
import { tokens as parole } from './nameMatch.js'
import { dataValida } from './fatturaAI.js'

export const LIMITI_RIGHE = { giacenza: 5, vendite: 20, cerca_prodotti: 15 }

// Minuscole, senza accenti né punteggiatura (nameMatch.js): «Caffè» e
// «CAFFE».

// Un nome corrisponde se contiene tutte le parole cercate.
const corrisponde = (nome, cercate) => {
  const sue = parole(nome)
  return cercate.length > 0 && cercate.every((c) => sue.some((w) => w.startsWith(c)))
}

const euro = (v) => Math.round((Number(v) || 0) * 100) / 100

// LA GIACENZA DI UN PRODOTTO: { prodotto } → i prodotti di magazzino il cui
// nome lo contiene, con la scorta minima e se ci sono sotto.
export function giacenza(input, { items = [] } = {}) {
  const cercate = parole(input?.prodotto)
  const trovati = items
    .filter((i) => corrisponde(i.name, cercate))
    .slice(0, LIMITI_RIGHE.giacenza)
    .map((i) => {
      const minima = Number(i.low_threshold) || null
      return {
        id: i.id,
        nome: i.name,
        giacenza: Number(i.stock) || 0,
        unita: i.unit || 'pz',
        scorta_minima: minima,
        sotto_scorta: minima != null && (Number(i.stock) || 0) <= minima,
      }
    })
  return { trovati }
}

// CERCARE NEL MAGAZZINO E NEL MENÙ: { testo } → i prodotti che si chiamano
// così, dicendo dove stanno. Uno che c'è in tutti e due (lo stesso nome)
// è una riga sola, «entrambi».
export function cercaProdotti(input, { items = [], drinks = [], categorie = [] } = {}) {
  const cercate = parole(input?.testo)
  const nomeCat = new Map(categorie.map((c) => [c.id, c.name]))
  const perNome = new Map()
  for (const d of drinks) {
    if (!corrisponde(d.name, cercate)) continue
    perNome.set(parole(d.name).join(' '), {
      id: d.id,
      nome: d.name,
      dove: 'menu',
      categoria: nomeCat.get(d.category_id) ?? d.category ?? null,
      prezzo_eur: d.price != null ? euro(d.price) : null,
      giacenza: null,
      unita: null,
    })
  }
  for (const i of items) {
    if (!corrisponde(i.name, cercate)) continue
    const chiave = parole(i.name).join(' ')
    const gia = perNome.get(chiave)
    if (gia) perNome.set(chiave, { ...gia, dove: 'entrambi', giacenza: Number(i.stock) || 0, unita: i.unit || 'pz' })
    else perNome.set(chiave, { id: i.id, nome: i.name, dove: 'magazzino', categoria: null, prezzo_eur: null, giacenza: Number(i.stock) || 0, unita: i.unit || 'pz' })
  }
  const tutti = [...perNome.values()]
  return { prodotti: tutti.slice(0, LIMITI_RIGHE.cerca_prodotti), altri: Math.max(0, tutti.length - LIMITI_RIGHE.cerca_prodotti) }
}

// LE VENDITE DI UN PERIODO: { dal, al, prodotto? } → i conti incassati del
// periodo (giornate di lavoro, AAAA-MM-GG), l'incasso al netto degli
// sconti, e i prodotti venduti per pezzi. L'incasso di una riga è prezzo
// per pezzi, prima degli sconti sul conto. `ordini` sono quelli del
// periodo (fetchOrdersRange), già dentro lo storico che il piano consente.
export function vendite(input, { ordini = [] } = {}) {
  const pagati = ordini.filter((o) => o.status === ORDER_STATUSES.PAGATO)
  const cercate = parole(input?.prodotto)
  const perProdotto = new Map()
  for (const o of pagati) {
    for (const r of aggregateItems(o.comande || [])) {
      if (cercate.length && !corrisponde(r.name, cercate)) continue
      const chiave = r.drink_id || r.name
      const p = perProdotto.get(chiave) || { nome: r.name, pezzi: 0, incasso_eur: 0 }
      p.pezzi += Number(r.qty) || 0
      p.incasso_eur = euro(p.incasso_eur + (Number(r.qty) || 0) * (Number(r.unit_price) || 0))
      perProdotto.set(chiave, p)
    }
  }
  const righe = [...perProdotto.values()].sort((a, b) => b.pezzi - a.pezzi)
  return {
    dal: input?.dal ?? null,
    al: input?.al ?? input?.dal ?? null,
    conti: pagati.length,
    incasso_eur: euro(pagati.reduce((s, o) => s + (Number(o.total) || 0) - scontoTotale(o), 0)),
    righe: righe.slice(0, LIMITI_RIGHE.vendite),
    altre: Math.max(0, righe.length - LIMITI_RIGHE.vendite),
  }
}

// Una data AAAA-MM-GG vera, o null.
export const giornata = dataValida
