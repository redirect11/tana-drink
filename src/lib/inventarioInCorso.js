// ── L'INVENTARIO COME LO LEGGE FLAVIO (REQ-MAG-046) ───────────────────
//
// Flavio, 23/09/2026: «il vero CONSUMO è la variazione del deposito dovuta
// alla vendita, e quindi allo scarico dei prodotti che si trovano nelle
// ricette degli items di menù. L'inventario è solo un allineamento con il
// consumo reale: più siamo precisi con gli scarichi dei prodotti dagli
// items di menù, meno dovremo intervenire sulle rimanenze quando facciamo
// l'inventario».
//
// Prima la riga diceva DEP + ACQ − RIM = CONS, il conto del foglio INV: un
// numero solo, che mescolava quello che si è VENDUTO con quello che è
// SPARITO (ricette imprecise, merce persa, errori di carico). Adesso le due
// cose stanno separate, perché sono due domande diverse:
//
//   DEP       la giacenza all'apertura, più le correzioni del periodo
//             (contenuto reale modificato, BUG-111; rettifiche d'inventario)
//   ACQ       merce comprata: carico diretto, ordine consegnato, fattura
//   VENDUTO   quello che hanno scaricato le ricette dei drink battuti
//   ATTESO    quanto l'app pensa che ci sia ADESSO: la giacenza del prodotto
//   CONTATO   la rimanenza scritta a mano
//   DIFFERENZA contato − atteso: l'allineamento. Negativa = manca merce.
//
// «Consumo» nella storia resta quello che è uscito davvero dallo scaffale:
// venduto più quello che manca (VENDUTO − DIFFERENZA). È lo stesso numero
// del foglio INV quando i conti tornano, e serve al consumo a settimana,
// su cui si decide quanto ordinare.
//
// L'ORA DEL CONTEGGIO (BUG-112). Si conta a locale aperto: se il gin si
// conta alle 18 e il locale ne vende fino a mezzanotte, la differenza va
// misurata sull'atteso DELLE 18, non su quello di mezzanotte — se no le
// vendite fatte dopo sembrano merce sparita, e alla chiusura la giacenza
// tornerebbe al numero delle 18, cancellandole. Quindi:
//   atteso al conteggio = atteso adesso − quello che si è mosso DOPO
// Una rimanenza senza ora (scritta con la 1.6.1, o sistemata a mano) vale
// come contata adesso: è il comportamento di prima.

import { qtyInStockUnit } from './inventory.js'
import { qtyValue, giorniDiConta, consumoSettimanale } from './warehouse.js'
import { gruppoMovimento } from './magazzinoPeriodo.js'

const arrotonda = (n, cifre = 4) => {
  const f = 10 ** cifre
  return Math.round(n * f) / f + 0
}

// Il valore in € CON IL SEGNO: qtyValue ne dà solo di positivi, e una
// differenza è quasi sempre negativa — è proprio quella che interessa.
const valoreConSegno = (q, riga) => (q < 0 ? -qtyValue(-q, riga) : qtyValue(q, riga))

const contato = (rim) => rim != null && rim !== '' && Number.isFinite(Number(rim))

/**
 * Le righe di un inventario, completate coi movimenti del periodo.
 *
 * @param lines le righe dell'inventario (dep all'apertura, rim, rim_at).
 * @param movimenti TUTTI i movimenti dall'apertura in poi.
 * @param items gli articoli con la giacenza di ADESSO: servono per l'atteso
 *   e per convertire le vendite (scritte in ml) nei pezzi del magazzino.
 * @param dal / al estremi del periodo, per il consumo a settimana.
 */
export function righeInventario(lines, { movimenti = [], items = [], dal = null, al = null } = {}) {
  const perId = new Map((items || []).map((i) => [i.id, i]))
  const perRiga = new Map()
  for (const m of movimenti || []) {
    const item = perId.get(m?.item_id)
    // Senza l'articolo non si sa in che unità sia quella quantità: un numero
    // convertito a caso è peggio di un movimento che manca.
    if (!item) continue
    const q = qtyInStockUnit(m.qty, m.unit, item) * (m.type === 'load' ? 1 : -1)
    const lista = perRiga.get(m.item_id) || []
    lista.push({ at: m.created_at || null, q, gruppo: gruppoMovimento(m) })
    perRiga.set(m.item_id, lista)
  }

  const giorni = giorniDiConta(dal, al)
  const out = (lines || []).map((l) => {
    const ms = perRiga.get(l.item_id) || []
    let acq = 0
    let vend = 0
    let rett = 0
    for (const x of ms) {
      if (x.gruppo === 'acquisto') acq += x.q
      // Il venduto si legge in positivo: quello che è uscito. Uno storno lo
      // abbassa, che è esattamente quello che è successo.
      else if (x.gruppo === 'consumo') vend -= x.q
      else rett += x.q
    }
    const dep = (Number(l.dep) || 0) + rett
    const item = perId.get(l.item_id)
    // L'atteso è la giacenza del prodotto, non il conto DEP + ACQ − VENDUTO:
    // se un movimento non è stato scritto (un prodotto cambiato dalla
    // scheda, per dire), è la giacenza quella che la chiusura corregge.
    const atteso = item ? Number(item.stock) || 0 : dep + acq - vend

    let rim = null
    let diff = null
    if (contato(l.rim)) {
      rim = Number(l.rim)
      // Un movimento senza ora è appena stato scritto da questo dispositivo
      // e il server non l'ha ancora datato: è per forza DOPO il conteggio.
      const dopo = l.rim_at
        ? ms.filter((x) => !x.at || x.at > l.rim_at).reduce((s, x) => s + x.q, 0)
        : 0
      diff = rim - (atteso - dopo)
    }
    const cons = diff == null ? null : vend - diff
    return {
      ...l,
      dep: arrotonda(dep),
      acq: arrotonda(acq),
      vend: arrotonda(vend),
      atteso: arrotonda(atteso),
      rim,
      diff: diff == null ? null : arrotonda(diff),
      cons: cons == null ? null : arrotonda(cons),
      cons_week: consumoSettimanale(cons, giorni),
      vend_value: arrotonda(valoreConSegno(vend, l), 2),
      diff_value: diff == null ? 0 : arrotonda(valoreConSegno(diff, l), 2),
      rim_value: rim == null ? 0 : arrotonda(qtyValue(rim, l), 2),
      cons_value: cons == null ? 0 : arrotonda(valoreConSegno(cons, l), 2),
    }
  })

  const totals = { vend_value: 0, diff_value: 0, rim_value: 0, cons_value: 0, counted: 0 }
  for (const l of out) {
    totals.vend_value += l.vend_value
    totals.diff_value += l.diff_value
    totals.rim_value += l.rim_value
    totals.cons_value += l.cons_value
    if (l.rim != null) totals.counted += 1
  }
  for (const k of ['vend_value', 'diff_value', 'rim_value', 'cons_value']) totals[k] = arrotonda(totals[k], 2)
  return { lines: out, totals, giorni }
}
