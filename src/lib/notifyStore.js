// Storico delle notifiche in-app, per rivederle anche dopo (campanella).
// Persistito in localStorage così sopravvive al refresh; tenuto corto.

const KEY = 'tana:notifs'
const SEEN_KEY = 'tana:notifs:seen'
const MAX = 60

const readItems = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
const readSeen = () => Number(localStorage.getItem(SEEN_KEY) || 0) || 0

let items = readItems()
let seenAt = readSeen()
const subs = new Set()

function snapshot() {
  return { items, unseen: items.reduce((n, x) => n + (x.at > seenAt ? 1 : 0), 0) }
}
const emit = () => {
  const s = snapshot()
  subs.forEach((f) => f(s))
}
const persist = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)))
  } catch {
    /* quota/privata: resta in memoria */
  }
}

export function subscribeNotifs(fn) {
  subs.add(fn)
  fn(snapshot())
  return () => subs.delete(fn)
}

// Registra una notifica nello storico (chiamata da notify()).
export function recordNotif(title, body) {
  items = [{ id: `n${Date.now()}-${Math.floor(Math.random() * 1e4)}`, title: title || '', body: body || '', at: Date.now() }, ...items].slice(0, MAX)
  persist()
  emit()
}

// Segna tutto come letto (all'apertura del pannello).
export function markNotifsSeen() {
  seenAt = Date.now()
  try {
    localStorage.setItem(SEEN_KEY, String(seenAt))
  } catch {
    /* ok */
  }
  emit()
}

export function clearNotifs() {
  items = []
  persist()
  emit()
}
