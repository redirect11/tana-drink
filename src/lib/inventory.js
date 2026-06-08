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

// Calcola il consumo totale per ingrediente da una lista di order_items.
//   orderItems: [{ drink_id, qty }]
//   drinksById: { [drinkId]: { recipe_items: [{ inventory_item_id, name, unit, qty }] } }
// Ritorna: [{ inventory_item_id, name, unit, qty }] con qty in unità base.
export function computeConsumption(orderItems, drinksById) {
  const acc = new Map()
  for (const oi of orderItems || []) {
    const recipe = drinksById?.[oi.drink_id]?.recipe_items
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
