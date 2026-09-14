/* global __APP_VERSION__, __BUILD_ID__, __GIT_COMMIT__ */
// ── IL DIARIO DELLA STAMPANTE SUL SERVER (REQ-STAMPA-019) ────────────
//
// Daniele, 14/09/2026, dopo un'altra sera di «stampante disconnessa» in
// produzione: «dobbiamo salvare i log diagnostici della stampante quando
// ha problemi e quando risulta offline nel database. Una log rotation per
// serata in modo da non intasare il db. Ogni apertura cassa si logga
// tutto ciò che riguarda gli errori della stampante, così possiamo
// diagnosticare da remoto».
//
// Fin qui la stampante non lasciava NIENTE fuori dal tablet: il registro
// delle stampe (registroStampe.js) e il pallino (statoStampante.js) vivono
// in localStorage e in memoria, e dal server si vedeva solo l'IP salvato.
// Per capire perché non stampava bisognava essere al banco, di sera, con
// il tablet in mano. Qui ogni guaio — collegamento fallito, stampante
// caduta, stampa non riuscita, pallino rosso — diventa una riga in un
// documento su Firestore, e la si legge da casa con
// `scripts/diagnostica-stampante.js`.
//
// COM'È FATTO, e perché:
//
// · UN DOCUMENTO PER SERATA E PER TERMINALE. La chiave è la sessione di
//   cassa aperta (`cassa-<id>`), o la giornata commerciale quando la
//   cassa è chiusa (`giorno-<aaaa-mm-gg>`), più l'id del dispositivo: due
//   tablet non si scrivono addosso, e ogni serata è un documento suo. È
//   la «rotation»: si apre la cassa, si apre un documento.
// · GLI EVENTI SI ACCODANO CON `arrayUnion`, senza rileggere: una
//   scrittura in sottofondo per evento, che si accoda anche offline.
//   Nessuna lettura, nessun `await`: la stampa non aspetta il diario.
// · NON INTASA. Lo stesso guaio ripetuto entro un minuto non si riscrive
//   (si conta, e il conto esce con l'evento dopo); oltre `TETTO_EVENTI`
//   in una serata si scrive una riga «tetto» e poi si tace. Un tablet che
//   perde la stampante ogni tre secondi produce righe utili, non una
//   valanga.
// · I VECCHI SI CANCELLANO DA SOLI. Il terminale ricorda in localStorage i
//   documenti che ha scritto e, quando ne apre uno nuovo, cancella i suoi
//   più vecchi di `GIORNI_DA_TENERE`. Niente query, niente indice, niente
//   Cloud Function: chi ha scritto, pulisce.
// · QUESTO FILE NON SA NIENTE DI FIRESTORE NÉ DELLA STAMPANTE. Chi scrive
//   davvero (api.js) e chi conosce la stampante (printer.js) e la cassa
//   (cashSession.js) si registrano qui: così printer.js e il registro
//   possono importarlo senza trascinarsi dietro Firebase, e i test lo
//   provano con uno scrittore finto.
// · NIENTE DATI PERSONALI: il nome di chi sta stampando, l'indirizzo della
//   stampante, la versione dell'app, il browser. Nessun cliente, nessun
//   conto.

import { idDispositivo } from './dispositivo.js'
import { businessDayKey } from './businessDay.js'

export const COLLEZIONE = 'diagnostica_stampante'
export const TETTO_EVENTI = 200
export const FINESTRA_RIPETIZIONI = 60_000
export const GIORNI_DA_TENERE = 14
const CHIAVE_DOCUMENTI = 'tana:diagnostica-stampante-documenti'

// I tipi di evento, per chi legge il diario.
export const TIPO = {
  apertura_cassa: 'apertura_cassa',
  collegamento_fallito: 'collegamento_fallito',
  guasto: 'guasto',
  stampa_fallita: 'stampa_fallita',
  pallino_ko: 'pallino_ko',
  pallino_ok: 'pallino_ok',
  stampante_tornata: 'stampante_tornata',
  tetto: 'tetto',
}

let _scrivi = null // (id, { intestazione, evento }) => void — lo mette api.js
let _cancella = null // (id) => void

// UN DIARIO NON FERMA MAI UNA STAMPA: chi scrive può fallire (modulo
// Firestore assente, quota, un mock nei test), e il gesto che ha segnalato
// il guaio deve andare avanti come se il diario non esistesse.
function scriviDiLato(id, cosa) {
  try {
    _scrivi(id, cosa)
  } catch {
    /* il diario è di lato: se non parte, non parte */
  }
}
function cancellaDiLato(id) {
  try {
    _cancella(id)
  } catch {
    /* idem */
  }
}
let _contesto = () => ({}) // () => { stampante: {ip, port, https}, chi } — lo mette printer.js
let _sessione = null // id della sessione di cassa aperta — lo mette cashSession.js
let _corrente = null // { id, n, tetto }
const _ultimi = new Map() // «tipo|motivo» → { quando, ripetuti }

export function impostaScrittoreDiagnostica(scrivi, cancella = null) {
  _scrivi = typeof scrivi === 'function' ? scrivi : null
  _cancella = typeof cancella === 'function' ? cancella : null
}

export function impostaContestoDiagnostica(fn) {
  _contesto = typeof fn === 'function' ? fn : () => ({})
}

export function impostaSessioneDiagnostica(id) {
  _sessione = id || null
}

// Solo per i test: si riparte da zero.
export function azzeraDiagnostica() {
  _corrente = null
  _ultimi.clear()
  _sessione = null
}

const versione = () => ({
  versione: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null,
  build: typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : null,
  commit: typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : null,
})

function contesto() {
  try {
    return _contesto() || {}
  } catch {
    return {}
  }
}

// La chiave della serata: la cassa aperta, se no la giornata commerciale.
export function chiaveSerata(sessione = _sessione, adesso = new Date()) {
  return sessione ? `cassa-${sessione}` : `giorno-${businessDayKey(adesso)}`
}

export function idDocumento(sessione = _sessione, adesso = new Date()) {
  return `${chiaveSerata(sessione, adesso)}--${idDispositivo()}`
}

// ── I DOCUMENTI SCRITTI DA QUESTO TERMINALE, per cancellare i vecchi ──
function documentiRicordati() {
  try {
    const letti = JSON.parse(localStorage.getItem(CHIAVE_DOCUMENTI) || '[]')
    return Array.isArray(letti) ? letti.filter((d) => d && d.id && d.at) : []
  } catch {
    return []
  }
}

function ricordaDocumenti(elenco) {
  try {
    localStorage.setItem(CHIAVE_DOCUMENTI, JSON.stringify(elenco))
  } catch {
    /* niente memoria: si puliranno la prossima volta che c'è */
  }
}

function apriDocumento(id, adesso) {
  _corrente = { id, n: 0, tetto: false }
  const ctx = contesto()
  const intestazione = {
    dispositivo: idDispositivo(),
    sessione_id: _sessione,
    giornata: businessDayKey(adesso),
    chi: ctx.chi || null,
    stampante: ctx.stampante || null,
    app: versione(),
    browser: typeof navigator !== 'undefined' ? String(navigator.userAgent || '').slice(0, 200) : null,
    aperto_at: adesso.toISOString(),
  }
  // Prima si pulisce, poi si ricorda il nuovo: un documento appena aperto
  // non è mai «vecchio».
  const soglia = adesso.getTime() - GIORNI_DA_TENERE * 86_400_000
  const ricordati = documentiRicordati()
  const vivi = []
  for (const d of ricordati) {
    if (d.id === id) continue
    if (new Date(d.at).getTime() < soglia) {
      if (_cancella) cancellaDiLato(d.id)
    } else vivi.push(d)
  }
  vivi.push({ id, at: adesso.toISOString() })
  ricordaDocumenti(vivi)
  return intestazione
}

// L'unico ingresso: un guaio della stampante, da chiunque lo veda.
// `dettagli` è un oggetto piatto facoltativo; `sessione` serve a chi apre
// la cassa e vuole scrivere già nel documento della sessione nuova.
export function segnala(tipo, motivo = '', dettagli = null, { sessione } = {}) {
  if (!_scrivi) return null
  const adesso = new Date()
  const t = adesso.getTime()
  const chiaveEvento = `${tipo}|${motivo}`
  const ultimo = _ultimi.get(chiaveEvento)
  if (ultimo && t - ultimo.quando < FINESTRA_RIPETIZIONI) {
    ultimo.ripetuti += 1
    return null
  }
  const ripetuti = ultimo?.ripetuti || 0
  _ultimi.set(chiaveEvento, { quando: t, ripetuti: 0 })

  if (sessione !== undefined) _sessione = sessione || null
  const id = idDocumento(_sessione, adesso)
  let intestazione = null
  if (_corrente?.id !== id) intestazione = apriDocumento(id, adesso)

  if (_corrente.n >= TETTO_EVENTI) {
    if (_corrente.tetto) return null
    _corrente.tetto = true
    const tetto = {
      at: adesso.toISOString(),
      tipo: TIPO.tetto,
      motivo: `oltre ${TETTO_EVENTI} eventi in questa serata: il resto non si scrive`,
    }
    scriviDiLato(id, { intestazione, evento: tetto })
    return tetto
  }
  const ctx = contesto()
  const evento = {
    at: adesso.toISOString(),
    tipo: String(tipo || 'guasto'),
    motivo: String(motivo || '').slice(0, 200),
    ip: ctx.stampante?.ip ?? null,
  }
  if (ripetuti > 0) evento.ripetuti_prima = ripetuti
  if (dettagli && typeof dettagli === 'object') evento.dettagli = dettagli
  _corrente.n += 1
  scriviDiLato(id, { intestazione, evento })
  return evento
}
