// Stati dell'ordine, in ordine di avanzamento.
// "tipo salumeria": ogni ordine ha un numero progressivo giornaliero.
export const ORDER_STATUSES = {
  RICEVUTO: 'ricevuto',
  IN_PREPARAZIONE: 'in_preparazione',
  PRONTO: 'pronto',
  RITIRATO: 'ritirato',
  ANNULLATO: 'annullato',
}

export const STATUS_FLOW = [
  ORDER_STATUSES.RICEVUTO,
  ORDER_STATUSES.IN_PREPARAZIONE,
  ORDER_STATUSES.PRONTO,
  ORDER_STATUSES.RITIRATO,
]

export const STATUS_LABELS = {
  [ORDER_STATUSES.RICEVUTO]: 'Ordine ricevuto',
  [ORDER_STATUSES.IN_PREPARAZIONE]: 'In preparazione',
  [ORDER_STATUSES.PRONTO]: 'Pronto al servizio',
  [ORDER_STATUSES.RITIRATO]: 'Ritirato/Servito',
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
  [ORDER_STATUSES.RICEVUTO]: '🧾',
  [ORDER_STATUSES.IN_PREPARAZIONE]: '🍹',
  [ORDER_STATUSES.PRONTO]: '🔔',
  [ORDER_STATUSES.RITIRATO]: '✅',
  [ORDER_STATUSES.ANNULLATO]: '✖️',
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
