// ── I PRODOTTI IN FILA COME GLI SCAFFALI ─────────────────────────────
//
// Flavio, vocale del 21/09/2026: «a me serve in ordine alfabetico, ma per
// categorie, perché le categorie ce l'ho quasi tutte vicine». Si conta
// girando per il locale, e gli scaffali sono per categoria. Lo usano le due
// pagine che fanno contare: l'inventario (REQ-MAG-047) e il controllo del
// magazzino di prova (REQ-MAG-050).
//
// `elenco`: cose con `item_id` e `name`. `items`: gli articoli, per la loro
// categoria. `categorie`: nell'ordine del magazzino (sort_order), come le
// dà fetchInventoryCategories.
// Torna le voci per la barra (CategoryRail) e i gruppi da disegnare, ognuno
// con gli id in ordine alfabetico. Quelli senza categoria stanno in fondo.

const collator = new Intl.Collator('it')

export function perScaffale(elenco, items, categorie) {
  const catDi = new Map((items || []).map((i) => [i.id, i.category_id]))
  const perCat = new Map((categorie || []).map((c, i) => [c.id, { i, nome: c.name, righe: [] }]))
  const senza = { i: Infinity, nome: 'Senza categoria', righe: [] }
  for (const x of elenco || []) (perCat.get(catDi.get(x.item_id)) || senza).righe.push(x)
  const tutti = [...perCat.entries(), ['none', senza]]
    .filter(([, g]) => g.righe.length > 0)
    .sort(([, a], [, b]) => a.i - b.i)
  for (const [, g] of tutti) g.righe.sort((a, b) => collator.compare(String(a.name), String(b.name)))
  return {
    voci: [
      { key: 'all', label: 'Tutte', count: (elenco || []).length },
      ...tutti.map(([key, g]) => ({ key, label: g.nome, count: g.righe.length })),
    ],
    gruppi: tutti.map(([key, g]) => ({ key, nome: g.nome, ids: g.righe.map((x) => x.item_id) })),
  }
}
