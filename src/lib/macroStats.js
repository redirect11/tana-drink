// QUANTO RENDE OGNI MACRO-CATEGORIA DI QUELLO CHE VENDO.
//
// La domanda a cui questo conto risponde è una sola: per ogni gruppo di
// voci del MENÙ — «alcolici e distillati», «birre e bibite», «food» —
// quanti soldi sono entrati, e quanto è costata la merce uscita per farli
// entrare.
//
// LA REGOLA, in una riga: la vendita di una voce di menù si attribuisce
// INTERA alla macro di quella voce — incasso e costo di tutti i suoi
// ingredienti insieme. Non si scompone niente.
//
// Perché. Una Schweppes comprata come bibita, quando finisce in un Gin
// Tonic, «l'ho venduta come se fosse un distillato in quel momento»: quel
// consumo appartiene alla macro del DRINK, non a quella del prodotto. E il
// costo segue la vendita, altrimenti il margine di una macro non torna — in
// «birre e bibite» resta solo quello che è stato venduto COME bibita,
// incasso e costo.
//
// Prima si faceva il contrario: l'incasso di ogni drink veniva spalmato
// sulle macro degli INGREDIENTI in proporzione al costo. Quella lettura è
// stata tolta, non affiancata: due letture diverse della stessa serata che
// convivono sono il modo migliore per non fidarsi di nessuna delle due.
//
// IL ROVESCIO È VOLUTO: da qui non si legge più «quanto ho speso in
// bibite». È una domanda vera, ma è degli ACQUISTI — le fatture, quello che
// è entrato dalla porta — e vive dove stanno gli acquisti (purchasesByMacro
// qui sotto, sulle macro di MAGAZZINO).
//
// L'anagrafica del prodotto non si tocca mai: la sua macro di magazzino
// resta quella che è. Questa attribuzione vive solo nel conto di fine mese.
//
// Logica pura (niente Firebase), interamente testabile.

import { macroOfItem, macroOfDrink } from './macros.js'
import { lineCost, orderLines } from './rendiconto.js'
import { businessDayKey, DEFAULT_CUTOFF_HOUR } from './businessDay.js'
import { ORDER_STATUSES } from './orderStatus.js'
import { discountFactor } from './eta.js'

// Chiave di quello che non si sa attribuire: un drink senza categoria di
// menù, o con una categoria che non sta in nessuna macro.
export const UNASSIGNED = 'none'

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// Cella vuota: le due sole grandezze di cui parla questa tabella.
const emptyCell = () => ({ incasso: 0, costo: 0 })

// UNA RIGA VENDUTA: a quale macro va, quanto ha incassato, quanto è costata.
//   line:  { drink_id, qty, unit_price, recipe_items? }  (recipe_items sui custom)
//   drink: il drink di catalogo (per la ricetta e per la categoria di menù)
//   itemsById:      { [inventory_item_id]: item }  — per il costo
//   menuCatToMacro: Map id-categoria-menù → id-macro-menù
// opts:
//   saleVat → aliquota di rivendita, per scorporare l'IVA dall'incasso: il
//             costo arriva netto, e due numeri che contengono cose diverse
//             non si sottraggono.
//   factor  → quota di prezzo davvero incassata (1 = nessuno sconto). Lo
//             sconto abbassa l'incasso e NON il costo: il drink è costato
//             quello che è costato anche se l'hai regalato.
export function lineByMacro(line, drink, itemsById, menuCatToMacro, opts = {}) {
  const { saleVat = 0, factor = 1 } = opts
  const lordo = (Number(line?.qty) || 0) * (Number(line?.unit_price) || 0) * (Number(factor) || 0)
  const { costo } = lineCost(line, drink, itemsById, { gross: false })
  return {
    macro: macroOfDrink(drink, menuCatToMacro) || UNASSIGNED,
    incasso: round2(lordo / (1 + aliquotaDiVendita(drink, saleVat) / 100)),
    costo: round2(costo),
  }
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

// Somma le righe vendute nelle celle di un accumulatore Map → { incasso, costo }.
// Ci passano tutte e due le letture qui sotto: il totale del periodo e la
// tabella mese per mese.
function accumula(acc, chiave, r) {
  const cell = acc.get(chiave) || emptyCell()
  cell.incasso = round2(cell.incasso + r.incasso)
  cell.costo = round2(cell.costo + r.costo)
  acc.set(chiave, cell)
  return cell
}

// Vendite per macro di MENÙ su un insieme di ordini. Salta gli annullati.
// Ritorna Map macroKey → { incasso, costo }.
export function venditeByMacro(orders, { drinksById, itemsById, menuCatToMacro, saleVat = 0 }) {
  const acc = new Map()
  for (const o of orders || []) {
    if (o?.status === ORDER_STATUSES.ANNULLATO) continue
    const factor = discountFactor(o)
    for (const li of orderLines(o)) {
      const r = lineByMacro(li, drinksById?.[li.drink_id], itemsById, menuCatToMacro, {
        saleVat,
        factor,
      })
      accumula(acc, r.macro, r)
    }
  }
  return acc
}

// ── ACQUISTI per macro di MAGAZZINO ────────────────────────────────────
// Dagli ordini fornitori RICEVUTI: per ogni riga, importo netto
// (unit_cost × qty_packages) attribuito alla macro dell'ARTICOLO
// (articolo → categoria di magazzino → macro). Righe di articoli senza
// macro → `none`.
//
// È l'altra domanda — «quanto ho speso in bibite» — e vive per conto suo:
// non entra nel mensile per macro, che parla di quello che si è VENDUTO.
export function purchasesByMacro(purchaseOrders, { itemsById, catToMacro, onlyReceived = true }) {
  const acc = new Map()
  for (const po of purchaseOrders || []) {
    if (onlyReceived && po?.status !== 'ricevuto') continue
    for (const l of po?.lines || []) {
      const amount = round2((Number(l.unit_cost) || 0) * (Number(l.qty_packages) || 0))
      if (amount <= 0) continue
      const item = itemsById?.[l.item_id]
      const macro = (item && macroOfItem(item, catToMacro)) || UNASSIGNED
      acc.set(macro, round2((acc.get(macro) || 0) + amount))
    }
  }
  return acc
}

// ── Report MENSILE per macro di MENÙ ───────────────────────────────────
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

// Costruisce la tabella mensile per macro di menù.
//   months: elenco di 'YYYY-MM' da mostrare (colonne), es. i 12 mesi dell'anno.
//   macros: [{ id, name }] — le macro del MENÙ, nell'ordine voluto.
// Ritorna { months, rows, totByMonth, grand }: rows ha una voce per macro
// (più «Non attribuito» se ci sono importi orfani), ognuna con byMonth e tot.
// Ogni cella di una macro porta `incidenza` (quota sul margine di quel
// mese); ogni cella dei totali porta `incidenzaAnno` (quota sull'incassato
// dell'anno mostrato).
export function macroMonthlyReport({
  orders,
  drinksById,
  itemsById,
  menuCatToMacro,
  macros,
  months,
  cutoffHour = DEFAULT_CUTOFF_HOUR,
  saleVat = 0,
}) {
  const monthSet = new Set(months || [])
  // cells: Map 'macroKey|mese' → { incasso, costo }
  const cells = new Map()

  for (const o of orders || []) {
    if (o?.status === ORDER_STATUSES.ANNULLATO) continue
    const month = (businessDayKey(o?.created_at, cutoffHour) || '').slice(0, 7)
    if (!monthSet.has(month)) continue
    const factor = discountFactor(o)
    for (const li of orderLines(o)) {
      const r = lineByMacro(li, drinksById?.[li.drink_id], itemsById, menuCatToMacro, {
        saleVat,
        factor,
      })
      accumula(cells, `${r.macro}|${month}`, r)
    }
  }

  // Righe: le macro nell'ordine dato, più «Non attribuito» se ha importi.
  const macroRows = [...(macros || [])]
  if ([...cells.keys()].some((k) => k.startsWith(`${UNASSIGNED}|`))) {
    macroRows.push({ id: UNASSIGNED, name: 'Non attribuito' })
  }

  const rows = macroRows.map((m) => {
    const byMonth = new Map()
    const tot = emptyCell()
    for (const month of months || []) {
      const c = cells.get(`${m.id}|${month}`) || emptyCell()
      byMonth.set(month, withDerived(c))
      tot.incasso = round2(tot.incasso + c.incasso)
      tot.costo = round2(tot.costo + c.costo)
    }
    return { id: m.id, name: m.name, byMonth, tot: withDerived(tot) }
  })

  // Totali per colonna (tutte le macro) e totale generale.
  const totByMonth = new Map()
  const grand = emptyCell()
  for (const month of months || []) {
    const t = emptyCell()
    for (const r of rows) {
      const c = r.byMonth.get(month)
      t.incasso = round2(t.incasso + c.incasso)
      t.costo = round2(t.costo + c.costo)
    }
    totByMonth.set(month, withDerived(t))
    grand.incasso = round2(grand.incasso + t.incasso)
    grand.costo = round2(grand.costo + t.costo)
  }

  const totale = withDerived(grand)

  // Secondo giro: le incidenze si possono calcolare solo adesso, perché
  // hanno bisogno del totale della colonna (il margine di tutte le macro in
  // quel mese) e del totale dell'anno.
  for (const r of rows) {
    for (const month of months || []) {
      const c = r.byMonth.get(month)
      c.incidenza = incidenza(c.margine, totByMonth.get(month)?.margine)
    }
    r.tot.incidenza = incidenza(r.tot.margine, totale.margine)
  }
  for (const month of months || []) {
    const t = totByMonth.get(month)
    t.incidenzaAnno = incidenza(t.incasso, totale.incasso)
  }
  // L'anno su se stesso fa 100: non è una domanda, ma la colonna TOT deve
  // pur dire qualcosa, e un vuoto lì sembrerebbe un conto che non è tornato.
  totale.incidenzaAnno = incidenza(totale.incasso, totale.incasso)
  totale.incidenza = incidenza(totale.margine, totale.margine)

  return { months: months || [], rows, totByMonth, grand: totale }
}
