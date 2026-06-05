// Stati dell'ordine, in ordine di avanzamento.
// "tipo salumeria": ogni ordine ha un numero progressivo giornaliero.
export const ORDER_STATUSES = {
  RICEVUTO: 'ricevuto',
  IN_PREPARAZIONE: 'in_preparazione',
  PRONTO: 'pronto',
  RITIRATO: 'ritirato',
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
  [ORDER_STATUSES.PRONTO]: 'Pronto al ritiro',
  [ORDER_STATUSES.RITIRATO]: 'Ritirato',
}

export const STATUS_EMOJI = {
  [ORDER_STATUSES.RICEVUTO]: '🧾',
  [ORDER_STATUSES.IN_PREPARAZIONE]: '🍹',
  [ORDER_STATUSES.PRONTO]: '🔔',
  [ORDER_STATUSES.RITIRATO]: '✅',
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
