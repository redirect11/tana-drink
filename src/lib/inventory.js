// Logica pura dell'inventario (niente Firebase): unità, formattazione,
// stato scorte e calcolo del consumo. Interamente testabile a unità.

// Unità base in cui è salvato lo stock: volumi in ml, pesi in g, conteggi in pz.
export const BASE_UNITS = ['ml', 'g', 'pz']

// Unità selezionabili in fase di inserimento ricetta, per unità base dell'item.
export const ENTRY_UNITS = {
  ml: ['cl', 'ml'],
  g: ['g', 'kg'],
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
    default:
      return n
  }
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
