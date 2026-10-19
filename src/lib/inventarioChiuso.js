// ── UN INVENTARIO CHIUSO, LETTO DOPO (REQ-MAG-052) ─────────────────────
//
// Flavio, 15/10/2026: «nella sezione inventario io dovrei avere la
// possibilità di vedere tutti gli inventari vecchi … la lista degli
// inventari con la data di apertura e la data di chiusura, e io se voglio
// ci clicco sopra e lo vedo; ovviamente la casella rimanenze risulta
// bloccata, quella era la rimanenza che ho inserito, e mi vado a vedere
// tutti i consumi che ho fatto in quel periodo, così da capire che tipo di
// ordine dovrò fare in un particolare periodo».
//
// Le righe di un inventario chiuso sono quelle che la chiusura ha scritto
// (`righeInventario` in closeStockCount): DEP, ACQ, CONS e la RIM portata
// all'ora della chiusura (`rim_adesso`). Ma gli inventari chiusi PRIMA
// della 1.8 hanno solo `dep`, `acq`, `rim`, `cons`, e quelli ancora più
// vecchi neanche i totali: qui si legge quello che c'è e si ricalcola il
// resto dalle righe, così lo storico si apre tutto, non solo gli ultimi.
// Il consumo a settimana si rifà sempre dai giorni veri fra apertura e
// chiusura: non è mai stato salvato.
//
// Logica pura, niente Firebase.

import { giorniDiConta, consumoSettimanale, valoreConSegno } from './warehouse.js'
import { arrotonda } from './magazzinoPeriodo.js'
import { contato, totaliDi } from './inventarioInCorso.js'

const numero = (n) => (contato(n) ? Number(n) : null)

// La RIM con cui l'inventario si è chiuso: il contato portato alla
// chiusura, o il contato, o la giacenza che l'app aveva.
export const rimanenzaChiusa = (l) => numero(l?.rim_adesso) ?? numero(l?.rim) ?? numero(l?.atteso)

// I totali salvati alla chiusura, se ci sono tutti; se no `null`, e si
// rifanno dalle righe.
function totaliSalvati(conta) {
  const t = conta?.totals
  const counted = numero(t?.counted)
  const cons_value = numero(t?.cons_value)
  const rim_value = numero(t?.rim_value)
  return counted == null || cons_value == null || rim_value == null ? null : { counted, cons_value, rim_value }
}

/**
 * Le righe di un inventario chiuso, pronte da leggere: ogni numero c'è,
 * anche per gli inventari scritti con le versioni di prima. I valori in
 * euro stanno sulla riga, come in `righeInventario`, perché da lì nascono
 * i totali degli inventari che non li hanno salvati.
 */
export function righeInventarioChiuso(conta) {
  const giorni = giorniDiConta(conta?.started_at, conta?.closed_at)
  const lines = (conta?.lines || []).map((l) => {
    const rim = rimanenzaChiusa(l)
    const dep = numero(l.dep) ?? 0
    const acq = numero(l.acq) ?? 0
    const cons = numero(l.cons) ?? (rim == null ? null : dep + acq - rim)
    return {
      ...l,
      dep: arrotonda(dep),
      acq: arrotonda(acq),
      rim,
      cons: cons == null ? null : arrotonda(cons),
      contata: contato(l.rim),
      cons_week: cons == null ? null : consumoSettimanale(cons, giorni),
      cons_value: numero(l.cons_value) ?? (cons == null ? 0 : arrotonda(valoreConSegno(cons, l), 2)),
      rim_value: numero(l.rim_value) ?? (rim == null ? 0 : arrotonda(valoreConSegno(rim, l), 2)),
    }
  })
  return { lines, giorni, totals: totaliSalvati(conta) ?? totaliDi(lines) }
}

/**
 * Quello che l'elenco dello storico mostra di un inventario: la durata, i
 * totali e quante righe. Leggero apposta — dalla 1.8 i totali sono salvati
 * e le quattrocento righe non si toccano; si rifanno solo dove mancano.
 */
export function riassuntoInventarioChiuso(conta) {
  return {
    giorni: giorniDiConta(conta?.started_at, conta?.closed_at),
    totals: totaliSalvati(conta) ?? righeInventarioChiuso(conta).totals,
    righe: (conta?.lines || []).length,
  }
}
