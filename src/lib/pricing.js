// PREZZO CONSIGLIATO di un drink a partire dal costo degli ingredienti.
//
// Il costo al dettaglio di ogni ingrediente (€ per cl/ml/g/mg/pz) si
// ricava dall'inventario: costo confezione ÷ contenuto (vedi costPerUnit
// in inventory.js). Sommando qty × costo unitario si ottiene il costo
// della ricetta; il prezzo consigliato è quel costo moltiplicato per il
// RICARICO — di norma ×3, ma dipende dal drink e da quanto costano gli
// ingredienti, quindi è un'impostazione e resta sempre modificabile a mano.
//
// Logica pura (niente Firebase), interamente testabile.

import { costPerUnit } from './inventory.js'

export const DEFAULT_MARKUP = 3
export const DEFAULT_ROUND_STEP = 0.5

// Costo degli ingredienti di una ricetta.
//   rows: [{ inventory_item_id, name, qty, unit }]
//   itemsById: { [id]: item di inventario }
// Ritorna { cost, missing } dove `missing` elenca gli ingredienti di cui
// non si conosce il costo: il totale è quindi PARZIALE e va detto.
export function recipeCost(rows, itemsById, { gross = true } = {}) {
  let cost = 0
  const missing = []
  for (const r of rows || []) {
    const qty = Number(r?.qty) || 0
    if (qty <= 0) continue
    const item = itemsById?.[r.inventory_item_id]
    const per = item ? costPerUnit(item, r.unit, { gross }) : null
    if (per == null) {
      missing.push(r?.name || r?.inventory_item_id || '?')
      continue
    }
    cost += per * qty
  }
  return { cost: Math.round(cost * 10000) / 10000, missing }
}

// Arrotondamento "da listino": per eccesso al passo scelto (0,50 €).
export function roundPrice(value, step = DEFAULT_ROUND_STEP) {
  const v = Number(value)
  const s = Number(step) > 0 ? Number(step) : DEFAULT_ROUND_STEP
  if (!Number.isFinite(v) || v <= 0) return null
  return Math.round(Math.ceil(v / s) * s * 100) / 100
}

// Prezzo consigliato = costo × ricarico, arrotondato. Null se non si può
// calcolare (costo sconosciuto o nullo).
export function suggestedPrice(cost, { markup = DEFAULT_MARKUP, step = DEFAULT_ROUND_STEP } = {}) {
  const c = Number(cost) || 0
  const m = Number(markup) || 0
  if (!(c > 0) || !(m > 0)) return null
  return roundPrice(c * m, step)
}

// Ricarico effettivo di un prezzo rispetto al costo (es. 2.8 = ×2,8):
// serve a mostrare al bartender dove si sta posizionando davvero.
export function markupOf(price, cost) {
  const p = Number(price) || 0
  const c = Number(cost) || 0
  if (!(c > 0) || !(p > 0)) return null
  return Math.round((p / c) * 100) / 100
}

// Margine in euro (prezzo − costo).
export function marginOf(price, cost) {
  const p = Number(price) || 0
  const c = Number(cost) || 0
  if (!(p > 0)) return null
  return Math.round((p - c) * 100) / 100
}

// ── Marginalità del listino ───────────────────────────────────────────
// Per ogni drink con una ricetta: quanto costa, a quanto è venduto e che
// ricarico ne esce. Serve a trovare a colpo d'occhio le voci fuori linea
// (tipicamente le birre premium, che costano molto e si vendono a poco).
//
//  stato: 'sotto'    → ricarico inferiore all'obiettivo
//         'ok'       → in linea o meglio
//         'parziale' → manca il costo di qualche ingrediente: il ricarico
//                      calcolato è per forza ottimistico, non è un giudizio
//         'no_costo' → nessun ingrediente valorizzato, niente da dire
export function marginReport(drinks, itemsById, { markup = DEFAULT_MARKUP } = {}) {
  const righe = []
  for (const d of drinks || []) {
    const recipe = d?.recipe_items || []
    if (recipe.length === 0) continue
    const { cost, missing } = recipeCost(recipe, itemsById)
    const price = Number(d.price) || 0
    const stato =
      cost <= 0 ? 'no_costo' : missing.length ? 'parziale' : markupOf(price, cost) < markup ? 'sotto' : 'ok'
    righe.push({
      id: d.id,
      name: d.name,
      // La categoria del menù: la tabella si legge divisa per categorie.
      category_id: d.category_id ?? null,
      category: d.category ?? null,
      price,
      cost,
      missing,
      suggested: suggestedPrice(cost, { markup }),
      markup: markupOf(price, cost),
      margin: marginOf(price, cost),
      stato,
    })
  }
  // I casi da sistemare per primi: ricarico più basso in cima.
  righe.sort((a, b) => {
    const rank = { sotto: 0, ok: 1, parziale: 2, no_costo: 3 }
    if (rank[a.stato] !== rank[b.stato]) return rank[a.stato] - rank[b.stato]
    return (a.markup ?? Infinity) - (b.markup ?? Infinity)
  })
  const conta = (s) => righe.filter((r) => r.stato === s).length
  return {
    righe,
    totali: righe.length,
    sotto: conta('sotto'),
    ok: conta('ok'),
    parziali: conta('parziale'),
    senzaCosto: conta('no_costo'),
  }
}

// ── La marginalità in tabella: ordine e categorie (REQ-MENU-002) ──────
// Flavio, 22/10/2026: «bisognerebbe mettere sempre la divisione in
// categorie … poter vedere questo confronto, o vederlo così tutto
// mischiato … anche la possibilità di metterlo in ordine secondo
// determinati valori», cioè ricarico, margine, costo, prezzo.

// Le righe ordinate su una colonna: 'name', 'cost', 'price', 'margin',
// 'markup'. I valori che mancano (un ricarico senza costo) stanno sempre
// in fondo, in qualunque verso: non sono né i migliori né i peggiori.
// A parità si va per nome, così l'ordine non salta fra un giro e l'altro.
export function ordinaMargini(righe, { col = 'markup', dir = 'asc' } = {}) {
  const segno = dir === 'desc' ? -1 : 1
  const perNome = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'it')
  return [...(righe || [])].sort((a, b) => {
    if (col === 'name') return segno * perNome(a, b)
    const va = a[col]
    const vb = b[col]
    if (va == null && vb == null) return perNome(a, b)
    if (va == null) return 1
    if (vb == null) return -1
    return segno * (va - vb) || perNome(a, b)
  })
}

// Le righe divise per categoria del menù, nell'ordine delle categorie
// (sort_order), con «Senza categoria» in fondo. Una voce vecchia che ha
// solo il NOME della categoria si riconosce dal nome. Per ogni categoria
// anche il ricarico e il margine medi, sulle voci che li hanno: è il
// confronto fra famiglie che una lista mischiata non fa vedere.
// Le righe dentro ogni categoria restano nell'ordine in cui arrivano.
export function marginiPerCategoria(righe, categorie) {
  const ordine = [...(categorie || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const gruppi = new Map(ordine.map((c) => [c.id, { id: c.id, nome: c.name, categoria: c, righe: [] }]))
  const perNome = new Map(ordine.map((c) => [c.name, c.id]))
  const senza = { id: 'none', nome: 'Senza categoria', categoria: null, righe: [] }
  for (const r of righe || []) {
    const id = gruppi.has(r.category_id) ? r.category_id : perNome.get(r.category)
    ;(gruppi.get(id) || senza).righe.push(r)
  }
  const media = (valori) => {
    const v = valori.filter((x) => x != null)
    return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 100) / 100 : null
  }
  return [...gruppi.values(), senza]
    .filter((g) => g.righe.length > 0)
    .map((g) => ({
      ...g,
      ricaricoMedio: media(g.righe.map((r) => r.markup)),
      margineMedio: media(g.righe.map((r) => r.margin)),
    }))
}
