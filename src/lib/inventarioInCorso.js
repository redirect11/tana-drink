// ── L'INVENTARIO COME IL FOGLIO INV DI FLAVIO (REQ-MAG-046) ──────────
//
// DEP · ACQ · CONS · RIM, con CONS = DEP + ACQ − RIM: è il conto del foglio
// INV che Flavio ha tenuto per anni, una scheda per periodo, e la RIM di
// una scheda diventa il DEP della successiva.
//
// CI SI È ARRIVATI GIRANDO, e conviene saperlo prima di cambiarlo. Il 23/09
// Flavio aveva chiesto di separare il venduto dalla differenza; il 24 di
// far ripartire il prodotto col contenuto reale; il 25 sera, dopo aver
// provato i casi veri, ha chiuso così (vocale delle 21:53):
//   · l'ordine al fornitore consegnato carica il magazzino e va in ACQ;
//   · il carico da Prodotti, solo positivo, carica il magazzino e va in ACQ;
//   · il contenuto reale fa la correzione in più o in meno, e va sulle
//     rimanenze — quindi, di conseguenza, sul consumato.
// Daniele ha scelto di tenere un CONS solo, come nel foglio.
//
// Quindi, prodotto per prodotto:
//   DEP   la giacenza all'apertura dell'inventario. Non la sposta niente.
//   ACQ   merce entrata: ordine consegnato, fattura, carico da Prodotti.
//   RIM   quanto c'è adesso: la giacenza, che si muove con le vendite e col
//         contenuto reale — o il numero contato, se lo si è scritto.
//   CONS  DEP + ACQ − RIM: il venduto, le correzioni e quello che manca.
//
// L'ORA DEL CONTEGGIO (BUG-112). Si conta a locale aperto: il gin contato
// alle 18 e venduto fino a mezzanotte vale, a mezzanotte, il contato meno
// quello che è uscito dopo le 18. Senza, la chiusura riporterebbe la
// giacenza al numero delle 18 e le vendite fatte dopo sparirebbero. Quindi
// la RIM di un prodotto contato è `contato + quello che si è mosso dopo`, e
// la differenza che la chiusura applica è `contato − atteso al conteggio`.
// Una rimanenza senza ora (scritta con la 1.6.1, o sistemata a mano) vale
// come contata adesso.
//
// DUE PASSI, perché il primo è pesante e il secondo no. Smistare qualche
// migliaio di movimenti dipende solo dai movimenti e dagli articoli; le
// righe dipendono anche da quello che si scrive, e si ricalcolano a ogni
// cifra battuta. Chi ha i dati fermi (il pannello) smista una volta e
// passa `raggruppati`; chi li legge una volta sola passa `movimenti`.

import { qtyValue, giorniDiConta, consumoSettimanale } from './warehouse.js'
import { arrotonda, movimentoInPezzi } from './magazzinoPeriodo.js'

// Il valore in € CON IL SEGNO: qtyValue ne dà solo di positivi, e un
// consumo o una differenza possono essere negativi.
const valoreConSegno = (q, riga) => (q < 0 ? -qtyValue(-q, riga) : qtyValue(q, riga))

const contato = (rim) => rim != null && rim !== '' && Number.isFinite(Number(rim))

const VALORI = ['cons_value', 'rim_value', 'diff_value']

/**
 * I movimenti del periodo, prodotto per prodotto: gli acquisti, e la lista
 * `{ at, q }` per sapere cosa è venuto dopo un conteggio.
 */
export function raggruppaMovimenti(movimenti, items) {
  const perId = new Map((items || []).map((i) => [i.id, i]))
  const out = new Map()
  for (const m of movimenti || []) {
    const mp = movimentoInPezzi(m, perId.get(m?.item_id))
    if (!mp) continue
    let r = out.get(m.item_id)
    if (!r) out.set(m.item_id, (r = { acq: 0, lista: [] }))
    if (mp.gruppo === 'acquisto') r.acq += mp.q
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

const VUOTO = { acq: 0, lista: [] }

/**
 * Le righe di un inventario, completate coi movimenti del periodo.
 *
 * @param lines le righe dell'inventario (dep all'apertura, rim, rim_at).
 * @param raggruppati quello che torna da `raggruppaMovimenti`; oppure
 * @param movimenti TUTTI i movimenti dall'apertura in poi, smistati qui.
 * @param items gli articoli con la giacenza di ADESSO: servono per la RIM
 *   e per convertire i movimenti nei pezzi del magazzino.
 * @param dal / al estremi del periodo, per il consumo a settimana.
 */
export function righeInventario(lines, { raggruppati = null, movimenti = [], items = [], dal = null, al = null } = {}) {
  const gruppi = raggruppati || raggruppaMovimenti(movimenti, items)
  const perId = new Map((items || []).map((i) => [i.id, i]))
  const giorni = giorniDiConta(dal, al)

  const out = (lines || []).map((l) => {
    const g = gruppi.get(l.item_id) || VUOTO
    const item = perId.get(l.item_id)
    const dep = Number(l.dep) || 0
    // Quanto c'è adesso secondo l'app: la giacenza del prodotto. Un
    // prodotto che non c'è più non ha movimenti: resta quello di partenza.
    const atteso = item ? Number(item.stock) || 0 : dep + g.acq
    const rim = contato(l.rim) ? Number(l.rim) : null
    const dopo = rim == null ? 0 : mossoDopo(g.lista, l.rim_at)
    // La differenza che la chiusura applica: contato meno atteso al momento
    // del conteggio.
    const diff = rim == null ? null : rim - (atteso - dopo)
    // La RIM che vale adesso: il contato portato fino a ora, o l'atteso.
    const rimAdesso = rim == null ? atteso : rim + dopo
    const cons = dep + g.acq - rimAdesso
    return {
      ...l,
      dep: arrotonda(dep),
      acq: arrotonda(g.acq),
      atteso: arrotonda(atteso),
      rim,
      rim_adesso: arrotonda(rimAdesso),
      diff: diff == null ? null : arrotonda(diff),
      cons: arrotonda(cons),
      cons_week: consumoSettimanale(cons, giorni),
      cons_value: arrotonda(valoreConSegno(cons, l), 2),
      rim_value: arrotonda(valoreConSegno(rimAdesso, l), 2),
      diff_value: diff == null ? 0 : arrotonda(valoreConSegno(diff, l), 2),
    }
  })

  const totals = { counted: out.filter((l) => l.rim != null).length }
  for (const k of VALORI) totals[k] = arrotonda(out.reduce((s, l) => s + l[k], 0), 2)
  return { lines: out, totals, giorni }
}
