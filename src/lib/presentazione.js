// ── L'APP SI PRESENTA ALLA REGIA (REQ-FLOTTA-026) ─────────────────────
//
// L'utente, 02/11/2026: «non deve essere il deploy ad avvisare la regia ma
// l'istanza del sito stesso […] regia e il sito custom del bar si devono
// parlare dopo il deploy e si scambiano dati tra loro rispetto alle
// licenze, attivazione». Quindi è l'app, partita con una versione nuova, a
// dire alla regia chi è e che versione ha; la regia segna la versione e,
// se la licenza manca, gliela scrive (arriva dal listener che c'è già).
// Il contratto è in docs/presentazione-alla-regia.md.
//
// QUANDO: mai a tempo («ste cose in polling si portavano negli anni 90»).
//   · una volta per versione, dopo l'accesso: se questo dispositivo non ha
//     ancora presentato questa versione. Dieci tablet fanno dieci chiamate
//     alla prima apertura, e la regia ne registra una;
//   · se la licenza manca e qualcuno è ancora collegato: la regia la
//     riscrive. NON È L'ATTIVAZIONE: l'app non fa accessi anonimi, e su
//     un'installazione nuova la schermata «non attivata» copre anche
//     l'accesso. La licenza c'è prima dell'app (la scrive l'attivazione
//     della regia, o, per la Tana, il deploy); questo è il caso di riserva.
// Un errore di rete non blocca niente e non segna niente: si riprova alla
// prossima apertura. Senza `VITE_REGIA_PROGETTO`, o con un progetto che non
// è della regia, nessuna chiamata: il token di chi ha fatto l'accesso non
// parte verso un indirizzo qualunque (come `scelta_url`, aggiornamenti.js).
//
// Logica pura più la memoria del dispositivo; la chiamata vera è in api.js.

import { PROGETTI_REGIA } from './aggiornamenti.js'
import { leggi, scrivi } from './impostazioniLocali.js'

// La regione delle Functions della regia (il contratto).
const REGIONE = 'europe-west1'

export function urlPresentazione(progetto = import.meta.env?.VITE_REGIA_PROGETTO) {
  return PROGETTI_REGIA.includes(progetto) ? `https://${REGIONE}-${progetto}.cloudfunctions.net/presentazione` : null
}

const CHIAVE = 'drink:presentata'
const numero = (versione) => String(versione || '').replace(/^v/, '')

// Questo dispositivo ha già presentato questa versione?
export const giaPresentata = (versione) => leggi(CHIAVE, (v) => v, null) === numero(versione)
export const segnaPresentata = (versione) => scrivi(CHIAVE, numero(versione))

// La risposta della regia. `licenza` è 'scritta', 'presente',
// 'non_dalla_regia' (la Tana, oggi: segna solo la versione) o 'non_attiva'.
// Ogni 200 vale come presentata; il resto si riprova alla prossima
// apertura.
export function esitoPresentazione(status, corpo) {
  if (status === 200 && corpo?.ok) return { ok: true, licenza: corpo.licenza ?? null }
  const errore = typeof corpo?.errore === 'string' && corpo.errore.trim() ? corpo.errore.trim() : null
  return { ok: false, status, errore }
}

// UNA PRESENTAZIONE, SE SERVE. `chiama(url, versione)` è la chiamata vera
// (api.js), che torna l'esito. Con `licenzaMancante` si chiama anche se la
// versione è già stata presentata: è il modo di farsela riscrivere.
// Torna l'esito, o null se non si è chiamato.
export async function presentaSeServe({ versione, collegato, licenzaMancante = false, chiama, progetto }) {
  const url = urlPresentazione(progetto)
  if (!url || !collegato || !versione) return null
  if (!licenzaMancante && giaPresentata(versione)) return null
  const esito = await chiama(url, versione)
  if (esito?.ok) segnaPresentata(versione)
  return esito
}
