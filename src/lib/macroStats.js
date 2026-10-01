// QUANTO RENDE OGNI MACRO-CATEGORIA DI QUELLO CHE VENDO.
//
// La domanda a cui questo conto risponde è una sola: per ogni gruppo di
// voci del MENÙ — «alcolici e distillati», «birre e bibite», «food» —
// quanti soldi sono entrati, e quanto è costata la merce uscita per farli
// entrare.
//
// LA REGOLA, in una riga: la vendita di una voce di menù si attribuisce
// alla macro di quella VOCE — incasso e costo di tutti i suoi ingredienti
// insieme — secondo la PERCENTUALE con cui la voce sta nella macro
// (lib/macros.js, `pesi_voci`). Di solito è il 100% in una sola; se le
// quote non arrivano a cento, il resto è «non attribuito».
//
// Perché il costo segue la vendita e non il prodotto. Una Schweppes
// comprata come bibita, quando finisce in un Gin Tonic, «l'ho venduta come
// se fosse un distillato in quel momento»: quel consumo appartiene alla
// macro del DRINK. Altrimenti il margine di una macro non torna — in «birre
// e bibite» resta solo quello che è stato venduto COME bibita, incasso e
// costo.
//
// Prima ancora si faceva il contrario: l'incasso di ogni drink veniva
// spalmato sulle macro degli INGREDIENTI in proporzione al costo. Quella
// lettura è stata tolta, non affiancata: due letture diverse della stessa
// serata che convivono sono il modo migliore per non fidarsi di nessuna
// delle due.
//
// «QUANTO HO SPESO IN BIBITE» è un'altra domanda — degli ACQUISTI, quello
// che è entrato dalla porta — e vive in `vociDiAcquisto` qui sotto (la usa
// Bilancio → Acquisti × Fatturato), che legge l'altro lato della stessa macro: i pesi dei PRODOTTI
// (`pesi_prodotti`). È lì che un prodotto può stare per il 60% in una macro
// e per il 40% in un'altra, com'è stato chiesto (09/09/2026).
//
// Logica pura (niente Firebase), interamente testabile.

import { ripartisci, UNASSIGNED } from './macros.js'
import { lineCost, orderLines } from './rendiconto.js'
import { businessDayKey, DEFAULT_CUTOFF_HOUR } from './businessDay.js'
import { ORDER_STATUSES } from './orderStatus.js'
import { discountFactor } from './eta.js'
import { valoreConSegno } from './warehouse.js'
import { costWithVat } from './inventory.js'
import { movimentoInPezzi, MOTIVI_DI_CARICO } from './magazzinoPeriodo.js'
import { consegneDi } from './confrontoOrdine.js'

export { UNASSIGNED }

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// Cella vuota: le due sole grandezze di cui parla questa tabella.
const emptyCell = () => ({ incasso: 0, costo: 0 })

// UNA RIGA VENDUTA, spartita fra le macro: [{ macro, incasso, costo }],
// una parte per ogni macro in cui la voce ha un peso (più una «non
// attribuita» per il resto). Incasso e costo viaggiano insieme in ogni
// parte, con la stessa quota.
//   line:  { drink_id, qty, unit_price, recipe_items? }  (recipe_items sui custom)
//   drink: il drink di catalogo (per la ricetta)
//   itemsById: { [inventory_item_id]: item }  — per il costo
//   macros:    le macro, coi loro `pesi_voci`
// opts:
//   saleVat → aliquota di rivendita, per scorporare l'IVA dall'incasso: il
//             costo arriva netto, e due numeri che contengono cose diverse
//             non si sottraggono.
//   factor  → quota di prezzo davvero incassata (1 = nessuno sconto). Lo
//             sconto abbassa l'incasso e NON il costo: il drink è costato
//             quello che è costato anche se l'hai regalato.
//   lordo   → l'INCASSO così com'è, IVA compresa: è come legge il foglio di
//             Flavio (Bilancio → Acquisti × Fatturato, REQ-MAG-022). Il
//             costo resta netto: chi vuole un margine al lordo non lo
//             chiede a questa funzione.
//   conCosto → false salta il costo della ricetta (resta 0).
export function lineByMacro(line, drink, itemsById, macros, opts = {}) {
  const { saleVat = 0, factor = 1, lordo = false, conCosto = true } = opts
  const importo = (Number(line?.qty) || 0) * (Number(line?.unit_price) || 0) * (Number(factor) || 0)
  const incasso = lordo ? importo : importo / (1 + aliquotaDiVendita(drink, saleVat) / 100)
  const costo = conCosto ? lineCost(line, drink, itemsById, { gross: false }).costo : 0
  // Una riga libera non ha una voce di catalogo, quindi nessun peso: va
  // tutta al «non attribuito», col suo incasso.
  return ripartisci(macros, 'voci', line?.drink_id, { incasso, costo })
}

// QUALE IVA SCORPORA QUESTA RIGA. Quella della VOCE se ce l'ha, quella del
// locale se no: nel menù c'è una categoria BOTTIGLIE, e una bottiglia
// intera non si rivende come un drink servito al banco. Mettere tutto al
// 10% gonfia il netto, e dal netto scendono margine, incidenze e prime
// cost.
//
// UNO ZERO È UN'ALIQUOTA VERA (esente) e non vuol dire «non l'ho
// compilata»: solo `null`/assente ripiega su quella del locale. Una riga
// libera, senza voce di catalogo, la voce non ce l'ha e usa il generale.
export function aliquotaDiVendita(drink, saleVat = 0) {
  const propria = Number(drink?.sale_vat)
  if (drink?.sale_vat != null && Number.isFinite(propria)) return propria
  return Number(saleVat) || 0
}

// Somma in una cella { incasso, costo } quello che porta `r`: anche un
// campo solo (Acquisti × Fatturato ci mette il fatturato da una parte e gli
// acquisti dall'altra).
export function accumula(acc, chiave, r) {
  const cell = acc.get(chiave) || emptyCell()
  cell.incasso = round2(cell.incasso + (r.incasso || 0))
  cell.costo = round2(cell.costo + (r.costo || 0))
  acc.set(chiave, cell)
  return cell
}

// LE VENDITE NELLE CELLE 'macro|colonna': ogni riga venduta, spartita fra
// le macro (lineByMacro), nella colonna in cui cade il suo conto. È il giro
// di tutte e due le tabelle del Bilancio — cambia solo come si sceglie la
// colonna (`colonnaDi(created_at)`, null = fuori) — così una regola su cosa
// conta come venduto (annullati, sconti, comande) vale per tutte e due.
// `conCosto: false` salta il costo della ricetta, a chi non serve.
export function sommaVendite(cells, orders, colonnaDi, { drinksById, itemsById, macros, saleVat = 0, lordo = false, conCosto = true }) {
  for (const o of orders || []) {
    if (o?.status === ORDER_STATUSES.ANNULLATO) continue
    const colonna = colonnaDi(o?.created_at)
    if (!colonna) continue
    const factor = discountFactor(o)
    for (const li of orderLines(o)) {
      const parti = lineByMacro(li, drinksById?.[li.drink_id], itemsById, macros, { saleVat, factor, lordo, conCosto })
      for (const r of parti) accumula(cells, `${r.macro}|${colonna}`, r)
    }
  }
  return cells
}

// ── LA MERCE ENTRATA, dal lato dei PRODOTTI ───────────────────────────
// «Quanto ho speso in bibite»: quello che è ENTRATO DALLA PORTA, che le
// tabelle spartiscono fra le macro coi pesi del PRODOTTO (`pesi_prodotti`).
//
// DUE STRADE PER LA MERCE CHE ENTRA, come nell'inventario (REQ-MAG-046):
//   · le CONSEGNE degli ordini fornitore (consegneDi: la quantità davvero
//     ricevuta, il prezzo del documento, il giorno d'arrivo);
//   · i CARICHI (MOTIVI_DI_CARICO): da Prodotti e da fattura, valorizzati
//     al costo del prodotto. Le consegne d'ordine non passano da qui: hanno
//     già la loro riga, e contarle anche dal movimento le raddoppierebbe.
// Prima si contava l'ORDINE ricevuto per quanto era stato ORDINATO, e le
// consegne parziali e i carichi senza ordine sparivano o si gonfiavano.
//
// Una voce per consegna o carico: { item_id, at, amount }. `lordo` aggiunge
// l'IVA del prodotto: il prezzo del documento e il costo del prodotto sono
// netti.
export function vociDiAcquisto(purchaseOrders, { movimenti = [], itemsById = {}, lordo = false } = {}) {
  const voci = []
  for (const po of purchaseOrders || []) {
    for (const c of consegneDi(po)) {
      const netto = c.prezzo * c.qty
      const item = itemsById[c.item_id]
      voci.push({ item_id: c.item_id, at: c.at, amount: round2(lordo ? costWithVat(netto, item?.vat) : netto) })
    }
  }
  for (const m of movimenti || []) {
    if (!MOTIVI_DI_CARICO.includes(m?.reason)) continue
    const item = itemsById[m.item_id]
    const mp = movimentoInPezzi(m, item)
    if (mp) voci.push({ item_id: m.item_id, at: m.created_at, amount: round2(valoreConSegno(mp.q, item, { gross: lordo })) })
  }
  return voci.filter((v) => Math.abs(v.amount) > 0)
}

// ── Report MENSILE per macro ───────────────────────────────────────────
// Mese = giornata commerciale dell'ordine: una serata che finisce alle tre
// di notte è ancora la serata di ieri.

const withDerived = (c) => {
  const margine = round2(c.incasso - c.costo)
  return { ...c, margine, rapporto: c.costo > 0 ? round2(c.incasso / c.costo) : null }
}

// ── LE DUE INCIDENZE ─────────────────────────────────────────────────
// Sono le due righe che il foglio di Flavio ha e la tabella dell'app no:
// «quanto pesa questa macro sul margine del mese» e «quanto pesa questo
// mese sull'incassato dell'anno». Due divisioni su numeri che la tabella ha
// già in mano — nessun altro dato serve.
//
// TORNA UNA PERCENTUALE, non una frazione: è così che si legge e così va
// scritta, e arrotondata dove si guarda invece che a ogni passaggio.
//
// DOVE IL TOTALE NON È POSITIVO NON SI DIVIDE. Un mese in perdita ha la
// somma dei margini a zero o sotto: la «quota» di una macro su quella somma
// non vuol dire niente, e stampare un −340% o un ∞ manda a ragionare su un
// numero inventato. Meglio un trattino: dice «qui non c'è una risposta»,
// che è la verità.
const incidenza = (parte, tutto) =>
  Number(tutto) > 0 ? Math.round((1000 * Number(parte)) / Number(tutto)) / 10 : null

// Costruisce la tabella mensile per macro.
//   months: elenco di 'YYYY-MM' da mostrare (colonne), es. i 12 mesi dell'anno.
//   macros: [{ id, name, pesi_voci }] — le macro nell'ordine voluto: sono
//           le righe, e i loro pesi dicono dove va ogni vendita.
// Ritorna { rows, totPerColonna, grand } (vedi componiTabella).
export function macroMonthlyReport({
  orders,
  drinksById,
  itemsById,
  macros,
  months,
  cutoffHour = DEFAULT_CUTOFF_HOUR,
  saleVat = 0,
}) {
  const monthSet = new Set(months || [])
  const meseDi = (at) => {
    const mese = (businessDayKey(at, cutoffHour) || '').slice(0, 7)
    return monthSet.has(mese) ? mese : null
  }
  const cells = sommaVendite(new Map(), orders, meseDi, { drinksById, itemsById, macros, saleVat })
  return componiTabella(cells, macros, months || [])
}

// LA TABELLA PER MACRO, dalle celle già sommate: la usano «Venduto ×
// Incassato» (le colonne sono i mesi, il secondo numero è il costo del
// venduto) e «Acquisti × Fatturato» (colonne di mesi, settimane o giorni,
// il secondo numero sono gli acquisti). La forma e le incidenze sono le
// stesse, e due copie della stessa aritmetica prima o poi divergono.
//   cells:   Map 'macroKey|colonna' → { incasso, costo }
//   colonne: le chiavi delle colonne, in ordine
// Ritorna { rows, totPerColonna, grand }: rows ha una voce per macro (più
// «Non attribuito» se ci sono importi orfani), ognuna con perColonna e tot.
// Ogni cella di una macro porta `incidenza` (quota sul margine della
// colonna); ogni cella dei totali porta `incidenzaPeriodo` (quota
// sull'incassato di tutto il periodo).
export function componiTabella(cells, macros, colonne) {
  // Righe: le macro nell'ordine dato, più «Non attribuito» se ha importi.
  const macroRows = [...(macros || [])]
  if ([...cells.keys()].some((k) => k.startsWith(`${UNASSIGNED}|`))) {
    macroRows.push({ id: UNASSIGNED, name: 'Non attribuito' })
  }

  const rows = macroRows.map((m) => {
    const perColonna = new Map()
    const tot = emptyCell()
    for (const colonna of colonne) {
      const c = cells.get(`${m.id}|${colonna}`) || emptyCell()
      perColonna.set(colonna, withDerived(c))
      tot.incasso = round2(tot.incasso + c.incasso)
      tot.costo = round2(tot.costo + c.costo)
    }
    return { id: m.id, name: m.name, perColonna, tot: withDerived(tot) }
  })

  // Totali per colonna (tutte le macro) e totale generale.
  const totPerColonna = new Map()
  const grand = emptyCell()
  for (const colonna of colonne) {
    const t = emptyCell()
    for (const r of rows) {
      const c = r.perColonna.get(colonna)
      t.incasso = round2(t.incasso + c.incasso)
      t.costo = round2(t.costo + c.costo)
    }
    totPerColonna.set(colonna, withDerived(t))
    grand.incasso = round2(grand.incasso + t.incasso)
    grand.costo = round2(grand.costo + t.costo)
  }

  const totale = withDerived(grand)

  // Secondo giro: le incidenze si possono calcolare solo adesso, perché
  // hanno bisogno del totale della colonna (il margine di tutte le macro in
  // quella colonna) e del totale del periodo.
  for (const r of rows) {
    for (const colonna of colonne) {
      const c = r.perColonna.get(colonna)
      c.incidenza = incidenza(c.margine, totPerColonna.get(colonna)?.margine)
    }
    r.tot.incidenza = incidenza(r.tot.margine, totale.margine)
  }
  for (const colonna of colonne) {
    const t = totPerColonna.get(colonna)
    t.incidenzaPeriodo = incidenza(t.incasso, totale.incasso)
  }
  // Il periodo su se stesso fa 100: non è una domanda, ma la colonna TOT deve
  // pur dire qualcosa, e un vuoto lì sembrerebbe un conto che non è tornato.
  totale.incidenzaPeriodo = incidenza(totale.incasso, totale.incasso)
  totale.incidenza = incidenza(totale.margine, totale.margine)

  return { rows, totPerColonna, grand: totale }
}
