'use strict'

// ── L'AI PASSA DALLA REGIA (REQ-AI-003) ───────────────────────────────────
//
// Il «cassetto AI» è uno, quello della regia, per tutti i locali compresa la
// Tana (Daniele, 24/10/2026). La regia controlla il credito del locale,
// chiama il modello con la chiave di Stonebit e scala il costo; il locale
// non ha MAI la chiave del modello.
//
// SENZA CHIAVE (Daniele, 12/11/2026: «niente chiave»; REQ-FLOTTA-077 della
// regia): il locale si fa riconoscere dalla regia col GETTONE D'IDENTITÀ di
// Google del suo account dedicato, `ai-locale@<progetto>`, che la Function
// usa per girare. Il gettone ha come destinatario `regia-ai:<regia>`; la
// regia ne fa controllare a Google firma, scadenza e destinatario, e legge il
// locale dal nome del progetto nell'account. Niente segreti da tenere: la
// richiesta parte da qui perché il gettone lo dà solo l'account della
// Function, mai il browser.
//
// Il contratto è quello della regia (drink-regia, docs/handover.md §7,
// «Cassetto AI»; gli schemi in functions/lib/ai.js): due tipi di richiesta
// e sei esiti. Qui si controlla la richiesta prima di spenderci un viaggio,
// e si traduce la risposta in quello che serve allo schermo: o la proposta,
// o un `codice` che dice perché no. Tutto quello che torna è una PROPOSTA
// da far rivedere al titolare prima di salvarla.
//
// Logica pura: il viaggio lo fa `deps.invia` (fetch, in index.js).

// Chi può spendere il credito del locale: lo staff di gestione, con la
// stessa regola degli account (staff-service.js, uno dei due posti lato
// Functions dove i ruoli si confrontano). Il credito è del locale, non di
// chi passa.
const { isGestore: ruoloDiGestione, isAdmin: ruoloAdmin } = require('./staff-service')
const isGestore = (auth) => ruoloDiGestione(auth?.token?.role)

// I formati di una fattura e quanto possono pesare (contratto della regia):
// le foto fino a 5 MB, i PDF fino a 20 MB. Si contano sul base64, che è 4/3
// del file.
const FORMATI_FATTURA = {
  'application/pdf': 20,
  'image/jpeg': 5,
  'image/png': 5,
  'image/webp': 5,
  'image/gif': 5,
}
const MB = 1024 * 1024
const pesoDelBase64 = (s) => Math.floor((String(s).length * 3) / 4)

// I campi che ogni tipo può portare: nient'altro va alla regia (un campo in
// più sarebbe un modo per infilare istruzioni al modello).
const CAMPI = {
  descrizione: ['tipo', 'nome', 'produttore', 'categoria', 'note'],
  fattura: ['tipo', 'file', 'media_type'],
  // Il credito senza chiamare il modello (drink-regia #217): gratis.
  credito: ['tipo'],
  // La chat (REQ-AI-006): la conversazione intera a ogni turno, perché la
  // regia non ricorda niente (Daniele: niente memoria). `versione` è quella
  // con cui la conversazione è nata, se la regia la dà.
  chat: ['tipo', 'messaggi', 'strumenti', 'versione'],
}

// ── LA CHAT (REQ-AI-006) ──────────────────────────────────────────────
// Gli strumenti che la regia conosce, per identificativo: istruzioni e
// definizioni stanno nella regia, dall'app arriva solo quali usare.
const STRUMENTI_CHAT = ['giacenza', 'vendite', 'cerca_prodotti', 'proponi_descrizione', 'proponi_voce_menu', 'leggi_fattura']
// Solo dell'admin: Fornitori è la sua sezione.
const STRUMENTI_ADMIN = ['leggi_fattura']
// Una conversazione si accorcia aprendone un'altra: oltre questi limiti
// costerebbe a ogni turno più di quanto serve, e la regia la rifiuterebbe.
const MAX_MESSAGGI = 80
const MAX_BYTE_CHAT = 400 * 1024

function chatNonValida(r) {
  const m = r.messaggi
  if (!Array.isArray(m) || m.length === 0) return 'La conversazione è vuota.'
  if (m.length > MAX_MESSAGGI) return 'La conversazione è troppo lunga: se ne apre una nuova.'
  for (const x of m) {
    if (!x || typeof x !== 'object' || !['user', 'assistant'].includes(x.role)) return 'Un messaggio della conversazione non è valido.'
    const vuoto = typeof x.content === 'string' ? x.content.trim() === '' : !Array.isArray(x.content) || x.content.length === 0
    if (vuoto) return 'Un messaggio della conversazione è vuoto.'
  }
  // Il turno da mandare è di chi scrive: un testo o gli esiti degli strumenti.
  if (m[m.length - 1].role !== 'user') return 'La conversazione deve finire con un messaggio di chi scrive.'
  if (JSON.stringify(m).length > MAX_BYTE_CHAT) return 'La conversazione è troppo lunga: se ne apre una nuova.'
  const s = r.strumenti ?? []
  if (!Array.isArray(s) || s.some((x) => !STRUMENTI_CHAT.includes(x))) return 'Uno strumento della chat non è fra quelli che la regia conosce.'
  if (r.versione != null && (typeof r.versione !== 'string' || r.versione.length > 64)) return 'La versione della conversazione non è valida.'
  return null
}

const testo = (v) => typeof v === 'string' && v.trim().length > 0

// Null se la richiesta va bene, altrimenti la frase che dice cosa non va.
function validaRichiesta(r) {
  // `Object.hasOwn`: un `tipo` come «toString» o «__proto__» non è un tipo.
  if (!r || typeof r !== 'object' || !Object.hasOwn(CAMPI, r.tipo)) return 'Il tipo di richiesta non è fra quelli che la regia accetta.'
  const estranei = Object.keys(r).filter((k) => !CAMPI[r.tipo].includes(k))
  if (estranei.length) return `Campi non previsti: ${estranei.join(', ')}.`
  if (r.tipo === 'credito') return null
  if (r.tipo === 'chat') return chatNonValida(r)
  if (r.tipo === 'descrizione') {
    // Almeno due caratteri, come chiede la regia: con uno solo risponderebbe 400.
    if (!testo(r.nome) || r.nome.trim().length < 2) return 'Per una descrizione serve il nome del prodotto.'
    for (const k of ['produttore', 'categoria', 'note']) {
      if (r[k] != null && typeof r[k] !== 'string') return `Il campo ${k} dev'essere un testo.`
    }
    return null
  }
  if (!testo(r.file)) return 'Per una fattura serve il file.'
  // Il file in base64 puro: un «data:…;base64,» davanti la regia lo rifiuta.
  if (/^data:/i.test(r.file.trim())) return 'Il file va mandato in base64, senza «data:» davanti.'
  const massimo = FORMATI_FATTURA[r.media_type]
  if (!massimo) return 'Il formato del file non è fra quelli accettati (PDF, JPEG, PNG, WebP, GIF).'
  if (pesoDelBase64(r.file) > massimo * MB) return `Il file è troppo grande: al massimo ${massimo} MB.`
  return null
}

const urlRichiestaAI = (progetto) => `https://europe-west1-${progetto}.cloudfunctions.net/richiestaAI`

// Il destinatario del gettone: NON l'indirizzo della Function, proprio la
// stringa `regia-ai:<progetto della regia>` (contratto della regia).
const destinatarioGettone = (progetto) => `regia-ai:${progetto}`

const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

// La risposta della regia, tradotta. `codice`:
//   credito | tetto | spento | senza-cassetto | piano  (402: si ferma solo
//     l'AI; «piano» è il Free, che l'AI non ce l'ha, REQ-LIC-017)
//   non-usabile  (422: il modello non ha dato niente, e il costo resta)
//   non-riconosciuto  (401: la regia non riconosce questo locale)
//   versione     (409: la chat è nata su istruzioni che non ci sono più)
//   occupato     (429: troppe richieste insieme, si riprova fra poco)
//   richiesta    (400: un errore nostro)
//   riprova      (503, rete, o una risposta che non si capisce)
function interpreta({ status, corpo }, tipoChiesto) {
  const c = corpo && typeof corpo === 'object' ? corpo : {}
  if (status === 200 && tipoChiesto === 'credito') {
    // Il credito non ha `risultato`: i numeri stanno in cima. `attivo` vuol
    // dire «una richiesta AI può partire adesso»; `motivo` dice perché no.
    if (c.ok !== true || c.tipo !== 'credito' || numero(c.credito_eur) == null) return { ok: false, codice: 'riprova' }
    return {
      ok: true,
      tipo: 'credito',
      credito_eur: numero(c.credito_eur),
      tetto_mensile_eur: numero(c.tetto_mensile_eur),
      speso_mese_eur: numero(c.speso_mese_eur),
      attivo: c.attivo === true,
      motivo: ['credito', 'tetto'].includes(c.motivo) ? c.motivo : null,
    }
  }
  if (status === 200 && tipoChiesto === 'chat') {
    // Il turno si rimette INTATTO nella conversazione: la regia lo firma, e
    // un turno ritoccato lo rifiuta. Qui si controlla solo che ci sia.
    if (c.ok !== true || c.tipo !== 'chat' || !c.turno || typeof c.turno !== 'object') return { ok: false, codice: 'riprova' }
    const richiesti = (Array.isArray(c.strumenti_richiesti) ? c.strumenti_richiesti : []).filter(
      (x) => x && typeof x.id === 'string' && STRUMENTI_CHAT.includes(x.nome) && x.input && typeof x.input === 'object'
    )
    return {
      ok: true,
      tipo: 'chat',
      turno: c.turno,
      testo: typeof c.testo === 'string' && c.testo.trim() ? c.testo : null,
      strumenti_richiesti: richiesti.map(({ id, nome, input }) => ({ id, nome, input })),
      versione: typeof c.versione === 'string' ? c.versione : null,
      costo_eur: numero(c.costo_eur),
      credito_eur: numero(c.credito_eur),
    }
  }
  if (status === 200) {
    if (c.ok !== true || !c.risultato || typeof c.risultato !== 'object') return { ok: false, codice: 'riprova' }
    // La risposta dev'essere per quello che si è chiesto.
    if (tipoChiesto && c.tipo !== tipoChiesto) return { ok: false, codice: 'riprova' }
    return { ok: true, tipo: c.tipo, risultato: c.risultato, costo_eur: numero(c.costo_eur), credito_eur: numero(c.credito_eur) }
  }
  if (status === 402) {
    const noti = ['credito', 'tetto', 'spento', 'senza-cassetto', 'piano']
    return { ok: false, codice: noti.includes(c.codice) ? c.codice : 'credito', credito_eur: numero(c.credito_eur) }
  }
  if (status === 422) return { ok: false, codice: 'non-usabile', costo_eur: numero(c.costo_eur), credito_eur: numero(c.credito_eur) }
  if (status === 401) return { ok: false, codice: 'non-riconosciuto' }
  // La versione di istruzioni e strumenti con cui la conversazione è nata
  // non c'è più: se ne apre una nuova.
  if (status === 409) return { ok: false, codice: 'versione' }
  // Troppe richieste insieme: si riprova fra poco.
  if (status === 429) return { ok: false, codice: 'occupato' }
  if (status === 400) return { ok: false, codice: 'richiesta' }
  return { ok: false, codice: 'riprova' }
}

async function richiestaAI(deps, auth, richiesta) {
  if (!isGestore(auth)) throw { code: 'permission-denied', message: "L'AI la usa lo staff di gestione del locale." }
  const errore = validaRichiesta(richiesta)
  if (errore) throw { code: 'invalid-argument', message: errore }
  // Gli strumenti dell'admin solo all'admin: la lista la fa l'app, ma qui
  // si controlla di nuovo, perché la Function la può chiamare chiunque
  // abbia un ruolo di gestione.
  if (richiesta.tipo === 'chat' && (richiesta.strumenti || []).some((x) => STRUMENTI_ADMIN.includes(x)) && !ruoloAdmin(auth?.token?.role)) {
    throw { code: 'permission-denied', message: "Questo strumento della chat è riservato all'admin." }
  }
  // Senza sapere QUALE regia (REGIA_PROGETTO) l'AI è spenta: un locale di
  // prova non deve finire a chiedere alla regia vera, e un locale senza
  // l'account `ai-locale` non avrebbe niente con cui farsi riconoscere.
  const progetto = deps.progettoRegia()
  if (!progetto) return { ok: false, codice: 'spento' }
  // Il gettone si chiede a Google a ogni richiesta: dura un'ora, e la
  // richiesta all'AI è rara. Se Google non lo dà, la regia non si chiama.
  let gettone
  try {
    gettone = await deps.gettone(destinatarioGettone(progetto))
  } catch {
    gettone = null
  }
  if (!gettone) return { ok: false, codice: 'riprova' }
  const corpo = Object.fromEntries(CAMPI[richiesta.tipo].filter((k) => richiesta[k] != null).map((k) => [k, richiesta[k]]))
  let risposta
  try {
    risposta = await deps.invia(urlRichiestaAI(progetto), {
      method: 'POST',
      headers: { Authorization: `Bearer ${gettone}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    })
  } catch {
    return { ok: false, codice: 'riprova' }
  }
  return interpreta(risposta, richiesta.tipo)
}

module.exports = { richiestaAI, validaRichiesta, urlRichiestaAI, destinatarioGettone, interpreta, STRUMENTI_CHAT }
