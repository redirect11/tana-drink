// ── LA CHAT DEL GESTIONALE: LA CONVERSAZIONE (REQ-AI-006) ─────────────
//
// La conversazione la tiene l'app, in memoria, finché il pannello è
// aperto (Daniele, 12/11/2026: niente memoria fra una conversazione e
// l'altra), e la rimanda intera alla regia a ogni turno: la regia non
// ricorda niente. Il formato è quello dei messaggi di Anthropic, come da
// contratto con la regia:
//   · i turni di chi scrive sono un testo, o i blocchi `tool_result` con
//     l'esito degli strumenti che il modello ha chiesto;
//   · i turni del modello si rimettono ESATTAMENTE come sono tornati: la
//     regia li firma, e un turno ritoccato lo rifiuta (400). Per
//     accorciare una conversazione se ne apre una nuova.
//
// Logica pura: chi chiama manda, esegue gli strumenti, mostra.

import { isAdmin, isGestore } from './ruoli.js'

// Gli strumenti, per identificativo: istruzioni e definizioni stanno nella
// regia. Quelli di LETTURA rispondono subito; quelli che PROPONGONO
// mostrano una proposta a schermo, da confermare: il modello non scrive
// mai da solo.
export const STRUMENTI_LETTURA = ['giacenza', 'vendite', 'cerca_prodotti']
export const STRUMENTI_PROPOSTA = ['proponi_descrizione', 'proponi_voce_menu', 'leggi_fattura']
// Solo dell'admin: la sezione Fornitori è sua (sezioni.js).
const SOLO_ADMIN = ['leggi_fattura']

// Quelli che l'app sa già eseguire. `proponi_voce_menu` aspetta il tasto
// «Crea il prodotto della cassa» (REQ-AI-002), da cui prende la scheda:
// finché non c'è, la regia non lo propone al modello.
const PRONTI = new Set(['giacenza', 'vendite', 'cerca_prodotti', 'proponi_descrizione', 'leggi_fattura'])

// Quelli che chi scrive può usare, col suo ruolo: la chat è dello staff di
// gestione. La Function controlla di nuovo i solo-admin.
export function strumentiPerRuolo(ruolo) {
  if (!isGestore(ruolo)) return []
  return [...STRUMENTI_LETTURA, ...STRUMENTI_PROPOSTA].filter(
    (s) => PRONTI.has(s) && (!SOLO_ADMIN.includes(s) || isAdmin(ruolo))
  )
}

// Oltre questo la conversazione costerebbe troppo a ogni turno, e la
// Function la rifiuterebbe (functions/lib/ai-service.js, MAX_MESSAGGI).
export const MAX_MESSAGGI = 80
export const quasiPiena = (messaggi) => (messaggi?.length || 0) >= MAX_MESSAGGI - 6

export const conTesto = (messaggi, testo) => [...messaggi, { role: 'user', content: String(testo).trim() }]

// Il turno del modello, così com'è tornato.
export const conTurno = (messaggi, turno) => [...messaggi, turno]

// Gli esiti degli strumenti, in un turno solo di chi scrive, nello stesso
// ordine delle richieste. L'esito è un oggetto: viaggia come testo JSON.
export const conEsiti = (messaggi, esiti) => [
  ...messaggi,
  {
    role: 'user',
    content: esiti.map((e) => ({
      type: 'tool_result',
      tool_use_id: e.id,
      content: JSON.stringify(e.esito ?? null),
      ...(e.errore ? { is_error: true } : {}),
    })),
  },
]

// Quante volte di fila il modello può chiedere strumenti prima di dare una
// risposta: oltre, ci si ferma e lo si dice, invece di spendere credito in
// un giro che non finisce.
export const MAX_GIRI_STRUMENTI = 6
