// ── IL DIZIONARIO INGLESE (REQ-UI-038) ─────────────────────────────
//
// Un file per AREA, uniti qui. Un dizionario unico lo toccherebbe ogni ramo
// nello stesso punto — un conflitto a ogni merge — e chi cerca i testi della
// cassa li cerca nel file della cassa. Le aree nuove si aggiungono qui.
//
// In ogni file: una riga per testo passato da `tr` o `daTradurre`
// (lib/lingua.js); a sinistra l'italiano ESATTO com'è scritto nel codice,
// contesto e segnaposti compresi; a destra l'inglese, con gli stessi
// segnaposti. Righe in ordine alfabetico. La prova in
// tests/unit/lingua.test.js boccia i testi senza la loro riga, le righe che
// nessuno usa, i doppioni fra un'area e l'altra e i segnaposti che non
// combaciano.
//
// Il tono è quello dell'italiano (DESIGN.md, guardrail 3): al banco parole
// comuni, nel gestionale il registro del mestiere, sempre impersonale.

import comune from './comune.js'
import profilo from './profilo.js'
import coda from './coda.js'
import conto from './conto.js'
import cassa from './cassa.js'

export const AREE = { comune, profilo, coda, conto, cassa }

export default Object.assign({}, ...Object.values(AREE))
