// FATTURATO per MACRO-CATEGORIA.
//
// L'incasso di un drink composto NON si attribuisce al drink intero, ma si
// RIPARTISCE tra le macro-categorie degli ingredienti che contiene, in
// proporzione al VALORE (costo) di ciascun ingrediente al cl/g. La somma delle
// quote è SEMPRE il prezzo davvero incassato: nessun euro inventato o perso,
// così il "fatturato per macro" coincide con l'incasso reale.
//
// Es. Negroni 7 € = 3cl gin + 3cl bitter + 3cl vermouth → le quote di 7 €
// vanno su Distillati (gin, bitter) e Vino (vermouth) secondo i loro pesi.
//
// Gli ingredienti senza macro o senza costo confluiscono nella chiave `none`
// (non attribuito): restano nel totale ma segnalati a parte.
//
// Logica pura (niente Firebase), interamente testabile.

import { costPerUnit } from './inventory.js'
import { macroOfItem } from './macros.js'
import { businessDayKey, DEFAULT_CUTOFF_HOUR } from './businessDay.js'
import { ORDER_STATUSES } from './orderStatus.js'
import { discountFactor } from './eta.js'

// Chiave usata per l'incasso non attribuibile a nessuna macro.
export const UNASSIGNED = 'none'

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// Ripartisce l'incasso di UNA riga d'ordine tra le macro degli ingredienti.
//   line:  { drink_id, qty, unit_price, recipe_items? }  (recipe_items sui custom)
//   drink: il drink di catalogo (per la ricetta se la riga non ce l'ha)
//   itemsById:  { [inventory_item_id]: item }
//   catToMacro: Map id-categoria → id-macro (da macros.categoryToMacro)
// Ritorna Map macroKey → incasso (arrotondato ai centesimi; la somma = incasso
// della riga). Riga senza ricetta/costi → tutto su `none`.
// opts:
//   netByVat    → scorpora l'IVA da ogni quota usando l'aliquota del PRODOTTO
//                 (item.vat: può differire per food/acqua/alcolici).
//   fallbackVat → aliquota per le quote senza prodotto (ingredienti/drink non
//                 collegati all'inventario).
//   factor      → quota di prezzo davvero incassata (1 = nessuno sconto). Il
//                 margine si calcola su quello che è entrato, non sul listino.
export function splitLineRevenueByMacro(line, drink, itemsById, catToMacro, opts = {}) {
  const { netByVat = false, fallbackVat = 0, factor = 1 } = opts
  const out = new Map()
  const revenue = round2(
    (Number(line?.qty) || 0) * (Number(line?.unit_price) || 0) * (Number(factor) || 0)
  )
  if (revenue <= 0) return out
  const net = (val, vat) => (netByVat ? val / (1 + (Number(vat) || 0) / 100) : val)
  const add = (k, val) => out.set(k, round2((out.get(k) || 0) + val))

  const recipe = Array.isArray(line?.recipe_items)
    ? line.recipe_items
    : Array.isArray(drink?.recipe_items)
      ? drink.recipe_items
      : []

  // Un pezzo per ingrediente: peso = costo (qty × costo unitario), macro e
  // aliquota IVA del prodotto (per lo scorporo al netto per-prodotto).
  const parts = []
  let tot = 0
  for (const ri of recipe) {
    const item = itemsById?.[ri.inventory_item_id]
    // Peso = costo NETTO dell'ingrediente: la ripartizione non deve dipendere
    // dall'IVA (che si scorpora dopo, per prodotto).
    const per = item ? costPerUnit(item, ri.unit, { gross: false }) : null
    const w = per != null ? per * (Number(ri.qty) || 0) : 0
    if (w <= 0) continue
    parts.push({
      macro: (item && macroOfItem(item, catToMacro)) || UNASSIGNED,
      w,
      vat: item?.vat ?? fallbackVat,
    })
    tot += w
  }

  if (tot <= 0) {
    // Nessun ingrediente valorizzato: tutto non attribuito (netto col ripiego).
    add(UNASSIGNED, net(revenue, fallbackVat))
    return out
  }

  // Ripartisci l'incasso REALE in proporzione ai pesi. La quota LORDA dell'
  // ultimo pezzo prende il resto, così le quote lorde tornano esatte al
  // centesimo; poi ogni quota si scorpora con l'IVA del suo prodotto.
  let assigned = 0
  parts.forEach((p, i) => {
    const gross = i === parts.length - 1 ? round2(revenue - assigned) : round2((revenue * p.w) / tot)
    assigned = round2(assigned + gross)
    add(p.macro, net(gross, p.vat))
  })
  return out
}

// Estrae le righe vendute di un ordine (order_items o, in mancanza, le comande).
function orderLines(o) {
  return o?.order_items || (o?.comande || []).flatMap((c) => c.items || []) || []
}

// Fatturato per macro su un insieme di ordini. Salta gli annullati. Ritorna
// Map macroKey → incasso.
export function revenueByMacro(orders, { drinksById, itemsById, catToMacro }) {
  const acc = new Map()
  for (const o of orders || []) {
    if (o?.status === ORDER_STATUSES.ANNULLATO) continue
    const factor = discountFactor(o)
    for (const li of orderLines(o)) {
      const split = splitLineRevenueByMacro(li, drinksById?.[li.drink_id], itemsById, catToMacro, {
        factor,
      })
      for (const [k, v] of split) acc.set(k, round2((acc.get(k) || 0) + v))
    }
  }
  return acc
}

// ── ACQUISTI per macro ─────────────────────────────────────────────────
// Dagli ordini fornitori RICEVUTI: per ogni riga, importo netto
// (unit_cost × qty_packages) attribuito alla macro dell'articolo
// (articolo → categoria → macro). Righe di articoli senza macro → `none`.
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

// ── Report MENSILE per macro (Dashboard A) ─────────────────────────────
// Mese del fatturato = giornata commerciale dell'ordine; mese degli acquisti =
// data di arrivo (received_at) dell'ordine fornitore ricevuto.
const monthOfReceived = (po) => String(po?.received_at || po?.created_at || '').slice(0, 7)

// Riga vuota di metriche mensili.
const emptyCell = () => ({ acquisti: 0, fatturato: 0 })
const withDerived = (c) => {
  const utile = round2(c.fatturato - c.acquisti)
  return { ...c, utile, rapporto: c.acquisti > 0 ? round2(c.fatturato / c.acquisti) : null }
}

// Costruisce la tabella mensile per macro.
//   months: elenco di 'YYYY-MM' da mostrare (colonne), es. i 12 mesi dell'anno.
//   macros: [{ id, name }] nell'ordine voluto.
// Ritorna { months, rows, totByMonth, grand } dove rows ha una voce per macro
// (più "Non attribuito" se ci sono importi orfani), ognuna con byMonth e tot.
export function macroMonthlyReport({
  orders,
  purchaseOrders,
  drinksById,
  itemsById,
  catToMacro,
  macros,
  months,
  cutoffHour = DEFAULT_CUTOFF_HOUR,
  saleVat = 0,
}) {
  const monthSet = new Set(months || [])
  // Fatturato al NETTO IVA per prodotto (item.vat), col ripiego `saleVat` per
  // ciò che non ha un articolo collegato: così il confronto con gli acquisti
  // (già netti) è coerente, come si fa per l'utile.
  const netOpts = { netByVat: true, fallbackVat: Number(saleVat) || 0 }
  // cell[macroKey][month] = { acquisti, fatturato }
  const cells = new Map()
  const ensure = (macroKey, month) => {
    let m = cells.get(macroKey)
    if (!m) cells.set(macroKey, (m = new Map()))
    let c = m.get(month)
    if (!c) m.set(month, (c = emptyCell()))
    return c
  }

  // Fatturato: per ordine, mese = giornata commerciale, poi ripartizione macro.
  for (const o of orders || []) {
    if (o?.status === ORDER_STATUSES.ANNULLATO) continue
    const month = (businessDayKey(o?.created_at, cutoffHour) || '').slice(0, 7)
    if (!monthSet.has(month)) continue
    const factor = discountFactor(o)
    for (const li of orderLines(o)) {
      const split = splitLineRevenueByMacro(li, drinksById?.[li.drink_id], itemsById, catToMacro, {
        ...netOpts,
        factor,
      })
      for (const [k, v] of split) {
        const cell = ensure(k, month)
        cell.fatturato = round2(cell.fatturato + v) // già al netto IVA per prodotto
      }
    }
  }

  // Acquisti: per ordine fornitore ricevuto, mese = arrivo.
  for (const po of purchaseOrders || []) {
    if (po?.status !== 'ricevuto') continue
    const month = monthOfReceived(po)
    if (!monthSet.has(month)) continue
    for (const l of po?.lines || []) {
      const amount = round2((Number(l.unit_cost) || 0) * (Number(l.qty_packages) || 0))
      if (amount <= 0) continue
      const item = itemsById?.[l.item_id]
      const macroKey = (item && macroOfItem(item, catToMacro)) || UNASSIGNED
      ensure(macroKey, month).acquisti = round2(ensure(macroKey, month).acquisti + amount)
    }
  }

  // Righe: le macro nell'ordine dato, più "Non attribuito" se ha importi.
  const macroRows = [...(macros || [])]
  if (cells.has(UNASSIGNED)) macroRows.push({ id: UNASSIGNED, name: 'Non attribuito' })

  const rows = macroRows.map((m) => {
    const byMonth = new Map()
    const tot = emptyCell()
    for (const month of months || []) {
      const c = cells.get(m.id)?.get(month) || emptyCell()
      byMonth.set(month, withDerived(c))
      tot.acquisti = round2(tot.acquisti + c.acquisti)
      tot.fatturato = round2(tot.fatturato + c.fatturato)
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
      t.acquisti = round2(t.acquisti + c.acquisti)
      t.fatturato = round2(t.fatturato + c.fatturato)
    }
    totByMonth.set(month, withDerived(t))
    grand.acquisti = round2(grand.acquisti + t.acquisti)
    grand.fatturato = round2(grand.fatturato + t.fatturato)
  }

  return { months: months || [], rows, totByMonth, grand: withDerived(grand) }
}
