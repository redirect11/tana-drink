// ── IL PASSAGGIO FRA LA REGIA E L'APP, CON UN CLIC (REQ-FLOTTA-030) ────
//
// L'utente, 02/11/2026: «Dobbiamo prevedere un single sign-on che se siamo
// loggati su backoffice o siamo loggati sulla nostra istanza tana, risulta
// loggato sia backoffice sia istanza per quell'utente», «mi serve qualcosa
// che sia sicuro e robusto», per tutte le istanze. Ogni locale è un
// progetto Firebase coi suoi account, e due siti su domini diversi non
// condividono la sessione: quindi il titolare passa con un clic, in tutti e
// due i versi, e a ogni passaggio la regia controlla che sia lui (stessa
// email, verificata, ruolo admin). Il contratto è in
// docs/passaggio-dalla-regia.md; la parte della regia è drink-regia
// REQ-FLOTTA-030.
//
// · DALLA REGIA: «Apri la tua app» apre `<app>/#accesso-regia=<codice>`.
//   Il codice vale 60 secondi e una volta sola. L'app lo toglie subito
//   dall'indirizzo, lo scambia con la regia (scambiaPassaggio) per un token
//   di accesso al locale, ed entra con quello.
// · VERSO LA REGIA: «Area clienti», per il titolare, manda alla regia
//   (passaggioVersoRegia) il suo ID token rinnovato adesso, e apre
//   l'indirizzo che la regia risponde, già entrato.
//
// Logica pura: la rete (`prendi`) e l'accesso (`accedi`, `token`) li passa
// chi chiama, così la prova non ha bisogno di Firebase.

import { urlFunzioneRegia, erroreDellaRegia, postaAllaRegia } from './funzioniRegia.js'
import { urlRegia } from './limiti.js'

const CHIAVE_FRAMMENTO = 'accesso-regia'

export const urlScambio = (progetto) => urlFunzioneRegia('scambiaPassaggio', progetto)
const urlVersoRegia = (progetto) => urlFunzioneRegia('passaggioVersoRegia', progetto)

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
  non_titolare: 'L’area clienti è riservata al titolare del locale, con la sua email.',
  da_rientrare: 'Per aprire l’area clienti serve un accesso recente: si esce, si rientra e si riprova.',
  non_trovato: 'Questo locale non risulta nell’area clienti.',
  verso_non_riuscito: 'L’area clienti non si è aperta. Si riprova tra poco.',
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

// La risposta di passaggioVersoRegia: { ok, url } o { ok: false, messaggio }.
// Si apre solo un indirizzo https: la risposta decide dove va il titolare,
// e un `javascript:` non deve poter passare.
export function esitoVersoRegia(status, corpo) {
  if (status === 200 && httpsValido(corpo?.url)) return { ok: true, url: corpo.url }
  return rifiuto(
    status,
    corpo,
    { 401: 'da_rientrare', 403: 'non_titolare', 404: 'non_trovato', 0: 'senza_rete' },
    'verso_non_riuscito'
  )
}

function httpsValido(url) {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
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

// DALL'APP ALLA REGIA. `token()` è l'ID token RINNOVATO adesso
// (getIdToken(true)): la regia vuole un accesso di meno di cinque minuti, e
// uno vecchio di un'ora lo rifiuta. Torna { ok, url } o il messaggio.
export async function versoLaRegia({ token, prendi = globalThis.fetch, progetto } = {}) {
  const url = urlVersoRegia(progetto)
  if (!url || typeof prendi !== 'function') return { ok: false, messaggio: MESSAGGI_PASSAGGIO.verso_non_riuscito }
  let idToken
  try {
    idToken = await token()
  } catch {
    return { ok: false, messaggio: MESSAGGI_PASSAGGIO.senza_rete }
  }
  if (!idToken) return { ok: false, messaggio: MESSAGGI_PASSAGGIO.da_rientrare }
  const r = await postaAllaRegia(url, { prendi, intestazioni: { Authorization: `Bearer ${idToken}` } })
  return esitoVersoRegia(r.status, r.corpo)
}

// «Area clienti» si mostra al titolare (admin), quando la build conosce la
// regia e la licenza dice dov'è (`urlRegia`): prima che la regia scriva
// la licenza della Tana, i tasti verso la regia non ci sono, come gli altri
// (FunzioneNonInclusa, InstallazioneSospesa, i moduli dall'app). Chi è
// admin ma non è il titolare lo dice la regia, al tocco: controllarlo qui
// vorrebbe dire conoscere l'email del titolare, che sta nella regia.
export const areaClientiVisibile = ({ admin, settings, progetto }) =>
  Boolean(admin && urlRegia(settings) && urlVersoRegia(progetto))
