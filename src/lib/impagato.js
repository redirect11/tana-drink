// ── IL CONTO CHIUSO IMPAGATO (REQ-CASSA-016) ────────────────────────────
//
// Richiesta del 10/10/2026: «inserire tasto di chiusura IMPAGATO sotto
// contante, carta, sumup ed inserire la possibilità di scrivere delle note
// che appariranno grandi sullo scontrino di chiusura tavolo». Deciso lo
// stesso giorno: è un CREDITO DA RISCUOTERE. Il cliente se ne va senza
// pagare (paga domani, è un amico del locale, ha il portafoglio in auto):
// il tavolo si libera, i soldi non sono entrati.
//
// QUINDI IL CONTO NON È PAGATO E NON È ANNULLATO: resta un conto da
// incassare, col segno `impagato` ({ at, nota, chi, importo }). Da qui
// scendono tre regole:
//   · in coda è CHIUSO (contoChiuso): il tavolo è libero, e la serata dopo
//     il conto non c'è più fra quelli da lavorare;
//   · non blocca la chiusura di cassa, e non è un incasso (lib/cassa.js
//     legge i soldi dai pagamenti, che non ci sono);
//   · le comande risultano servite e il magazzino si scala: i drink sono
//     usciti davvero.
// Quando il cliente torna, il conto si riapre dal suo numero e si incassa
// come ogni altro: il pagamento lo chiude, e il segno resta come storia.
//
// La regola pura sta qui e in comande.js (impagatoAperto, contoChiuso);
// chi scrive è api.js (chiudiImpagato).

import { normalizeOrderDoc, serveAllComande, comandeStatuses } from './comande.js'
import { orderDue } from './pagamento.js'

// La patch che chiude un conto impagato. Non tocca stato né pagamenti: il
// conto resta da incassare. `importo` è quello che mancava in quel momento
// (acconti già presi esclusi), ed è il numero che si legge sullo scontrino.
export function patchImpagato(rawOrder, { nowIso, nota = null, chi = null }) {
  const norm = normalizeOrderDoc(rawOrder)
  const comande = serveAllComande(norm.comande, nowIso)
  return {
    impagato: {
      at: nowIso,
      nota: String(nota || '').trim() || null,
      chi: chi || null,
      importo: orderDue(rawOrder),
    },
    comande,
    comande_statuses: comandeStatuses(comande),
  }
}

// Un testo spezzato a parole per una riga larga `larghezza` caratteri: le
// note stampano in doppia larghezza, 24 caratteri sulla carta da 80 mm, e la
// stampante andrebbe a capo a metà parola.
export function aCapo(testo, larghezza) {
  const righe = []
  for (const paragrafo of String(testo || '').split(/\r?\n/)) {
    let riga = ''
    for (const parola of paragrafo.split(/\s+/).filter(Boolean)) {
      if (!riga) riga = parola
      else if (riga.length + 1 + parola.length <= larghezza) riga += ` ${parola}`
      else {
        righe.push(riga)
        riga = parola
      }
      while (riga.length > larghezza) {
        righe.push(riga.slice(0, larghezza))
        riga = riga.slice(larghezza)
      }
    }
    if (riga) righe.push(riga)
  }
  return righe
}
