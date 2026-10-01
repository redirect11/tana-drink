// ── BILANCIO → ACQUISTI × FATTURATO (REQ-MAG-022) ─────────────────────
//
// È il foglio «RAPPORTI ACQUISTI» di ANALISI DATI.xlsx rifatto: per ogni
// macro ACQUISTI, FATTURATO, UTILE, RAPPORTO FAT/ACQ e INCIDENZA sulla
// somma degli utili, colonna per colonna. Il foglio aveva solo i mesi;
// Flavio, 01/10/2026, la vuole «per l'anno, per il mese che vada a
// selezionare io e per la settimana […] volendo anche giornaliera» (le
// colonne stanno in periodiBilancio.js).
//
// Vendite, celle, righe, totali e incidenze sono quelli di «Venduto ×
// Incassato» (sommaVendite, accumula, componiTabella): qui cambia solo
// cosa va nel secondo numero di ogni cella — `incasso` è il fatturato,
// `costo` sono gli acquisti al posto del costo delle ricette.
//
// Logica pura (niente Firebase), interamente testabile.

import { businessDayKey, DEFAULT_CUTOFF_HOUR } from './businessDay.js'
import { shiftDay } from './ore.js'
import { ripartisci } from './macros.js'
import { accumula, componiTabella, sommaVendite, vociDiAcquisto } from './macroStats.js'

// `orders` e `movimenti` bastano che coprano le colonne (ne possono avere
// di più: si taglia qui, per giornata commerciale); `purchaseOrders`
// possono essere tutti.
//   lordo  → fatturato e acquisti IVA compresa (come il foglio); se no al
//            netto, l'incassato scorporato con l'aliquota della voce o del
//            locale (`saleVat`).
// Ritorna { rows, totPerColonna, grand } (vedi componiTabella).
export function acquistiFatturato({
  orders = [],
  purchaseOrders = [],
  movimenti = [],
  items = [],
  drinksById,
  macros,
  colonne,
  cutoffHour = DEFAULT_CUTOFF_HOUR,
  saleVat = 0,
  lordo = true,
}) {
  const itemsById = Object.fromEntries(items.map((i) => [i.id, i]))
  const colonnaDelGiorno = new Map()
  for (const c of colonne) for (let k = c.dal; k <= c.al; k = shiftDay(k, 1)) colonnaDelGiorno.set(k, c.key)
  // Senza data non si colloca: businessDayKey senza argomento darebbe OGGI.
  const colonnaDi = (at) => (at ? colonnaDelGiorno.get(businessDayKey(at, cutoffHour)) : undefined)

  const cells = sommaVendite(new Map(), orders, colonnaDi, {
    drinksById,
    itemsById,
    macros,
    saleVat,
    lordo,
    conCosto: false,
  })
  for (const v of vociDiAcquisto(purchaseOrders, { movimenti, itemsById, lordo })) {
    const colonna = colonnaDi(v.at)
    if (!colonna) continue
    for (const p of ripartisci(macros, 'prodotti', v.item_id, { amount: v.amount })) {
      accumula(cells, `${p.macro}|${colonna}`, { costo: p.amount })
    }
  }

  return componiTabella(cells, macros, colonne.map((c) => c.key))
}
