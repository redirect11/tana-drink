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
  credito: 'Il credito AI del locale è finito. Si ricarica dalla regia.',
  tetto: 'È stato raggiunto il tetto di spesa AI del mese.',
  spento: "L'AI non è attiva per questo locale.",
  'senza-cassetto': "L'AI non è attiva per questo locale.",
  chiave: "La chiave AI del locale non è valida: va rigenerata nella regia.",
  'non-usabile': "L'AI non ha dato una risposta utilizzabile. Si può riprovare.",
  richiesta: "La richiesta all'AI non è andata a buon fine.",
  riprova: "L'AI non risponde in questo momento. Si può riprovare.",
}

export const messaggioAI = (codice) => MESSAGGI_AI[codice] || MESSAGGI_AI.riprova

// La richiesta alla Function. Torna sempre un oggetto: { ok: true, … } con la
// proposta, o { ok: false, codice }. Un errore della chiamata (rete assente,
// permesso negato) diventa un codice, perché lo schermo non debba
// distinguere da dove viene.
export async function chiediAI(richiesta, chiama = (dati) => chiamaFunzione('richiestaAI', dati)) {
  if (!aiRaggiungibile()) return { ok: false, codice: 'spento' }
  try {
    const data = await chiama(richiesta)
    return data && typeof data === 'object' ? data : { ok: false, codice: 'riprova' }
  } catch (e) {
    const codice = String(e?.code || '')
    if (codice.endsWith('permission-denied')) return { ok: false, codice: 'spento' }
    if (codice.endsWith('invalid-argument')) return { ok: false, codice: 'richiesta' }
    return { ok: false, codice: 'riprova' }
  }
}
