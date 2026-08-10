// Notifiche IN APP (toast): piccole, poco invasive, in basso a destra.
// Store a livello di modulo (come pendingOrders) così sopravvive al cambio
// pagina: la sincronizzazione lanciata dal POS resta visibile in coda.
//
// Tipi: 'info' (azioni di staff/clienti: nuovo ordine, aggiunta a un conto),
// 'sync' (spinner: creazione/sincronizzazione in corso), 'success', 'error'.

let toasts = []
const subs = new Set()
let seq = 0
const timers = new Map()

const emit = () => subs.forEach((fn) => fn(toasts))

export function subscribeToasts(fn) {
  subs.add(fn)
  fn(toasts)
  return () => subs.delete(fn)
}

export function dismissToast(id) {
  clearTimeout(timers.get(id))
  timers.delete(id)
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

// Mostra un toast e ritorna l'id (per aggiornarlo, es. sync → success).
// duration 0 = resta finché non viene aggiornato/chiuso (sync, errori seri).
export function showToast(message, { kind = 'info', duration = 4000, id = null } = {}) {
  const tid = id ?? `t${++seq}`
  const t = { id: tid, message, kind }
  const exists = toasts.some((x) => x.id === tid)
  toasts = exists ? toasts.map((x) => (x.id === tid ? t : x)) : [...toasts, t]
  clearTimeout(timers.get(tid))
  if (duration > 0) timers.set(tid, setTimeout(() => dismissToast(tid), duration))
  emit()
  return tid
}

// Scorciatoie semantiche.
export const toastSync = (message, opts = {}) => showToast(message, { kind: 'sync', duration: 0, ...opts })
export const toastSuccess = (message, opts = {}) => showToast(message, { kind: 'success', duration: 2500, ...opts })
export const toastError = (message, opts = {}) => showToast(message, { kind: 'error', duration: 8000, ...opts })
