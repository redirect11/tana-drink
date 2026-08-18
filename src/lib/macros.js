// MACRO-CATEGORIE: raggruppano le categorie d'inventario in pochi gruppi
// (es. Distillati, Birre+Bibite, Vino, Food+Moka) su cui fare i conti di
// acquisti e fatturato. Il legame è: item → category_id → categoria →
// macro_id → macro. Una categoria appartiene ad AL PIÙ una macro (così le
// somme non contano due volte lo stesso item).
//
// Logica pura (niente Firebase), interamente testabile.

// Raggruppa le categorie sotto le rispettive macro.
//   macros:     [{ id, name, sort_order }]        (già ordinate o no)
//   categories: [{ id, name, macro_id? }]
// Ritorna { groups, unassigned }:
//   groups     = [{ ...macro, categories: [cat…] }] nell'ordine delle macro
//   unassigned = categorie senza macro (o con macro_id che non esiste più)
export function groupCategoriesByMacro(macros, categories) {
  const ordered = [...(macros || [])].sort(
    (a, b) => (a.sort_order - b.sort_order) || String(a.name).localeCompare(String(b.name))
  )
  const known = new Set(ordered.map((m) => m.id))
  const byMacro = new Map(ordered.map((m) => [m.id, []]))
  const unassigned = []
  for (const c of categories || []) {
    if (c.macro_id && known.has(c.macro_id)) byMacro.get(c.macro_id).push(c)
    else unassigned.push(c)
  }
  const sortCats = (arr) =>
    arr.sort((a, b) => (a.sort_order - b.sort_order) || String(a.name).localeCompare(String(b.name)))
  return {
    groups: ordered.map((m) => ({ ...m, categories: sortCats(byMacro.get(m.id)) })),
    unassigned: sortCats(unassigned),
  }
}

// Mappa id-categoria → id-macro, per risalire in fretta dall'item alla macro.
export function categoryToMacro(categories) {
  const m = new Map()
  for (const c of categories || []) if (c.macro_id) m.set(c.id, c.macro_id)
  return m
}

// Macro di un item, risalendo dalla sua categoria. Null se l'item non ha
// categoria o la categoria non è in nessuna macro.
export function macroOfItem(item, catToMacro) {
  const catId = item?.category_id
  if (!catId) return null
  return catToMacro?.get?.(catId) ?? null
}

// Macro di un DRINK di catalogo, risalendo dalla sua categoria di MENÙ.
// Stessa catena dell'item, altro elenco: le macro del menù raggruppano le
// categorie dei drink che si vendono (`ambito: 'menu'`), quelle di
// magazzino le categorie dei prodotti che si comprano. Null se il drink non
// ha categoria o la categoria non è in nessuna macro.
export function macroOfDrink(drink, menuCatToMacro) {
  const catId = drink?.category_id
  if (!catId) return null
  return menuCatToMacro?.get?.(catId) ?? null
}
