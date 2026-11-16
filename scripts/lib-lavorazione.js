// =====================================================================
//  IL TEMPO DI LAVORAZIONE SI DOSA IN U (BUG-164). La parte che si prova
//  dello script `scripts/lavorazione-in-u.js`: quali articoli si contano a
//  unità generiche e quali righe di ricetta vanno riscritte.
//
//  Daniele, 16/11/2026: «tempo di lavorazione quando è presente in ricetta
//  va calcolato come un normale ingrediente quindi deve comparire nei costi,
//  ricordando che il tempo di lavorazione si calcola in U ovvero 1 pz
//  corrisponde a 60 U ed 1 pz costa 10€». L'articolo era già così; le
//  ricette no: 57 righe su 59, in produzione e sul test, lo dosavano in
//  GRAMMI — scritte quando il grammo era l'unica unità possibile («nella
//  ricetta del Daiquiri si leggeva "1 g"», src/lib/inventory.js). Un
//  grammo di un articolo che si conta a U non ha un costo (costPerUnit
//  risponde «non lo so»), e la riga restava fuori dal costo del drink.
//
//  La quantità resta quella scritta: «1,5 g» voleva dire 1,5 unità di
//  lavoro, e diventa 1,5 U (0,25 € a 10 € per 60 U).
// =====================================================================

// L'articolo si dosa a U? Sì se è lui stesso a unità generiche, o se è un
// pezzo che contiene unità (1 pz = 60 U).
export function siDosaAU(item) {
  const u = (x) => String(x || '').toUpperCase() === 'U'
  if (u(item?.unit)) return true
  return (item?.unit || 'pz') === 'pz' && u(item?.content_unit) && Number(item?.package_size) > 0
}

// `righe`: le righe di ricetta ({ inventory_item_id, unit }), nell'ordine in
// cui stanno nel documento. `idsInU`: gli articoli che si dosano a U.
// Torna gli INDICI delle righe da riscrivere in U: solo quelle in grammi, e
// solo di quegli articoli. Il resto della riga, quantità compresa, resta.
export function righeInGrammi(righe, idsInU) {
  const out = []
  ;(righe || []).forEach((r, i) => {
    if (r && idsInU.has(r.inventory_item_id) && String(r.unit || '').toLowerCase() === 'g') out.push(i)
  })
  return out
}
