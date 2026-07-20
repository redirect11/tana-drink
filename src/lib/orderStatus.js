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
export const PAYMENT_METHOD_LABELS = {
  online: '💳 Online',
  lettore: '📟 SumUp (lettore)',
  banco: '💶 Contante',
  carta: '💳 Carta di credito',
  buono: '🎟 Buono VIP',
  misto: '💶+💳 Misto',
}

export function nextStatus(status) {
  const idx = STATUS_FLOW.indexOf(status)
  if (idx === -1 || idx === STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[idx + 1]
}

export function formatPrice(value) {
  const n = Number(value || 0)
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

// Nome leggibile di chi ha inserito un ordine manuale: il nome dello
// staff se impostato, altrimenti la parte locale dell'email.
export function placedByName(placedBy) {
  if (!placedBy) return ''
  if (placedBy.name) return placedBy.name
  return String(placedBy.email || '').split('@')[0]
}
