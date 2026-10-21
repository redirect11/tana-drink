// ── L'ATTIVAZIONE DI UN'ISTANZA, LOGICA PURA (REQ-FLOTTA-006) ──────────
//
// Dalla richiesta in `richieste/{slug}` al lancio del workflow GitHub
// `provisiona-istanza.yml`, e dall'esito che il workflow manda indietro ai
// documenti `istanze/{slug}` e `richieste/{slug}`. Niente Firebase qui:
// index.js collega, questo decide, e si prova senza emulatori.

const SLUG = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/
const STATI = ['in coda', 'in corso', 'attiva', 'errore']

// Il corpo della chiamata `POST /repos/{repo}/actions/workflows/{file}/dispatches`.
// Gli input sono stringhe: GitHub non accetta altro.
function dispatchPayload(richiesta, { ref = 'develop' } = {}) {
  if (!richiesta || !SLUG.test(richiesta.slug || '')) throw new Error('Richiesta senza uno slug valido')
  return {
    ref,
    inputs: {
      slug: richiesta.slug,
      nome_locale: String(richiesta.nome_locale || richiesta.slug),
      piano: String(richiesta.piano || 'base'),
      moduli: (richiesta.moduli || []).join(','),
      uid: String(richiesta.uid || ''),
    },
  }
}

// Si lancia solo una richiesta «in coda»: una «in corso» è già partita,
// una «attiva» ha finito. La Function su update usa `rilanciata_il` per
// distinguere un rilancio dell'admin da un altro aggiornamento qualsiasi.
function daLanciare(prima, dopo) {
  if (!dopo || dopo.stato !== 'in coda') return false
  if (!prima) return true
  return prima.stato !== 'in coda' || (dopo.rilanciata_il && dopo.rilanciata_il !== prima.rilanciata_il)
}

// L'esito che il workflow manda: { slug, stato, url?, progetto?, versione?, errore? }.
function esitoValido(body) {
  if (!body || typeof body !== 'object') return null
  if (!SLUG.test(body.slug || '')) return null
  if (!STATI.includes(body.stato)) return null
  return {
    slug: body.slug,
    stato: body.stato,
    url: body.url ? String(body.url) : null,
    progetto: body.progetto ? String(body.progetto) : null,
    versione: body.versione ? String(body.versione) : null,
    errore: body.stato === 'errore' ? String(body.errore || 'Attivazione fallita') : null,
  }
}

// Il documento istanze/{slug} dopo un esito, a partire da quello che c'era.
function documentoIstanza(esito, prima = null, adesso = new Date()) {
  return {
    ...(prima || {}),
    slug: esito.slug,
    stato: esito.stato,
    url: esito.url ?? prima?.url ?? null,
    progetto: esito.progetto ?? prima?.progetto ?? null,
    versione: esito.versione ?? prima?.versione ?? null,
    errore: esito.errore,
    aggiornata_il: adesso.toISOString(),
  }
}

// Il bearer del callback: un confronto a tempo costante basta, il segreto
// è lungo e casuale.
function bearerValido(header, segreto) {
  if (!segreto || !header) return false
  const atteso = `Bearer ${segreto}`
  if (header.length !== atteso.length) return false
  let diff = 0
  for (let i = 0; i < atteso.length; i += 1) diff |= header.charCodeAt(i) ^ atteso.charCodeAt(i)
  return diff === 0
}

module.exports = { dispatchPayload, daLanciare, esitoValido, documentoIstanza, bearerValido, STATI }
