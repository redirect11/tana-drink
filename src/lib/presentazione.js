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
//   · dopo l'accesso, all'apertura o tornando in primo piano: se questo
//     dispositivo non ha presentato questa versione nelle ultime 24 ore
//     (REQ-FLOTTA-031, il perché sopra giaPresentata). Ogni dispositivo
//     porta il suo codice, e la regia tiene una versione per ciascuno;
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

import { urlFunzioneRegia, erroreDellaRegia } from './funzioniRegia.js'
import { leggi, scrivi } from './impostazioniLocali.js'

export const urlPresentazione = (progetto) => urlFunzioneRegia('presentazione', progetto)

const CHIAVE = 'drink:presentata'
const CHIAVE_IL = 'drink:presentata_il'
const numero = (versione) => String(versione || '').replace(/^v/, '')

// UNA VOLTA AL GIORNO ANCHE A VERSIONE INVARIATA (REQ-FLOTTA-031). La
// regia conta la versione per dispositivo e dimentica chi non si presenta
// da 30 giorni. Con «una volta per versione», un tablet rimasto su una
// versione vecchia e usato ogni sera non si ripresentava mai: dopo un mese
// sarebbe uscito dal conto mentre chiamava ancora le interfacce vecchie, e
// la regia le avrebbe tolte sotto i suoi piedi. Ventiquattro ore: abbastanza
// rade da non pesare (la regia comunque scrive al più ogni 6 ore),
// abbastanza fitte da non perdere nessuno.
export const RIPRESENTA_DOPO = 24 * 60 * 60 * 1000

// Questo dispositivo ha presentato questa versione nelle ultime 24 ore?
// Senza l'ora (dispositivi con la memoria di prima della 1.10.51) la
// risposta è no: si ripresenta una volta, e da lì l'ora c'è.
// Un'ora segnata nel futuro (un tablet presentato con la data avanti, poi
// rimessa giusta) vale come mai presentata: altrimenti resterebbe muto
// fino a quella data, e la regia intanto lo dimenticherebbe (dal revisore).
export function giaPresentata(versione, adesso = Date.now()) {
  if (leggi(CHIAVE, (v) => v, null) !== numero(versione)) return false
  const trascorso = adesso - leggi(CHIAVE_IL, Number, NaN)
  return trascorso >= 0 && trascorso < RIPRESENTA_DOPO
}
export function segnaPresentata(versione, adesso = Date.now()) {
  scrivi(CHIAVE, numero(versione))
  scrivi(CHIAVE_IL, String(adesso))
}

// IL CODICE DEL DISPOSITIVO (REQ-FLOTTA-031, contratto con la regia,
// interfaccia 4). Il 14/11/2026 due dispositivi della Tana di test si sono
// presentati a pochi decimi di secondo, uno con la 1.10.49-beta e uno con
// la 1.10.40-beta: la regia teneva l'ultima, e la scheda è tornata indietro
// di dieci versioni. Con un codice per dispositivo la regia tiene una
// versione ciascuno. Sedici byte casuali in base64url senza padding, la
// forma concordata (^[A-Za-z0-9_-]{22}$): niente dell'utente né del locale,
// e un codice nuovo se la memoria del browser si svuota.
// NON È idDispositivo (lib/dispositivo.js), e non ne condivide la chiave:
// quello finisce negli ordini e nei token degli avvisi, dentro il database
// del locale. Mandarlo alla regia le permetterebbe di legare i dati del
// locale a un dispositivo, contro la regola di non portarle niente del
// locale (REQ-FLOTTA-051 della regia). La prima stesura usava la stessa
// chiave e l'avrebbe sovrascritto: gli avvisi «l'ho mandato io» e i token
// del personale avrebbero cambiato dispositivo da un giorno all'altro.
const CHIAVE_DISPOSITIVO = 'drink:codice_regia'
const FORMA_CODICE = /^[A-Za-z0-9_-]{22}$/
let codiceDiSessione = null // se la memoria locale è negata, vale per la sessione

function codiceNuovo() {
  const byte = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...byte)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function codiceDispositivo() {
  const scritto = leggi(CHIAVE_DISPOSITIVO, (v) => v, null)
  if (FORMA_CODICE.test(scritto || '')) return scritto
  if (!codiceDiSessione) codiceDiSessione = codiceNuovo()
  scrivi(CHIAVE_DISPOSITIVO, codiceDiSessione)
  return codiceDiSessione
}

// La risposta della regia. `licenza` è 'scritta', 'presente',
// 'non_dalla_regia' (la Tana, oggi: segna solo la versione) o 'non_attiva'.
// Ogni 200 vale come presentata; il resto si riprova alla prossima
// apertura.
export function esitoPresentazione(status, corpo) {
  if (status === 200 && corpo?.ok) return { ok: true, licenza: corpo.licenza ?? null }
  return { ok: false, status, errore: erroreDellaRegia(corpo) }
}

// UNA PRESENTAZIONE, SE SERVE. `chiama(url, versione, dispositivo)` è la
// chiamata vera (api.js), che torna l'esito. Con `licenzaMancante` si
// chiama anche se la versione è già stata presentata: è il modo di
// farsela riscrivere. Torna l'esito, o null se non si è chiamato.
// Una presentazione alla volta: l'apertura e il ritorno in primo piano
// arrivano spesso a pochi istanti (e StrictMode, in sviluppo, monta due
// volte), e la seconda partirebbe prima che la prima abbia segnato l'ora.
let inCorso = false
export async function presentaSeServe({ versione, collegato, licenzaMancante = false, chiama, progetto, adesso = Date.now() }) {
  const url = urlPresentazione(progetto)
  if (!url || !collegato || !versione || inCorso) return null
  if (!licenzaMancante && giaPresentata(versione, adesso)) return null
  inCorso = true
  try {
    const esito = await chiama(url, versione, codiceDispositivo())
    if (esito?.ok) segnaPresentata(versione, adesso)
    return esito
  } finally {
    inCorso = false
  }
}
