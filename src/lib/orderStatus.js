import { isPersonale } from './ruoli.js'

// Stati dell'ordine, in ordine di avanzamento.
// "tipo salumeria": ogni ordine ha un numero progressivo giornaliero.
export const ORDER_STATUSES = {
  // Stato dell'ORDINE (conto): aperto finché non viene pagato o annullato.
  APERTO: 'aperto',
  // Flusso di lavorazione della COMANDA (ticket) — vedi src/lib/comande.js.
  RICEVUTO: 'ricevuto',
  IN_PREPARAZIONE: 'in_preparazione',
  PRONTO: 'pronto',
  RITIRATO: 'ritirato',
  PAGATO: 'pagato',
  ANNULLATO: 'annullato',
}

export const STATUS_FLOW = [
  ORDER_STATUSES.RICEVUTO,
  ORDER_STATUSES.IN_PREPARAZIONE,
  ORDER_STATUSES.PRONTO,
  ORDER_STATUSES.RITIRATO,
  ORDER_STATUSES.PAGATO,
]

export const STATUS_LABELS = {
  [ORDER_STATUSES.APERTO]: 'Conto aperto',
  [ORDER_STATUSES.RICEVUTO]: 'Ordine ricevuto',
  [ORDER_STATUSES.IN_PREPARAZIONE]: 'In preparazione',
  [ORDER_STATUSES.PRONTO]: 'Pronto al servizio',
  [ORDER_STATUSES.RITIRATO]: 'Ritirato/Servito',
  [ORDER_STATUSES.PAGATO]: 'Pagato',
  [ORDER_STATUSES.ANNULLATO]: 'Annullato',
}

// ── LE PAROLE DEL BANCO E QUELLE DEL CLIENTE ───────────────────
//
// Lo stesso passo si chiama in due modi, e sono due parole diverse perché
// rispondono a due domande diverse.
//
// AL CLIENTE, che guarda la pagina del suo ordine, «Ordine ricevuto» dice
// quello che gli serve: l'abbiamo preso, è in lista. «Da fare» non gli
// direbbe niente — non è lui che lo deve fare.
//
// AL BANCO è il contrario: la colonna si chiama «Da fare», e ogni altro
// nome per lo stesso passo fa chiedere se siano due cose diverse. Succedeva
// davvero: la pastiglia diceva «↩︎ Ordine ricevuto» accanto a una colonna
// intitolata «Da fare».
//
// Quindi due etichette, non una sola «corretta»: chi scrive per il banco
// passa di qui, chi scrive per il cliente usa STATUS_LABELS.
export function statoAlBanco(stato, serviceMode) {
  if (stato === ORDER_STATUSES.RICEVUTO) return 'Da fare'
  // UNA PAROLA SOLA PER IL PRONTO. Lo stesso passo si chiamava in tre modi a
  // seconda di dove lo si leggeva: «Pronto» nella tabella del servizio,
  // «Pronto al servizio» sull'etichetta di stato, «Ritiro/Servizio» in testa
  // alla colonna. Chi lavora vedeva tre parole per una cosa sola, ed è lo
  // stesso guaio — più piccolo — della pastiglia che diceva «Ordine
  // ricevuto» accanto alla colonna «Da fare».
  //
  // Al banco vince la più corta: una testata di colonna si legge da lontano
  // mentre si versa, e «Ritiro/Servizio» diceva DOVE VA il drink — che è
  // un'altra domanda, e ha già le sue due colonne quando il pronto si divide
  // («Da servire» / «Da ritirare»).
  //
  // Al CLIENTE resta «Pronto al servizio» (STATUS_LABELS): a lui «Pronto»
  // da solo non dice se deve alzarsi o aspettare.
  if (stato === ORDER_STATUSES.PRONTO) return 'Pronto'
  if (stato === ORDER_STATUSES.RITIRATO) return ritiratoLabel(serviceMode)
  return STATUS_LABELS[stato]
}

// Etichetta specifica per lo stato finale, in base alla modalità di consegna.
export function ritiratoLabel(serviceMode) {
  if (serviceMode === 'banco') return 'Ritirato'
  if (serviceMode === 'tavolo') return 'Servito'
  return 'Ritirato/Servito'
}

// Frasi mostrate al cliente quando il bartender annulla un ordine.
export const CANCEL_PHRASES = {
  bancone: 'Prego recarsi al bancone.',
  staff: 'Lo staff sarà subito da te.',
}

export const STATUS_EMOJI = {
  [ORDER_STATUSES.APERTO]: '🟢',
  [ORDER_STATUSES.RICEVUTO]: '🧾',
  [ORDER_STATUSES.IN_PREPARAZIONE]: '🍹',
  [ORDER_STATUSES.PRONTO]: '🔔',
  [ORDER_STATUSES.RITIRATO]: '✅',
  [ORDER_STATUSES.PAGATO]: '💶',
  [ORDER_STATUSES.ANNULLATO]: '✖️',
}

// Etichette leggibili del metodo di pagamento di un ordine.
// GLI STESSI METODI, PER LA STAMPANTE. Niente emoji (la testina stampa
// caratteri, non icone) e il nome PER ESTESO: su una striscia di scontrini
// «Carta di credito» si distingue da «Contante» a colpo d'occhio, mentre
// «Carta» e «Contante» si somigliano abbastanza da doverli leggere uno per
// uno — e a fine serata gli scontrini si contano, non si leggono.
export const PAYMENT_METHOD_PRINT = {
  banco: 'Contante',
  contanti: 'Contante',
  carta: 'Carta di Credito',
  // IL NOME DEL LETTORE È QUELLO SCRITTO SULL'APPARECCHIO. «Carta di
  // credito (POS)» era una descrizione: chi confronta la chiusura con
  // l'estratto conto di SumUp cerca «SumUp», e due parole diverse per la
  // stessa cosa costringono a tradurre a mente mentre si contano i soldi.
  lettore: 'SumUp',
  online: 'Online',
  buono: 'Buono VIP',
}

export const PAYMENT_METHOD_LABELS = {
  online: '💳 Online',
  lettore: '📟 SumUp (lettore)',
  banco: '💶 Contante',
  carta: '💳 Carta di credito',
  buono: '🎟 Buono VIP',
  misto: '💶+💳 Misto',
}

// Ordine in cui i metodi compaiono nei riepiloghi di cassa. Chi NON è in
// questa lista viene comunque mostrato, in coda: il riepilogo si costruisce
// da quello che è stato battuto davvero, non da un elenco fisso. Un metodo
// nuovo (satispay, bancomat, buoni pasto…) si aggiunge qui solo per decidere
// dove appare e con che etichetta — contato lo è comunque, da subito.
export const CASH_METHOD_ORDER = ['banco', 'carta', 'lettore', 'online', 'buono']

// Etichetta di un metodo mai visto prima: meglio il codice grezzo in chiaro
// che farlo sparire in un altro secchio.
export function paymentMethodLabel(method) {
  return PAYMENT_METHOD_LABELS[method] || `❓ ${method || 'non indicato'}`
}

// Metodi da mostrare in un riepilogo: i noti sempre (anche a zero, così le
// righe non ballano da una serata all'altra), più gli altri effettivamente
// presenti.
export function cashMethodKeys(byMethod = {}) {
  const extra = Object.keys(byMethod).filter((k) => !CASH_METHOD_ORDER.includes(k))
  return [...CASH_METHOD_ORDER, ...extra.sort()]
}

export function nextStatus(status) {
  const idx = STATUS_FLOW.indexOf(status)
  if (idx === -1 || idx === STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[idx + 1]
}

// TORNARE INDIETRO sta in comande.js (`statiPrimaComanda`), non qui: al
// banco si torna indietro su una COMANDA, e i passi da mostrare dipendono
// da dove nasce il lavoro in quel locale — cosa che il flusso dell'ordine
// non sa. Qui c'erano due funzioni gemelle senza chiamanti: due modi di
// rispondere alla stessa domanda sono il primo passo perché divergano.

export function formatPrice(value) {
  const n = Number(value || 0)
  // `useGrouping: 'always'`: il punto delle migliaia dipende da quanto è
  // aggiornata la tabella delle lingue del dispositivo (le versioni recenti
  // non raggruppano i numeri di quattro cifre in italiano). Senza, la stessa
  // chiusura di cassa usciva "2.000,00 €" sul portatile e "2000,00 €"
  // sull'iPad — e sullo scontrino stampato non si sa nemmeno quale.
  return n.toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    useGrouping: 'always',
  })
}

// Nome leggibile di chi ha inserito un ordine manuale: il nome dello
// staff se impostato, altrimenti la parte locale dell'email.
export function placedByName(placedBy) {
  if (!placedBy) return ''
  if (placedBy.name) return placedBy.name
  return String(placedBy.email || '').split('@')[0]
}

// Lettera (iniziale) del dipendente/bartender che ha APERTO l'ordine, da
// affiancare al numero. `null` se l'ordine è stato aperto dal CLIENTE (nessun
// placed_by di staff), così a colpo d'occhio si capisce chi l'ha inserito.
export function placedByLetter(placedBy) {
  if (!placedBy) return null
  if (!isPersonale(placedBy.role)) return null
  const n = placedByName(placedBy).trim()
  return n ? n[0].toUpperCase() : null
}
