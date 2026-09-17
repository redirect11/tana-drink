// ── IL MAGAZZINO IN UN PERIODO QUALUNQUE (REQ-STAT-002) ──────────────
//
// Flavio, 17/09/2026: «quello che mi serve sapere dal magazzino è quanto
// avevo di deposito, quanto ho acquistato, quanto ho consumato in un
// determinato periodo … e vorrei avere la stessa identica visualizzazione
// a lista».
//
// È la stessa domanda della CONTA (warehouse.js, REQ-MAG-014), fatta però
// su un periodo scelto a mano invece che sul periodo di una conta — e
// senza girare per il locale a contare le bottiglie. Le due cose non si
// sostituiscono a vicenda, ed è importante saperlo prima di guardare i
// numeri:
//
//   · LA CONTA parte dalle rimanenze CONTATE A MANO. Il suo consumo è
//     quello vero, cali e bicchieri offerti compresi.
//   · QUESTO ELENCO parte dai MOVIMENTI che l'app ha scritto. Il suo
//     consumo è quello che l'app crede sia uscito, cioè la somma delle
//     ricette battute. Fra i due c'è la differenza che la conta serve a
//     misurare.
//
// DA DOVE VENGONO I NUMERI. Ogni cambio di giacenza lascia un movimento
// (`stock_movements`), e ogni movimento dice perché: sono quei motivi a
// decidere in quale colonna finisce. Il deposito non è scritto da nessuna
// parte e non serve che lo sia: si cammina all'indietro dalla giacenza di
// ADESSO togliendo quello che è entrato e rimettendo quello che è uscito.
//
// ATTENZIONE ALLE UNITÀ, ed è la trappola di questo file. Un movimento di
// carico è scritto in PEZZI, uno di vendita nell'unità della ricetta (40
// ml di gin): sommarli così com'è darebbe «40 gin» dove ce n'è meno di
// uno. Tutto passa da `qtyInStockUnit`, che riporta ogni quantità
// all'unità con cui si conta la giacenza.

import { qtyInStockUnit } from './inventory.js'
import { qtyValue } from './warehouse.js'
import { businessDayKey, DEFAULT_CUTOFF_HOUR } from './businessDay.js'

// IN CHE COLONNA VA UN MOVIMENTO, secondo il suo motivo. I motivi sono
// quelli che scrive api.js, ed è l'unico posto dove questa corrispondenza
// vive: chi ne aggiunge uno nuovo lo mette qui.
//
//   acquisto  — merce entrata dalla porta: carico a mano, consegna di un
//               ordine, carico da fattura.
//   consumo   — quello che le comande hanno tolto. Ci stanno dentro anche
//               le correzioni di una comanda modificata e gli storni di un
//               conto annullato: sono la stessa uscita rifatta o disfatta,
//               e vanno a ridurre il consumo, non ad aumentare gli acquisti.
//   rettifica — le correzioni a mano e l'allineamento di una conta. Non
//               sono né merce comprata né merce bevuta: sono il magazzino
//               che si rimette in pari, e mescolarle con le altre due
//               colonne vorrebbe dire raccontare acquisti mai fatti.
export const GRUPPO_MOTIVO = {
  carico: 'acquisto',
  'ordine fornitore': 'acquisto',
  'fattura fornitore': 'acquisto',
  ordine: 'consumo',
  'modifica ordine': 'consumo',
  storno: 'consumo',
  rettifica: 'rettifica',
  conta: 'rettifica',
}

// UN MOTIVO SCONOSCIUTO FINISCE FRA LE RETTIFICHE, e non è pigrizia: è la
// colonna che non afferma niente. Chiamarlo «acquisto» inventerebbe merce
// comprata, chiamarlo «consumo» inventerebbe merce bevuta; lì dentro invece
// il conto continua a tornare — deposito + acquisti − consumo + rettifiche
// fa sempre la giacenza di fine periodo — e il numero si vede.
export const gruppoMovimento = (m) => GRUPPO_MOTIVO[String(m?.reason || '')] || 'rettifica'

const arrotonda = (n, cifre) => {
  const f = 10 ** cifre
  // Lo zero negativo esiste e si stampa «-0»: quello che non si è mosso
  // deve leggersi zero.
  return (Math.round(n * f) / f) + 0
}

/**
 * Deposito, acquisti e consumo di ogni prodotto in un periodo.
 *
 * IL PERIODO SI DICE IN GIORNATE COMMERCIALI (`2026-06-01`), come
 * dappertutto nell'app: il locale lavora oltre la mezzanotte, e un
 * intervallo fatto di istanti taglierebbe le nottate a metà. In più
 * risparmia il calcolo dell'istante in cui una giornata comincia, che con
 * l'ora legale di mezzo si sbaglia in silenzio due volte l'anno.
 *
 * @param movimenti tutti i movimenti DA `dal` IN POI — anche quelli dopo
 *   `al`, che servono a camminare all'indietro fino alla giacenza di fine
 *   periodo. Chi legge meno di così ottiene numeri sbagliati in silenzio.
 * @param items gli articoli di magazzino, con la giacenza di ADESSO.
 * @param dal / al giornate commerciali estreme. `al` mancante vuol dire
 *   «fino a oggi».
 */
export function magazzinoNelPeriodo(movimenti, items, { dal, al = null, cutoffHour = DEFAULT_CUTOFF_HOUR } = {}) {
  const perId = new Map((items || []).map((i) => [i.id, i]))
  const righe = new Map()
  const riga = (item) => {
    let r = righe.get(item.id)
    if (!r) {
      r = { item_id: item.id, name: item.name || '', unit: item.unit || 'pz', acq: 0, cons: 0, rett: 0, dopo: 0 }
      righe.set(item.id, r)
    }
    return r
  }

  for (const m of movimenti || []) {
    const item = perId.get(m?.item_id)
    // Prodotto cancellato dal magazzino: senza l'articolo non si sa in che
    // unità sia quella quantità, e un numero convertito a caso è peggio di
    // una riga che manca.
    if (!item) continue
    const giornata = businessDayKey(m.created_at, cutoffHour)
    if (!giornata || giornata < dal) continue
    // In pezzi, col segno: entrata positiva, uscita negativa.
    const q = qtyInStockUnit(m.qty, m.unit, item) * (m.type === 'load' ? 1 : -1)
    const r = riga(item)
    if (al && giornata > al) {
      r.dopo += q
      continue
    }
    const gruppo = gruppoMovimento(m)
    if (gruppo === 'acquisto') r.acq += q
    // Il consumo si legge in positivo: quello che è uscito. Un'entrata per
    // storno lo abbassa, che è esattamente quello che è successo.
    else if (gruppo === 'consumo') r.cons -= q
    else r.rett += q
  }

  const out = []
  const totali = { acq_valore: 0, cons_valore: 0, fine_valore: 0, prodotti: 0 }
  for (const r of righe.values()) {
    // UN PRODOTTO CHE NON SI È MOSSO NON È UNA RIGA. Su quattrocento
    // articoli, trecento sono fermi: elencarli tutti a zero vuol dire
    // nascondere i trenta che raccontano qualcosa.
    if (r.acq === 0 && r.cons === 0 && r.rett === 0) continue
    const item = perId.get(r.item_id)
    // Giacenza a fine periodo: quella di adesso meno quello che si è mosso
    // dopo. Su un periodo che finisce adesso `dopo` è zero e resta la
    // giacenza vera.
    const fine = (Number(item.stock) || 0) - r.dopo
    const dep = fine - r.acq + r.cons - r.rett
    const q = (n) => arrotonda(n, 4)
    const v = (n) => arrotonda(n, 2)
    const voce = {
      item_id: r.item_id,
      name: r.name,
      unit: r.unit,
      dep: q(dep),
      acq: q(r.acq),
      cons: q(r.cons),
      rett: q(r.rett),
      fine: q(fine),
      dep_valore: v(qtyValue(dep, item)),
      acq_valore: v(qtyValue(r.acq, item)),
      cons_valore: v(qtyValue(r.cons, item)),
      fine_valore: v(qtyValue(fine, item)),
    }
    totali.acq_valore += voce.acq_valore
    totali.cons_valore += voce.cons_valore
    totali.fine_valore += voce.fine_valore
    totali.prodotti += 1
    out.push(voce)
  }
  totali.acq_valore = arrotonda(totali.acq_valore, 2)
  totali.cons_valore = arrotonda(totali.cons_valore, 2)
  totali.fine_valore = arrotonda(totali.fine_valore, 2)

  // IN CIMA QUELLO CHE È COSTATO DI PIÙ, non quello che si è mosso di più:
  // la domanda dietro questo elenco è dove se ne va il denaro, e trenta
  // bottiglie d'acqua non sono la risposta.
  out.sort((a, b) => b.cons_valore - a.cons_valore || b.acq_valore - a.acq_valore || a.name.localeCompare(b.name, 'it'))
  return { righe: out, totali }
}
