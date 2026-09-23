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
//
// DUE PASSI, perché il primo è pesante e il secondo no. Smistare qualche
// migliaio di movimenti dipende solo dai movimenti e dagli articoli; le
// righe dipendono anche da quello che si scrive, e si ricalcolano a ogni
// cifra battuta. Chi ha i dati fermi (il pannello) smista una volta e
// passa `raggruppati`; chi li legge una volta sola passa `movimenti`.

import { qtyValue, giorniDiConta, consumoSettimanale } from './warehouse.js'
import { arrotonda, movimentoInPezzi } from './magazzinoPeriodo.js'

// Il valore in € CON IL SEGNO: qtyValue ne dà solo di positivi, e una
// differenza è quasi sempre negativa — è proprio quella che interessa.
const valoreConSegno = (q, riga) => (q < 0 ? -qtyValue(-q, riga) : qtyValue(q, riga))

const contato = (rim) => rim != null && rim !== '' && Number.isFinite(Number(rim))

const VALORI = ['vend_value', 'diff_value', 'rim_value', 'cons_value']

/**
 * I movimenti del periodo, prodotto per prodotto: acq, vend (in positivo),
 * rett, e la lista `{ at, q }` per sapere cosa è venuto dopo un conteggio.
 */
export function raggruppaMovimenti(movimenti, items) {
  const perId = new Map((items || []).map((i) => [i.id, i]))
  const out = new Map()
  for (const m of movimenti || []) {
    const mp = movimentoInPezzi(m, perId.get(m?.item_id))
    if (!mp) continue
    let r = out.get(m.item_id)
    if (!r) out.set(m.item_id, (r = { acq: 0, vend: 0, rett: 0, lista: [] }))
    if (mp.gruppo === 'acquisto') r.acq += mp.q
    // Il venduto si legge in positivo: quello che è uscito. Uno storno lo
    // abbassa, che è esattamente quello che è successo.
    else if (mp.gruppo === 'consumo') r.vend -= mp.q
    else r.rett += mp.q
    r.lista.push({ at: m.created_at || null, q: mp.q })
  }
  return out
}

// Quello che si è mosso DOPO un conteggio. Un movimento senza ora è appena
// stato scritto da questo dispositivo e il server non l'ha ancora datato:
// è per forza dopo.
function mossoDopo(lista, rimAt) {
  if (!rimAt) return 0
  let somma = 0
  for (const x of lista) if (!x.at || x.at > rimAt) somma += x.q
  return somma
}

const VUOTO = { acq: 0, vend: 0, rett: 0, lista: [] }

/**
 * Le righe di un inventario, completate coi movimenti del periodo.
 *
 * @param lines le righe dell'inventario (dep all'apertura, rim, rim_at).
 * @param raggruppati quello che torna da `raggruppaMovimenti`; oppure
 * @param movimenti TUTTI i movimenti dall'apertura in poi, smistati qui.
 * @param items gli articoli con la giacenza di ADESSO: servono per l'atteso
 *   e per convertire le vendite (scritte in ml) nei pezzi del magazzino.
 * @param dal / al estremi del periodo, per il consumo a settimana.
 */
export function righeInventario(lines, { raggruppati = null, movimenti = [], items = [], dal = null, al = null } = {}) {
  const gruppi = raggruppati || raggruppaMovimenti(movimenti, items)
  const perId = new Map((items || []).map((i) => [i.id, i]))
  const giorni = giorniDiConta(dal, al)

  const out = (lines || []).map((l) => {
    const g = gruppi.get(l.item_id) || VUOTO
    const dep = (Number(l.dep) || 0) + g.rett
    const item = perId.get(l.item_id)
    // L'atteso è la giacenza del prodotto, non il conto DEP + ACQ − VENDUTO:
    // se un movimento non è stato scritto (un prodotto cambiato dalla
    // scheda, per dire), è la giacenza quella che la chiusura corregge. Un
    // prodotto che non c'è più non ha movimenti smistati: resta il DEP.
    const atteso = item ? Number(item.stock) || 0 : dep
    const rim = contato(l.rim) ? Number(l.rim) : null
    const diff = rim == null ? null : rim - (atteso - mossoDopo(g.lista, l.rim_at))
    const cons = diff == null ? null : g.vend - diff
    return {
      ...l,
      dep: arrotonda(dep),
      acq: arrotonda(g.acq),
      vend: arrotonda(g.vend),
      atteso: arrotonda(atteso),
      rim,
      diff: diff == null ? null : arrotonda(diff),
      cons: cons == null ? null : arrotonda(cons),
      cons_week: consumoSettimanale(cons, giorni),
      vend_value: arrotonda(valoreConSegno(g.vend, l), 2),
      diff_value: diff == null ? 0 : arrotonda(valoreConSegno(diff, l), 2),
      rim_value: arrotonda(qtyValue(rim, l), 2),
      cons_value: cons == null ? 0 : arrotonda(valoreConSegno(cons, l), 2),
    }
  })

  const totals = { counted: out.filter((l) => l.rim != null).length }
  for (const k of VALORI) totals[k] = arrotonda(out.reduce((s, l) => s + l[k], 0), 2)
  return { lines: out, totals, giorni }
}
