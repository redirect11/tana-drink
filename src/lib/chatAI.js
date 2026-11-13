// ── LA CHAT DEL GESTIONALE: LA CONVERSAZIONE (REQ-AI-006) ─────────────
//
// La conversazione la tiene l'app, in memoria, finché il pannello è
// aperto (Daniele, 12/11/2026: niente memoria fra una conversazione e
// l'altra), e la rimanda intera alla regia a ogni turno: la regia non
// ricorda niente. Il formato è quello dei messaggi di Anthropic, come da
// contratto con la regia:
//   · i turni di chi scrive sono un testo, o i blocchi `tool_result` con
//     l'esito degli strumenti che il modello ha chiesto;
//   · NIENTE SI RITOCCA, nemmeno i turni di chi scrive: la conversazione
//     cresce solo in fondo. La firma di ogni turno del modello copre tutto
//     quello che viene prima, e un messaggio vecchio cambiato fa rifiutare
//     la richiesta dopo (400). I turni del modello tornano con blocchi che
//     a schermo non servono (thinking, spesso vuoti; fallback dopo un
//     ripiego su un altro modello; la firma): si conservano tutti.
//   · ESITI E DOMANDA NON SI UNISCONO: se un giro di strumenti è rimasto a
//     metà, la domanda nuova va in un turno suo dopo quello degli esiti (la
//     regia accetta due turni di chi scrive di fila). E ogni strumento che
//     il modello ha chiesto ha il suo esito.
//   · L'ELENCO DEGLI STRUMENTI resta quello di partenza per tutta la
//     conversazione, anche se nel frattempo cambia il ruolo di chi scrive:
//     cambiato a metà, la regia risponde 409.
//   · LA VERSIONE: al primo messaggio non si manda; dopo, quella della
//     prima risposta. Non si scrive mai nel codice.
// Il contratto per intero sta in drink-regia, docs/handover.md §7
// (REQ-AI-008, la regia 13/11/2026).
//
// Logica pura: chi chiama manda, esegue gli strumenti, mostra.

import { isAdmin, isGestore } from './ruoli.js'

// Gli strumenti, per identificativo: istruzioni e definizioni stanno nella
// regia. Quelli di LETTURA rispondono subito; quelli che PROPONGONO
// mostrano una proposta a schermo, da confermare: il modello non scrive
// mai da solo.
const STRUMENTI_LETTURA = ['giacenza', 'vendite', 'cerca_prodotti']
const STRUMENTI_PROPOSTA = ['proponi_descrizione', 'proponi_voce_menu', 'leggi_fattura']
// Solo dell'admin: la sezione Fornitori è sua (sezioni.js).
const SOLO_ADMIN = ['leggi_fattura']

// Quelli che chi scrive può usare, col suo ruolo: la chat è dello staff di
// gestione. La Function controlla di nuovo i solo-admin.
export function strumentiPerRuolo(ruolo) {
  if (!isGestore(ruolo)) return []
  return [...STRUMENTI_LETTURA, ...STRUMENTI_PROPOSTA].filter((s) => !SOLO_ADMIN.includes(s) || isAdmin(ruolo))
}

// Oltre questo la conversazione costerebbe troppo a ogni turno, e la
// Function la rifiuterebbe (functions/lib/ai-service.js, MAX_MESSAGGI).
export const MAX_MESSAGGI = 80
export const quasiPiena = (messaggi) => (messaggi?.length || 0) >= MAX_MESSAGGI - 6

export const conTesto = (messaggi, testo) => [...messaggi, { role: 'user', content: String(testo).trim() }]

// Il turno del modello, così com'è tornato.
export const conTurno = (messaggi, turno) => [...messaggi, turno]

// I 409 della regia: la conversazione non può continuare, se ne apre una
// nuova (versione, strumenti cambiati, rifiutata, troppo lunga).
export const chiedeConversazioneNuova = (codice) => codice === 'versione' || codice === 'troppo-lunga'

// Gli strumenti che il turno del modello chiede, dai blocchi `tool_use`.
const richiesteDelTurno = (turno) =>
  (Array.isArray(turno?.content) ? turno.content : []).filter((b) => b?.type === 'tool_use' && typeof b.id === 'string')

// Gli esiti degli strumenti, in un turno solo di chi scrive, nell'ordine
// delle richieste. OGNI richiesta del turno ha il suo esito: uno strumento
// che l'app non conosce, o che la Function ha scartato, ne riceve uno di
// errore — senza, la richiesta dopo verrebbe rifiutata. L'esito è un
// oggetto: viaggia come testo JSON.
export function conEsiti(messaggi, esiti, turno = null) {
  const perId = new Map(esiti.map((e) => [e.id, e]))
  const richieste = richiesteDelTurno(turno)
  const ordinati = richieste.length
    ? richieste.map((b) => perId.get(b.id) ?? { id: b.id, esito: { errore: 'Strumento non disponibile.' }, errore: true })
    : esiti
  return [
    ...messaggi,
    {
      role: 'user',
      content: ordinati.map((e) => ({
        type: 'tool_result',
        tool_use_id: e.id,
        content: JSON.stringify(e.esito ?? null),
        ...(e.errore ? { is_error: true } : {}),
      })),
    },
  ]
}

// Quante volte di fila il modello può chiedere strumenti prima di dare una
// risposta: oltre, ci si ferma e lo si dice, invece di spendere credito in
// un giro che non finisce.
export const MAX_GIRI_STRUMENTI = 6
