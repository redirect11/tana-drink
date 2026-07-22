// Logica pura dell'inventario (niente Firebase): unità, formattazione,
// stato scorte e calcolo del consumo. Interamente testabile a unità.

// Unità base in cui è salvato lo stock: volumi in ml, pesi in g, conteggi in pz.
export const BASE_UNITS = ['ml', 'g', 'pz']

// Unità selezionabili in fase di inserimento ricetta, per unità base dell'item.
// Sono le unità "piccole" con cui si dosa un drink (mai L/kg in una ricetta):
// liquidi in cl/ml, solidi in g/mg. Devono restare un sottoinsieme di quelle
// gestite da costPerUnit, altrimenti il costo dell'ingrediente andrebbe perso.
export const ENTRY_UNITS = {
  ml: ['cl', 'ml'],
  g: ['g', 'mg'],
  pz: ['pz'],
}

// Converte una quantità dall'unità inserita all'unità base dell'item.
//   cl→ml (×10), L→ml (×1000), kg→g (×1000); ml/g/pz invariati.
export function toBaseQty(qty, unit) {
  const n = Number(qty) || 0
  switch ((unit || '').toLowerCase()) {
    case 'cl':
      return n * 10
    case 'l':
      return n * 1000
    case 'kg':
      return n * 1000
    case 'mg':
      return n * 0.001
    default:
      return n
  }
}

// Unità base (in cui è salvato lo stock) a partire dall'unità scelta
// dall'utente: liquidi → ml, pesi → g, pezzi → pz.
export function baseUnit(u) {
  const x = String(u || '').toLowerCase()
  if (['l', 'cl', 'ml'].includes(x)) return 'ml'
  if (['kg', 'g', 'mg'].includes(x)) return 'g'
  return 'pz'
}

// Inverso di toBaseQty: da unità base al numero nell'unità scelta.
export function fromBaseQty(base, unit) {
  const n = Number(base) || 0
  switch (String(unit || '').toLowerCase()) {
    case 'l':
    case 'kg':
      return n / 1000
    case 'cl':
      return n / 10
    case 'mg':
      return n * 1000
    default:
      return n
  }
}

// Formatta una quantità BASE nell'unità ESATTA scelta (niente auto-scaling:
// se l'utente lavora in cl, vede cl). Etichette: L, cl, ml, kg, g, mg, pz.
const UNIT_LABEL = { l: 'L', cl: 'cl', ml: 'ml', kg: 'kg', g: 'g', mg: 'mg', pz: 'pz' }
export function formatIn(base, unit) {
  const n = Math.round(fromBaseQty(base, unit) * 100) / 100
  return `${n.toLocaleString('it-IT', { maximumFractionDigits: 2 })} ${UNIT_LABEL[String(unit || '').toLowerCase()] || unit}`
}

// Formatta la giacenza di un ITEM: nell'unità scelta se impostata, altrimenti
// auto (retrocompatibile con gli item senza unità di visualizzazione).
export function fmtItem(base, item) {
  return item?.display_unit ? formatIn(base, item.display_unit) : formatQty(base, item?.unit)
}

// Formatta una quantità (in unità base) in modo leggibile.
export function formatQty(qty, unit) {
  const n = Number(qty) || 0
  if (unit === 'ml') {
    if (n >= 1000) return `${(n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 2 })} L`
    if (n >= 100 && n % 10 === 0) return `${n / 10} cl`
    return `${n} ml`
  }
  if (unit === 'g') {
    if (n >= 1000) return `${(n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kg`
    return `${n} g`
  }
  return `${n} pz`
}

// Scompone la giacenza (in unità base) nelle bottiglie/confezioni:
//   - full:      bottiglie piene sigillate
//   - openRemaining: contenuto della bottiglia attualmente in uso (0 se nessuna)
//   - finished:  bottiglie ormai vuote (di quelle totali caricate)
// Esempio: bottiglia 1 L, 4 totali, stock 2,5 L → full 2, openRemaining 0,5 L, finished 1.
// Ritorna null per i prodotti a pezzi o senza confezione.
export function bottleBreakdown(item) {
  const size = Number(item?.package_size) || 0
  if (item?.unit === 'pz' || !size) return null
  const stock = Math.max(0, Number(item?.stock) || 0)
  const total = Number(item?.bottles_total) || 0
  const full = Math.floor(stock / size)
  const openRemaining = stock - full * size
  const hasOpen = openRemaining > 1e-9
  const withContent = full + (hasOpen ? 1 : 0)
  const finished = Math.max(0, total - withContent)
  return { full, openRemaining, hasOpen, finished, total }
}

// Giacenza di un item da DRINK (bottiglie/confezioni frazionabili), coi
// tre dati che servono al banco, ognuno nella SUA unità:
//   - bottles: quante bottiglie con contenuto (piene + quella aperta)
//   - total:   contenuto totale nell'unità dell'item (cl/ml/g)
//   - open:    residuo della bottiglia aperta, stessa unità (null se nessuna)
// Il conteggio bottiglie è un numero di pezzi; il CONTENUTO non si misura
// mai in pezzi. Null per gli articoli a pezzo, che non si frazionano.
export function bottleSummary(item) {
  const bd = bottleBreakdown(item)
  if (!bd) return null
  return {
    bottles: bd.full + (bd.hasOpen ? 1 : 0),
    total: fmtItem(Math.max(0, Number(item?.stock) || 0), item),
    open: bd.hasOpen ? fmtItem(Math.round(bd.openRemaining), item) : null,
  }
}

// Stato scorta di un item: 'empty' (≤0), 'low' (≤ soglia), 'ok'.
export function stockStatus(item) {
  const stock = Number(item?.stock) || 0
  if (stock <= 0) return 'empty'
  if (stock <= (Number(item?.low_threshold) || 0)) return 'low'
  return 'ok'
}

// Conteggi per i chip di riepilogo: totale prodotti, in esaurimento, esauriti.
export function inventorySummary(items) {
  let total = 0
  let low = 0
  let empty = 0
  for (const it of items || []) {
    total += 1
    const st = stockStatus(it)
    if (st === 'low') low += 1
    else if (st === 'empty') empty += 1
  }
  return { total, low, empty }
}

// Filtra/ordina la lista inventario per ricerca (nome), categoria, fornitore e stato.
//   filters: { query?, categoryId? ('all'|id|'none'), supplierId? ('all'|id|'none'),
//              status? ('all'|'ok'|'low'|'empty') }
export function filterItems(items, { query = '', categoryId = 'all', supplierId = 'all', status = 'all' } = {}) {
  const q = query.trim().toLowerCase()
  const out = (items || []).filter((it) => {
    if (q && !(it.name || '').toLowerCase().includes(q)) return false
    if (categoryId === 'none') {
      if (it.category_id) return false
    } else if (categoryId !== 'all') {
      if (it.category_id !== categoryId) return false
    }
    if (supplierId === 'none') {
      if (it.supplier_id) return false
    } else if (supplierId !== 'all') {
      if (it.supplier_id !== supplierId) return false
    }
    if (status !== 'all' && stockStatus(it) !== status) return false
    return true
  })
  out.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  return out
}

// ── Costi e valorizzazione ─────────────────────────────────────────────

// Prezzo con IVA a partire dal netto e dall'aliquota (%).
export function costWithVat(cost, vat = 22) {
  return (Number(cost) || 0) * (1 + (Number(vat) || 0) / 100)
}

// Numero di confezioni/bottiglie equivalenti in giacenza.
export function unitsInStock(item) {
  const stock = Number(item?.stock) || 0
  if (item?.unit === 'pz') return stock
  const size = Number(item?.package_size) || 0
  return size > 0 ? stock / size : 0
}

// Valore della giacenza di un item (default con IVA).
export function stockValue(item, { gross = true } = {}) {
  const unit = gross ? costWithVat(item?.cost, item?.vat) : (Number(item?.cost) || 0)
  return unitsInStock(item) * unit
}

// Costo per cl (volumi): costo confezione / cl per confezione. null se non applicabile.
export function costPerCl(item, { gross = true } = {}) {
  if (item?.unit !== 'ml') return null
  const size = Number(item?.package_size) || 0
  if (size <= 0) return null
  const unit = gross ? costWithVat(item?.cost, item?.vat) : (Number(item?.cost) || 0)
  return unit / (size / 10)
}

// Unità di misura "piccole" adatte a mostrare il prezzo unitario:
// liquidi (base ml) → cl o ml; solidi (base g) → g o mg; pezzi → pz.
export function smallUnits(item) {
  if (item?.unit === 'ml') return ['cl', 'ml']
  if (item?.unit === 'g') return ['g', 'mg']
  return ['pz']
}

// Quante unità base (ml/g) vale 1 unità di misura. Copre TUTTE le unità
// gestite (comprese L/kg), non solo le "piccole": così un costo non va mai
// perso in silenzio per un'unità non prevista. Deve restare coerente con
// toBaseQty (stessi fattori di conversione).
const BASE_PER_UNIT = { l: 1000, cl: 10, ml: 1, kg: 1000, g: 1, mg: 0.001, pz: 1 }

// Costo di una singola unità (L/cl/ml/kg/g/mg/pz) partendo dal costo per
// confezione: cost / (package_size / base-per-unità). Null se non calcolabile.
// L'unità richiesta deve appartenere alla stessa famiglia dell'item
// (liquido↔ml, solido↔g): chiedere il costo al ml di un solido non ha senso.
export function costPerUnit(item, unit, { gross = true } = {}) {
  const packCost = gross ? costWithVat(item?.cost, item?.vat) : Number(item?.cost) || 0
  if (!(packCost > 0)) return null
  if ((item?.unit || 'pz') === 'pz') return unit === 'pz' ? packCost : null
  const per = BASE_PER_UNIT[String(unit || '').toLowerCase()]
  if (!per || baseUnit(unit) !== item.unit) return null
  const size = Number(item?.package_size) || 0
  if (size <= 0) return null
  return packCost / (size / per)
}

// Valore totale del magazzino.
export function inventoryTotalValue(items, opts) {
  return (items || []).reduce((s, it) => s + stockValue(it, opts), 0)
}

// Calcola il consumo totale per ingrediente da una lista di order_items.
//   orderItems: [{ drink_id, qty, recipe_items? }]
//   drinksById: { [drinkId]: { recipe_items: [{ inventory_item_id, name, unit, qty }] } }
// Gli item "custom" (drink composti al volo dal bartender) portano la ricetta
// incorporata in `recipe_items`: ha la precedenza sulla ricetta del catalogo.
// Ritorna: [{ inventory_item_id, name, unit, qty }] con qty in unità base.
export function computeConsumption(orderItems, drinksById) {
  const acc = new Map()
  for (const oi of orderItems || []) {
    const recipe = Array.isArray(oi.recipe_items)
      ? oi.recipe_items
      : drinksById?.[oi.drink_id]?.recipe_items
    if (!Array.isArray(recipe)) continue
    const mult = Number(oi.qty) || 0
    for (const ri of recipe) {
      if (!ri.inventory_item_id) continue
      const add = (Number(ri.qty) || 0) * mult
      if (add <= 0) continue
      const ex = acc.get(ri.inventory_item_id)
      if (ex) ex.qty += add
      else acc.set(ri.inventory_item_id, {
        inventory_item_id: ri.inventory_item_id,
        name: ri.name ?? null,
        unit: ri.unit ?? 'pz',
        qty: add,
      })
    }
  }
  return [...acc.values()]
}
