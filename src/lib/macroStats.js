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
export function splitLineRevenueByMacro(line, drink, itemsById, catToMacro) {
  const out = new Map()
  const revenue = round2((Number(line?.qty) || 0) * (Number(line?.unit_price) || 0))
  if (revenue <= 0) return out

  const recipe = Array.isArray(line?.recipe_items)
    ? line.recipe_items
    : Array.isArray(drink?.recipe_items)
      ? drink.recipe_items
      : []

  // Peso di ogni ingrediente = costo (qty × costo unitario), aggregato per macro.
  const weights = new Map()
  let tot = 0
  for (const ri of recipe) {
    const item = itemsById?.[ri.inventory_item_id]
    const per = item ? costPerUnit(item, ri.unit, { gross: true }) : null
    const w = per != null ? per * (Number(ri.qty) || 0) : 0
    if (w <= 0) continue
    const macro = (item && macroOfItem(item, catToMacro)) || UNASSIGNED
    weights.set(macro, (weights.get(macro) || 0) + w)
    tot += w
  }

  if (tot <= 0) {
    out.set(UNASSIGNED, revenue)
    return out
  }

  // Ripartisci l'incasso REALE in proporzione ai pesi. L'ultima quota prende
  // il resto, così la somma torna esatta al centesimo.
  const keys = [...weights.keys()]
  let assigned = 0
  keys.forEach((k, i) => {
    const share = i === keys.length - 1 ? round2(revenue - assigned) : round2((revenue * weights.get(k)) / tot)
    assigned = round2(assigned + share)
    out.set(k, share)
  })
  return out
}

// Estrae le righe vendute di un ordine (order_items o, in mancanza, le comande).
function orderLines(o) {
  return o?.order_items || (o?.comande || []).flatMap((c) => c.items || []) || []
}

// Fatturato per macro su un insieme di ordini (già filtrati dei validi a monte,
// oppure passa `skipCancelled`). Ritorna Map macroKey → incasso.
export function revenueByMacro(orders, { drinksById, itemsById, catToMacro }) {
  const acc = new Map()
  for (const o of orders || []) {
    for (const li of orderLines(o)) {
      const split = splitLineRevenueByMacro(li, drinksById?.[li.drink_id], itemsById, catToMacro)
      for (const [k, v] of split) acc.set(k, round2((acc.get(k) || 0) + v))
    }
  }
  return acc
}
