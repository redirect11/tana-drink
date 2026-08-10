// Personalizzazioni della GRIGLIA PRODOTTI del POS, ricordate per
// dispositivo (localStorage): ordine manuale delle card, drink preferiti e
// item usati di recente. Logica pura + accessi storage; nessuna dipendenza
// Firebase. Le parti pure sono testate a unità.

// ── Ordine manuale delle card (vista "Tutti") ──────────────────────────
// Ordina i drink secondo una sequenza di id salvata; quelli non presenti
// nella sequenza (nuovi prodotti) restano in coda nell'ordine di partenza.
export function applyOrder(drinks, orderIds) {
  if (!orderIds || orderIds.length === 0) return drinks || []
  const pos = new Map(orderIds.map((id, i) => [id, i]))
  const known = []
  const rest = []
  for (const d of drinks || []) (pos.has(d.id) ? known : rest).push(d)
  known.sort((a, b) => pos.get(a.id) - pos.get(b.id))
  return [...known, ...rest]
}

// Nuovo ordine dopo aver spostato un id da una posizione all'altra, sulla
// lista VISIBILE (poi si fondono le posizioni degli altri drink noti).
export function moveInOrder(currentIds, fromId, toId) {
  const arr = [...(currentIds || [])]
  const from = arr.indexOf(fromId)
  let to = arr.indexOf(toId)
  if (from === -1 || to === -1 || from === to) return currentIds || []
  arr.splice(from, 1)
  to = arr.indexOf(toId)
  arr.splice(to + (from < to ? 1 : 0), 0, fromId)
  return arr
}

// ── Preferiti ──────────────────────────────────────────────────────────
export function toggleFavorite(ids, id) {
  const set = new Set(ids || [])
  if (set.has(id)) set.delete(id)
  else set.add(id)
  return [...set]
}

// ── Recenti: ultimi N item distinti aggiunti agli ordini ───────────────
// Dagli ordini (più recenti prima), estrae gli id drink NON custom in
// ordine di comparsa, deduplicati, fino a `limit`.
export function recentDrinkIds(orders, limit = 20) {
  const seen = new Set()
  const out = []
  for (const o of orders || []) {
    const items = o?.order_items || (o?.comande || []).flatMap((c) => c.items || [])
    for (const it of items) {
      if (it?.custom || !it?.drink_id || seen.has(it.drink_id)) continue
      seen.add(it.drink_id)
      out.push(it.drink_id)
      if (out.length >= limit) return out
    }
  }
  return out
}

// ── Persistenza (localStorage) ─────────────────────────────────────────
const read = (key, def) => {
  try {
    const raw = localStorage.getItem(key)
    const v = raw ? JSON.parse(raw) : def
    return Array.isArray(v) ? v : def
  } catch {
    return def
  }
}
const write = (key, arr) => {
  try {
    localStorage.setItem(key, JSON.stringify(arr || []))
  } catch {
    /* quota/privata: resta in memoria */
  }
}

export const loadOrder = () => read('tana:pos:order', [])
export const saveOrder = (ids) => write('tana:pos:order', ids)
export const loadFavorites = () => read('tana:pos:favorites', [])
export const saveFavorites = (ids) => write('tana:pos:favorites', ids)

// ── Colore del "tab" (angolo) per prodotto: mappa { drinkId: colore } ──
export const loadColors = () => {
  try {
    const raw = localStorage.getItem('tana:pos:colors')
    const v = raw ? JSON.parse(raw) : {}
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}
export const saveColors = (map) => {
  try {
    localStorage.setItem('tana:pos:colors', JSON.stringify(map || {}))
  } catch {
    /* quota/privata: resta in memoria */
  }
}
