// ── IL PASSAGGIO FRA LA REGIA E L'APP, CON UN CLIC (REQ-FLOTTA-030) ────
//
// L'utente, 02/11/2026: «Dobbiamo prevedere un single sign-on che se siamo
// loggati su backoffice o siamo loggati sulla nostra istanza tana, risulta
// loggato sia backoffice sia istanza per quell'utente», «mi serve qualcosa
// che sia sicuro e robusto», per tutte le istanze. Ogni locale è un
// progetto Firebase coi suoi account, e due siti su domini diversi non
// condividono la sessione: quindi dalla regia all'app il titolare passa con
// un clic, e la regia controlla che sia lui (stessa email, verificata, ruolo
// admin); dall'app alla regia, dal 14/11/2026, un collegamento. Il contratto è in
// docs/passaggio-dalla-regia.md; la parte della regia è drink-regia
// REQ-FLOTTA-030.
//
// · DALLA REGIA: «Apri la tua app» apre `<app>/#accesso-regia=<codice>`.
//   Il codice vale 60 secondi e una volta sola. L'app lo toglie subito
//   dall'indirizzo, lo scambia con la regia (scambiaPassaggio) per un token
//   di accesso al locale, ed entra con quello.
// · VERSO LA REGIA: «Area clienti» è un collegamento alla regia
//   (indirizzoAreaClienti): lì si entra come sempre, e chi è già entrato
//   si ritrova nella sua area.
//
// Logica pura: la rete (`prendi`) e l'accesso (`accedi`) li passa chi
// chiama, così la prova non ha bisogno di Firebase.

import { urlFunzioneRegia, erroreDellaRegia, postaAllaRegia } from './funzioniRegia.js'
import { PROGETTI_REGIA } from './aggiornamenti.js'
import { urlRegia } from './limiti.js'

const CHIAVE_FRAMMENTO = 'accesso-regia'

export const urlScambio = (progetto) => urlFunzioneRegia('scambiaPassaggio', progetto)

// Il codice è una stringa corta di lettere, cifre, «-» e «_»: quello che non
// lo è non parte verso la regia.
const CODICE = /^[A-Za-z0-9_-]{8,256}$/

// IL CODICE NEL FRAMMENTO, e il frammento senza di lui. Dopo il «#» e non
// nella query: il frammento non va al server dell'hosting, né nei suoi log.
export function leggiFrammento(hash) {
  const parametri = new URLSearchParams(String(hash || '').replace(/^#/, ''))
  const grezzo = parametri.get(CHIAVE_FRAMMENTO)
  if (grezzo === null) return { codice: null, resto: null }
  parametri.delete(CHIAVE_FRAMMENTO)
  const resto = parametri.toString()
  return { codice: CODICE.test(grezzo) ? grezzo : '', resto: resto ? `#${resto}` : '' }
}

// IL CODICE SI TOGLIE SUBITO DALL'INDIRIZZO, prima di tutto il resto, così
// non resta in cronologia, in un segnalibro, in una schermata condivisa.
// Torna il codice ('' se ce n'era uno storto, null se non c'era).
export function prendiCodiceDallIndirizzo(luogo = globalThis.location, storia = globalThis.history) {
  if (!luogo?.hash) return null
  const { codice, resto } = leggiFrammento(luogo.hash)
  if (codice === null) return null
  storia?.replaceState?.(storia.state, '', `${luogo.pathname}${luogo.search}${resto}`)
  return codice
}

// Il codice preso all'avvio (main.jsx, prima del router e di tutto il
// resto), in attesa che l'app lo scambi. Si consuma una volta sola: React,
// in sviluppo, monta due volte, e il secondo scambio troverebbe il codice
// già speso.
let inAttesa = null
export function catturaCodiceRegia(luogo, storia) {
  inAttesa = prendiCodiceDallIndirizzo(luogo, storia)
}
export const codiceRegiaInAttesa = () => inAttesa !== null
export function consumaCodiceRegia() {
  const codice = inAttesa
  inAttesa = null
  return codice
}

// Le frasi per chi è davanti allo schermo. Senza colpe e senza codici di
// errore: c'è sempre l'accesso con email e password.
export const MESSAGGI_PASSAGGIO = Object.freeze({
  non_valido: 'Il collegamento dall’area clienti non è valido. Si entra con email e password.',
  scaduto:
    'Il collegamento dall’area clienti è scaduto o è già stato usato. Si riapre dall’area clienti, oppure si entra con email e password.',
  non_disponibile: 'L’area clienti non risponde in questo momento. Si entra con email e password.',
  senza_rete: 'Senza connessione l’accesso dall’area clienti non è possibile. Si entra con email e password.',
})

// Un rifiuto: la frase della regia, se c'è, vince; se no quella per lo
// status, o quella di ripiego.
const rifiuto = (status, corpo, perStatus, ripiego) => ({
  ok: false,
  messaggio: erroreDellaRegia(corpo) || MESSAGGI_PASSAGGIO[perStatus[status] ?? ripiego],
})

// La risposta di scambiaPassaggio: { ok, token } o { ok: false, messaggio }.
// 400 il codice non va, 403 scaduto, già usato o di un altro sito, 503 la
// regia non può.
export function esitoScambio(status, corpo) {
  if (status === 200 && typeof corpo?.token === 'string' && corpo.token) return { ok: true, token: corpo.token }
  return rifiuto(status, corpo, { 400: 'non_valido', 403: 'scaduto', 0: 'senza_rete' }, 'non_disponibile')
}

// DALLA REGIA ALL'APP. `accedi(token)` è signInWithCustomToken: l'utente è
// il titolare nel locale, coi suoi claim. Una volta sola, niente nuovi
// tentativi: il codice è già stato speso alla prima chiamata. Lo si fa
// anche con l'installazione «non attivata»: l'account c'è comunque.
export async function entraDallaRegia(codice, { accedi, prendi = globalThis.fetch, progetto } = {}) {
  if (!codice) return { ok: false, messaggio: MESSAGGI_PASSAGGIO.non_valido }
  const url = urlScambio(progetto)
  if (!url || typeof prendi !== 'function') return { ok: false, messaggio: MESSAGGI_PASSAGGIO.non_disponibile }
  const r = await postaAllaRegia(url, { prendi, corpo: { codice } })
  const esito = esitoScambio(r.status, r.corpo)
  if (!esito.ok) return esito
  try {
    await accedi(esito.token)
    return { ok: true }
  } catch {
    return { ok: false, messaggio: MESSAGGI_PASSAGGIO.scaduto }
  }
}

// «AREA CLIENTI» È UN COLLEGAMENTO. Prima il tasto chiedeva alla regia
// (passaggioVersoRegia) di aprire l'area già entrati col token di qui, e la
// regia lasciava passare solo il titolare: un account admin con la sua
// stessa email, verificata. Daniele, 14/11/2026: «non può portarlo
// semplicemente all'app dove lui poi deve fare il login, ma se lo ha già
// fatto si ritrova già nella sua area? Perché tutta questa complicazione?».
// Quindi si apre la pagina della regia `/dashboard`: chi vi è già entrato su
// quel dispositivo ci si ritrova, gli altri entrano lì come sempre. Chi sia
// lo dice la regia, non l'account con cui si è entrati qui.
// DOVE: la regia che la licenza nomina (`regia_url`), se è un https; se no
// quella della build, ma solo se è uno dei progetti della regia (come le
// Functions, funzioniRegia.js). Della licenza conta l'indirizzo del sito, non
// il percorso: la pagina è sempre `/dashboard`.
export function indirizzoAreaClienti(settings, progetto = import.meta.env?.VITE_REGIA_PROGETTO) {
  try {
    const daLicenza = new URL(urlRegia(settings))
    if (daLicenza.protocol === 'https:') return new URL('/dashboard', daLicenza.origin).href
  } catch {
    /* nessun indirizzo nella licenza, o non valido: vale la build */
  }
  return PROGETTI_REGIA.includes(progetto) ? `https://${progetto}.web.app/dashboard` : null
}

// Il tasto si mostra agli admin, quando c'è un indirizzo dove mandarli.
export const areaClientiVisibile = ({ admin, settings, progetto }) =>
  Boolean(admin && indirizzoAreaClienti(settings, progetto))
