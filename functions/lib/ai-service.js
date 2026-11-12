'use strict'

// ── L'AI PASSA DALLA REGIA (REQ-AI-003) ───────────────────────────────────
//
// Il «cassetto AI» è uno, quello della regia, per tutti i locali compresa la
// Tana (Daniele, 24/10/2026). La regia controlla il credito del locale,
// chiama il modello con la chiave di Stonebit e scala il costo; il locale
// non ha MAI la chiave del modello. Ha solo la sua «Chiave AI» verso la
// regia (`<slug>.<segreto>`, creata dall'admin nel backoffice della regia),
// che è un segreto di queste Functions: la richiesta parte da qui, mai dal
// browser, dove il segreto si leggerebbe.
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
const { isGestore: ruoloDiGestione } = require('./staff-service')
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
}

// Il segnaposto che la regia scrive nei segreti di un locale che non ha
// ancora la sua Chiave AI (scripts/segreti-istanza.mjs della regia).
const SEGNAPOSTO = 'non-configurato'

const testo = (v) => typeof v === 'string' && v.trim().length > 0

// Null se la richiesta va bene, altrimenti la frase che dice cosa non va.
function validaRichiesta(r) {
  if (!r || typeof r !== 'object' || !CAMPI[r.tipo]) return 'Il tipo di richiesta non è fra quelli che la regia accetta.'
  const estranei = Object.keys(r).filter((k) => !CAMPI[r.tipo].includes(k))
  if (estranei.length) return `Campi non previsti: ${estranei.join(', ')}.`
  if (r.tipo === 'descrizione') {
    if (!testo(r.nome)) return 'Per una descrizione serve il nome del prodotto.'
    for (const k of ['produttore', 'categoria', 'note']) {
      if (r[k] != null && typeof r[k] !== 'string') return `Il campo ${k} dev'essere un testo.`
    }
    return null
  }
  if (!testo(r.file)) return 'Per una fattura serve il file.'
  const massimo = FORMATI_FATTURA[r.media_type]
  if (!massimo) return 'Il formato del file non è fra quelli accettati (PDF, JPEG, PNG, WebP, GIF).'
  if (pesoDelBase64(r.file) > massimo * MB) return `Il file è troppo grande: al massimo ${massimo} MB.`
  return null
}

const urlRichiestaAI = (progetto) => `https://europe-west1-${progetto}.cloudfunctions.net/richiestaAI`

const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

// La risposta della regia, tradotta. `codice`:
//   credito | tetto | spento | senza-cassetto  (402: si ferma solo l'AI)
//   non-usabile  (422: il modello non ha dato niente, e il costo resta)
//   chiave       (401: la Chiave AI non è valida, o non c'è ancora)
//   richiesta    (400: un errore nostro)
//   riprova      (503, rete, o una risposta che non si capisce)
function interpreta({ status, corpo }) {
  const c = corpo && typeof corpo === 'object' ? corpo : {}
  if (status === 200) {
    if (c.ok !== true || !c.risultato || typeof c.risultato !== 'object') return { ok: false, codice: 'riprova' }
    return { ok: true, tipo: c.tipo, risultato: c.risultato, costo_eur: numero(c.costo_eur), credito_eur: numero(c.credito_eur) }
  }
  if (status === 402) {
    const noti = ['credito', 'tetto', 'spento', 'senza-cassetto']
    return { ok: false, codice: noti.includes(c.codice) ? c.codice : 'credito' }
  }
  if (status === 422) return { ok: false, codice: 'non-usabile', costo_eur: numero(c.costo_eur), credito_eur: numero(c.credito_eur) }
  if (status === 401) return { ok: false, codice: 'chiave' }
  if (status === 400) return { ok: false, codice: 'richiesta' }
  return { ok: false, codice: 'riprova' }
}

async function richiestaAI(deps, auth, richiesta) {
  if (!isGestore(auth)) throw { code: 'permission-denied', message: "L'AI la usa lo staff di gestione del locale." }
  const errore = validaRichiesta(richiesta)
  if (errore) throw { code: 'invalid-argument', message: errore }
  const chiave = deps.chiave()
  if (!chiave || chiave === SEGNAPOSTO) return { ok: false, codice: 'spento' }
  const corpo = Object.fromEntries(CAMPI[richiesta.tipo].filter((k) => richiesta[k] != null).map((k) => [k, richiesta[k]]))
  let risposta
  try {
    risposta = await deps.invia(urlRichiestaAI(deps.progettoRegia()), {
      method: 'POST',
      headers: { Authorization: `Bearer ${chiave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    })
  } catch {
    return { ok: false, codice: 'riprova' }
  }
  return interpreta(risposta)
}

module.exports = { richiestaAI, validaRichiesta, urlRichiestaAI, interpreta, SEGNAPOSTO }
