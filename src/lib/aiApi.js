/* global __DEMO__ */
// ── L'AI DAL GESTIONALE (REQ-AI-003) ──────────────────────────────────────
//
// Le richieste all'AI passano dalla Function `richiestaAI` del locale, che
// le gira alla regia facendosi riconoscere col gettone di Google del suo
// account dedicato (functions/lib/ai-service.js). Il browser non ha niente
// da custodire: né gettoni, né la chiave del modello.
//
// Quello che torna è una PROPOSTA: la schermata la mostra e la fa accettare
// o scartare a chi lavora, mai la salva da sola. Senza credito, o con l'AI
// spenta, si ferma solo l'AI: il resto della scheda lavora come sempre.
// Serve la rete: è un attrezzo del gestionale, non del banco.
import { chiamaFunzione } from '../porte/funzioni.js'
import { senzaFunctions, aiNelPiano, MESSAGGI_PIANO } from './limiti.js'

// C'è una strada per l'AI? Sul profilo leggero le Functions non ci sono, e
// nella demo non si parla con nessun server.
export const aiRaggiungibile = () => !__DEMO__ && !senzaFunctions() && aiNelPiano()

// Cosa dire per ogni `codice` della Function. Registro del gestionale:
// piano, senza dare la colpa a chi legge.
export const MESSAGGI_AI = {
  credito: 'Il credito AI del locale è finito. Si ricarica dal sito, nell’area del locale.',
  tetto: 'È stato raggiunto il tetto di spesa AI del mese.',
  spento: "L'AI non è attiva per questo locale.",
  'senza-cassetto': "L'AI non è attiva per questo locale.",
  'non-riconosciuto': "Il servizio AI non riconosce questo locale. Va segnalato all'assistenza.",
  permesso: "L'AI la usa lo staff di gestione.",
  'senza-rete': "Per l'AI serve la rete.",
  'non-usabile': "L'AI non ha dato una risposta utilizzabile. Si può riprovare.",
  richiesta: "La richiesta all'AI non è andata a buon fine.",
  riprova: "L'AI non risponde in questo momento. Si può riprovare.",
  // Il Free, se mai ci si arriva: i tasti lì non ci sono (REQ-LIC-017).
  piano: MESSAGGI_PIANO.ai,
  // La chat (REQ-AI-006).
  versione: 'Le istruzioni dell’assistente sono state aggiornate: la conversazione riparte da capo.',
  occupato: 'Il servizio AI è occupato in questo momento. Si può riprovare fra poco.',
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

// ── IL FILE DI UNA FATTURA (REQ-AI-001) ───────────────────────────────
// I formati e i pesi che il cassetto accetta, in MB del file vero: gli
// stessi della Function (functions/lib/ai-service.js) e della regia. Si
// controllano qui, prima di spedire: un file rifiutato dopo il viaggio è
// un'attesa per niente.
export const FORMATI_FATTURA = { 'application/pdf': 20, 'image/jpeg': 5, 'image/png': 5, 'image/webp': 5, 'image/gif': 5 }

export function problemaFileFattura(file) {
  const mb = FORMATI_FATTURA[file?.type]
  if (!mb) return 'Il documento deve essere una foto (JPEG, PNG, WEBP o GIF) o un PDF.'
  if (file.size > mb * 1024 * 1024) return `Il documento supera i ${mb} MB accettati per la lettura.`
  return null
}

// Il contenuto in base64, senza il prefisso «data:…;base64,» che la
// Function rifiuta.
export function fileInBase64(blob) {
  return new Promise((resolve, reject) => {
    const lettore = new FileReader()
    lettore.onload = () => resolve(String(lettore.result).replace(/^data:[^,]*,/, ''))
    lettore.onerror = () => reject(lettore.error || new Error('Il documento non si legge.'))
    lettore.readAsDataURL(blob)
  })
}

// Il credito del locale, senza chiamare il modello (REQ-AI-003): gratis.
// Torna { ok: true, credito_eur, tetto_mensile_eur, speso_mese_eur,
// attivo, motivo } o { ok: false, codice } come ogni altra richiesta.
export const leggiCreditoAI = () => chiediAI({ tipo: 'credito' })

// Un turno della chat (REQ-AI-006): la conversazione intera, gli strumenti
// del ruolo di chi scrive, e la versione con cui la conversazione è nata.
export const chiediChat = ({ messaggi, strumenti, versione = null }) =>
  chiediAI({ tipo: 'chat', messaggi, strumenti, ...(versione ? { versione } : {}) })
