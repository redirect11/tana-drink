// ── L'AI NELL'APP: ASSENTE, SENZA CREDITO, ATTIVA (REQ-AI-007) ─────────
//
// Daniele, 13/11/2026: se l'admin della regia disattiva l'AI per un locale
// «è come se non ci fosse»; se è attiva senza credito, il tasto
// dell'assistente è grigio con l'avviso e ricorda di ricaricare. Una regola
// sola, per tutta l'app:
//   · ASSENTE: la licenza non la comprende (`ai: false`, REQ-LIC-017), o la
//     regia risponde «senza-cassetto», «spento» o «piano»;
//   · SENZA_CREDITO: credito finito o tetto del mese raggiunto;
//   · ATTIVA: tutto come sempre;
//   · IGNOTO: non si sa ancora, o la rete non risponde. Non si nasconde
//     niente: sarà la risposta dell'AI a dire cosa non va.
//
// Lo stato viene dalla richiesta del credito (gratis, REQ-AI-003), chiesta
// all'avvio del gestionale e ricordata per qualche minuto; ogni risposta
// dell'AI lo aggiorna (aiApi.js, ascoltaRisposteAI), così chi esaurisce il
// credito con l'ultima richiesta vede il tasto spegnersi subito.

import { useEffect, useSyncExternalStore } from 'react'
import { aiRaggiungibile, leggiCreditoAI, ascoltaRisposteAI, MESSAGGI_AI } from './aiApi.js'
import { showToast } from './toast.js'

export const STATI_AI = Object.freeze({ ASSENTE: 'assente', SENZA_CREDITO: 'senza-credito', ATTIVA: 'attiva', IGNOTO: 'ignoto' })

const MEMORIA_MS = 5 * 60 * 1000
const ASSENTE_DA = ['senza-cassetto', 'spento', 'piano']
const SENZA_CREDITO_DA = ['credito', 'tetto']

let _stato = { stato: STATI_AI.IGNOTO }
let _quando = 0
let _inCorso = null
const _ascolto = new Set()

function annuncia(next) {
  _stato = next
  _quando = Date.now()
  for (const f of _ascolto) f()
}

// Lo stato dalla risposta del credito.
export function statoDaCredito(r) {
  if (r?.ok) {
    if (r.attivo) return { stato: STATI_AI.ATTIVA }
    return { stato: STATI_AI.SENZA_CREDITO, motivo: r.motivo === 'tetto' ? 'tetto' : 'credito' }
  }
  if (ASSENTE_DA.includes(r?.codice)) return { stato: STATI_AI.ASSENTE }
  if (SENZA_CREDITO_DA.includes(r?.codice)) return { stato: STATI_AI.SENZA_CREDITO, motivo: r.codice }
  return { stato: STATI_AI.IGNOTO }
}

// Lo stato dalla risposta di una richiesta qualunque all'AI: dice qualcosa
// solo quando è chiaro (una risposta buona, o un 402).
export function statoDaRisposta(r) {
  if (r?.ok) return r.tipo === 'credito' ? statoDaCredito(r) : { stato: STATI_AI.ATTIVA }
  if (ASSENTE_DA.includes(r?.codice) || SENZA_CREDITO_DA.includes(r?.codice)) return statoDaCredito(r)
  return null
}

ascoltaRisposteAI((r) => {
  const s = statoDaRisposta(r)
  if (s) annuncia(s)
})

export const statoAI = () => _stato

// Chiede il credito, se lo stato non è fresco. Senza l'AI nella licenza non
// si chiede niente: è assente.
function aggiornaStatoAI({ forza = false } = {}) {
  if (!aiRaggiungibile()) {
    if (_stato.stato !== STATI_AI.ASSENTE) annuncia({ stato: STATI_AI.ASSENTE })
    return Promise.resolve(_stato)
  }
  if (!forza && _stato.stato !== STATI_AI.IGNOTO && Date.now() - _quando < MEMORIA_MS) return Promise.resolve(_stato)
  if (_inCorso) return _inCorso
  _inCorso = leggiCreditoAI()
    .then(() => _stato) // lo stato l'ha già aggiornato l'ascolto delle risposte
    .finally(() => {
      _inCorso = null
    })
  return _inCorso
}

function iscriviti(f) {
  _ascolto.add(f)
  return () => _ascolto.delete(f)
}

// Lo stato per chi disegna, e la prima richiesta quando serve: `chiedi`
// solo dove l'AI si può usare (lo staff di gestione).
export function useStatoAI(chiedi = true) {
  const s = useSyncExternalStore(iscriviti, statoAI, statoAI)
  useEffect(() => {
    if (chiedi) aggiornaStatoAI()
  }, [chiedi])
  return s
}

// Il promemoria di chi tocca l'AI senza credito.
export const messaggioSenzaCredito = (motivo) => (motivo === 'tetto' ? MESSAGGI_AI.tetto : MESSAGGI_AI.credito)

// LA REGOLA DEI TRE STATI PER UN TASTO (REQ-AI-007), una sola per i tasti
// AI, quello dell'assistente e la voce del ⋮: assente non si disegna;
// senza credito è grigio con l'avviso, e toccandolo lo ricorda.
export function useTastoAI(chiedi = true) {
  const { stato, motivo } = useStatoAI(chiedi)
  const senzaCredito = stato === STATI_AI.SENZA_CREDITO
  const avviso = senzaCredito ? messaggioSenzaCredito(motivo) : null
  return {
    assente: stato === STATI_AI.ASSENTE,
    senzaCredito,
    avviso,
    avvisa: () => showToast(avviso, { kind: 'error' }),
  }
}

// Solo per i test: si riparte da capo.
export function _azzeraStatoAI() {
  _stato = { stato: STATI_AI.IGNOTO }
  _quando = 0
  _inCorso = null
}
