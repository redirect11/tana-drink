// RENDICONTO DI UNA SERATA: cosa è entrato, cosa è costato, cosa è rimasto.
//
// Due letture degli stessi ordini:
//   • per CONTO    → una riga per ordine (lordo, sconto, netto, guadagno)
//   • per PRODOTTO → il cumulativo del venduto, raggruppabile per categoria
//
// Tre regole valgono ovunque qui dentro:
//
//  1. Gli importi sono il VENDUTO REALE. Lo sconto è un importo sul conto,
//     mentre le righe portano il listino: si ripartisce in proporzione al
//     prezzo (vedi discountFactor), così la somma delle righe torna sempre
//     col totale incassato e nessun prodotto vale più di quanto è entrato.
//
//  2. Il COSTO viene dalla ricetta valorizzata sull'inventario. Se di un
//     ingrediente non si conosce il costo la riga è marcata `parziale`: il
//     guadagno che ne esce è per forza ottimistico e va detto, non nascosto
//     dietro un numero che sembra esatto.
//
//  3. Costi e ricavi sono entrambi LORDI (IVA compresa), come nel resto
//     dell'app: mescolare un ricavo lordo con un costo netto gonfierebbe il
//     margine di dieci punti senza che si veda.
//
// Logica pura (niente Firebase), interamente testabile.

import { recipeCost } from './pricing.js'
import { discountFactor } from './eta.js'
import { scontoTotale } from './pagamento.js'
import { ORDER_STATUSES } from './orderStatus.js'

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const isCancelled = (o) => o?.status === ORDER_STATUSES.ANNULLATO

// Righe di un ordine, sia nel modello vecchio (order_items) sia in quello a
// comande (items dentro ogni comanda).
export function orderLines(o) {
  if (Array.isArray(o?.order_items) && o.order_items.length) return o.order_items
  return (o?.comande || []).flatMap((c) => c.items || [])
}

// Ricetta da valorizzare: quella della riga (drink personalizzati) o quella
// del drink di catalogo.
const recipeOf = (line, drink) =>
  Array.isArray(line?.recipe_items) && line.recipe_items.length
    ? line.recipe_items
    : drink?.recipe_items || []

// Costo di UNA riga (già moltiplicato per la quantità).
// `noto: false` quando la ricetta manca del tutto: il costo è 0 ma non è un
// costo, è un "non lo so" — chi mostra il dato deve poterli distinguere.
// `gross: false` per il costo al NETTO dell'IVA d'acquisto: serve dove il
// costo si confronta con un incasso già scorporato (il mensile per macro),
// altrimenti il margine esce falsato di un'aliquota.
export function lineCost(line, drink, itemsById, { gross = true } = {}) {
  const qty = Number(line?.qty) || 0
  const recipe = recipeOf(line, drink)
  if (qty <= 0 || recipe.length === 0) return { costo: 0, noto: false, mancanti: [] }
  const { cost, missing } = recipeCost(recipe, itemsById, { gross })
  return { costo: round2(cost * qty), noto: cost > 0, mancanti: missing }
}

// Conto singolo: lordo di listino, sconto, netto incassato, costo e guadagno.
export function orderRecap(order, { drinksById, itemsById } = {}) {
  const f = discountFactor(order)
  const righe = []
  let lordo = 0
  let costo = 0
  let pezzi = 0
  let parziale = false

  for (const li of orderLines(order)) {
    const qty = Number(li.qty) || 0
    const prezzo = Number(li.unit_price) || 0
    const drink = drinksById?.[li.drink_id]
    const c = lineCost(li, drink, itemsById)
    if (!c.noto || c.mancanti.length) parziale = true
    const rigaLordo = qty * prezzo
    const rigaNetto = round2(rigaLordo * f)
    lordo += rigaLordo
    costo += c.costo
    pezzi += qty
    righe.push({
      name: li.name,
      drink_id: li.drink_id ?? null,
      categoria: drink?.category || 'Altro',
      qty,
      prezzo,
      lordo: round2(rigaLordo),
      netto: rigaNetto,
      // Quota di sconto che ricade su questa riga: è la differenza, così la
      // somma delle quote fa esattamente lo sconto del conto.
      sconto: round2(rigaLordo - rigaNetto),
      costo: c.costo,
      guadagno: round2(rigaNetto - c.costo),
      costoNoto: c.noto && c.mancanti.length === 0,
    })
  }

  // TUTTI gli sconti del conto, non uno: da quando ognuno cade sulle righe
  // che si stanno riscuotendo, un conto ne può portare più d'uno.
  const sconto = scontoTotale(order)
  const netto = round2(lordo - sconto)
  const pagato = order?.payment_status === 'pagato'
  // Metodi dai pagamenti registrati; per i conti vecchi, chiusi prima che
  // esistesse `payments[]`, vale ancora il metodo scritto sull'ordine.
  const metodi = [...new Set((order?.payments || []).map((p) => p.method).filter(Boolean))]
  if (!metodi.length && order?.payment_method) metodi.push(order.payment_method)
  return {
    id: order?.id,
    numero: order?.daily_number ?? null,
    nome: order?.customer_name || order?.table || '',
    quando: order?.paid_at || order?.created_at || null,
    stato: order?.status ?? null,
    pagato,
    // Un conto chiuso senza incasso NON è un dato mancante: o è stato
    // offerto (sconto pari al totale), o è ancora da incassare. Senza
    // questa distinzione in tabella si legge un trattino e sembra un bug.
    omaggio: pagato && metodi.length === 0 && netto <= 0,
    daIncassare: !pagato && netto > 0,
    metodi,
    pezzi,
    lordo: round2(lordo),
    sconto,
    netto,
    costo: round2(costo),
    guadagno: round2(netto - costo),
    // Margine sul venduto: quanto di ogni euro incassato resta in tasca.
    margine: netto > 0 ? Math.round(((netto - costo) / netto) * 1000) / 10 : null,
    parziale,
    righe,
  }
}

// Tutti i conti della serata, dal più recente. Gli annullati restano fuori:
// non sono stati venduti.
export function rendicontoOrdini(orders, ctx = {}) {
  return (orders || [])
    .filter((o) => !isCancelled(o))
    .map((o) => orderRecap(o, ctx))
    .sort((a, b) => String(b.quando || '').localeCompare(String(a.quando || '')))
}

// Cumulativo per PRODOTTO: quanti pezzi, quanto è entrato davvero, quanto è
// costato, quanto è rimasto. `prezzoMedio` è il venduto ÷ pezzi, quindi è già
// al netto degli sconti: è il prezzo a cui il prodotto è uscito davvero,
// che può essere sotto il listino.
export function rendicontoProdotti(orders, ctx = {}) {
  const byName = new Map()
  for (const o of orders || []) {
    if (isCancelled(o)) continue
    for (const r of orderRecap(o, ctx).righe) {
      const cur = byName.get(r.name) || {
        name: r.name,
        categoria: r.categoria,
        qty: 0,
        lordo: 0,
        sconto: 0,
        netto: 0,
        costo: 0,
        costoNoto: true,
      }
      cur.qty += r.qty
      cur.lordo = round2(cur.lordo + r.lordo)
      cur.sconto = round2(cur.sconto + r.sconto)
      cur.netto = round2(cur.netto + r.netto)
      cur.costo = round2(cur.costo + r.costo)
      if (!r.costoNoto) cur.costoNoto = false
      byName.set(r.name, cur)
    }
  }
  return [...byName.values()]
    .map((p) => ({
      ...p,
      prezzoMedio: p.qty > 0 ? Math.round((p.netto / p.qty) * 100) / 100 : 0,
      guadagno: round2(p.netto - p.costo),
      margine: p.netto > 0 ? Math.round(((p.netto - p.costo) / p.netto) * 1000) / 10 : null,
    }))
    .sort((a, b) => b.netto - a.netto || a.name.localeCompare(b.name))
}

// Totali di colonna: valgono per la lista completa o per una sola categoria,
// così il piede della tabella dice sempre la verità su quello che si vede.
export function sommaRighe(righe) {
  const tot = righe.reduce(
    (s, r) => ({
      qty: s.qty + (Number(r.qty) || 0),
      pezzi: s.pezzi + (Number(r.pezzi ?? r.qty) || 0),
      lordo: s.lordo + (Number(r.lordo) || 0),
      sconto: s.sconto + (Number(r.sconto) || 0),
      netto: s.netto + (Number(r.netto) || 0),
      costo: s.costo + (Number(r.costo) || 0),
      guadagno: s.guadagno + (Number(r.guadagno) || 0),
    }),
    { qty: 0, pezzi: 0, lordo: 0, sconto: 0, netto: 0, costo: 0, guadagno: 0 }
  )
  const netto = round2(tot.netto)
  return {
    conti: righe.length,
    qty: tot.qty,
    pezzi: tot.pezzi,
    lordo: round2(tot.lordo),
    sconto: round2(tot.sconto),
    netto,
    costo: round2(tot.costo),
    guadagno: round2(tot.guadagno),
    margine: netto > 0 ? Math.round((round2(tot.guadagno) / netto) * 1000) / 10 : null,
    parziale: righe.some((r) => r.parziale || r.costoNoto === false),
  }
}

// Categorie presenti nel cumulativo, con quanti prodotti diversi ciascuna,
// ordinate per venduto: la prima voce è sempre "tutte".
export function categorieDi(prodotti) {
  const byCat = new Map()
  for (const p of prodotti) {
    const cur = byCat.get(p.categoria) || { key: p.categoria, label: p.categoria, count: 0, netto: 0 }
    cur.count += 1
    cur.netto = round2(cur.netto + p.netto)
    byCat.set(p.categoria, cur)
  }
  const liste = [...byCat.values()].sort((a, b) => b.netto - a.netto)
  return [{ key: '__tutte__', label: 'Tutte', count: prodotti.length }, ...liste]
}
