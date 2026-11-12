/* global __DEMO__ */
// ── L'AI DAL GESTIONALE (REQ-AI-003) ──────────────────────────────────────
//
// Le richieste all'AI passano dalla Function `richiestaAI` del locale, che
// le gira alla regia con la Chiave AI del locale (functions/lib/ai-service.js).
// Il browser non vede mai né quella chiave né quella del modello.
//
// Quello che torna è una PROPOSTA: la schermata la mostra e la fa accettare
// o scartare a chi lavora, mai la salva da sola. Senza credito, o con l'AI
// spenta, si ferma solo l'AI: il resto della scheda lavora come sempre.
// Serve la rete: è un attrezzo del gestionale, non del banco.
import { chiamaFunzione } from '../porte/funzioni.js'
import { senzaFunctions } from './limiti.js'

// C'è una strada per l'AI? Sul profilo leggero le Functions non ci sono, e
// nella demo non si parla con nessun server.
export const aiRaggiungibile = () => !__DEMO__ && !senzaFunctions()

// Cosa dire per ogni `codice` della Function. Registro del gestionale:
// piano, senza dare la colpa a chi legge.
export const MESSAGGI_AI = {
  credito: 'Il credito AI del locale è finito. Si ricarica dal sito, nell’area del locale.',
  tetto: 'È stato raggiunto il tetto di spesa AI del mese.',
  spento: "L'AI non è attiva per questo locale.",
  'senza-cassetto': "L'AI non è attiva per questo locale.",
  chiave: "La chiave AI del locale non è valida: va creata di nuovo dal sito, nell’area del locale.",
  permesso: "L'AI la usa lo staff di gestione.",
  'senza-rete': "Per l'AI serve la rete.",
  'non-usabile': "L'AI non ha dato una risposta utilizzabile. Si può riprovare.",
  richiesta: "La richiesta all'AI non è andata a buon fine.",
  riprova: "L'AI non risponde in questo momento. Si può riprovare.",
}

export const messaggioAI = (codice) => MESSAGGI_AI[codice] || MESSAGGI_AI.riprova

// La richiesta alla Function. Torna sempre un oggetto: { ok: true, … } con la
// proposta, o { ok: false, codice }. Un errore della chiamata (rete assente,
// permesso negato) diventa un codice, perché lo schermo non debba
// distinguere da dove viene.
// Il browser aspetta un po' più della Function (310 s), che a sua volta
// aspetta la regia: una fattura lunga si legge tutta, e il suo costo non va
// sprecato.
const ATTESA_MS = 320 * 1000

export async function chiediAI(richiesta, chiama = (dati) => chiamaFunzione('richiestaAI', dati, { attesaMs: ATTESA_MS })) {
  if (!aiRaggiungibile()) return { ok: false, codice: 'spento' }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, codice: 'senza-rete' }
  try {
    const data = await chiama(richiesta)
    return data && typeof data === 'object' ? data : { ok: false, codice: 'riprova' }
  } catch (e) {
    const codice = String(e?.code || '')
    if (codice.endsWith('permission-denied')) return { ok: false, codice: 'permesso' }
    if (codice.endsWith('invalid-argument')) return { ok: false, codice: 'richiesta' }
    return { ok: false, codice: 'riprova' }
  }
}
