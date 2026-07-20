// RAPP ORE: registro ore dello staff (replica del foglio Excel storico).
// Logica pura: calcolo ore di un turno (anche a cavallo di mezzanotte,
// siamo un bar) e totali mensili per persona.

// Ore lavorate: "HH:MM" → "HH:MM", meno la pausa. Se l'uscita è prima
// dell'entrata il turno passa la mezzanotte (+24h). Ritorna ore decimali
// arrotondate ai centesimi, oppure null se gli orari non sono validi.
export function computeHours(start, end, breakMinutes = 0) {
  const toMin = (t) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim())
    if (!m) return null
    const h = Number(m[1])
    const min = Number(m[2])
    if (h > 23 || min > 59) return null
    return h * 60 + min
  }
  const a = toMin(start)
  const b = toMin(end)
  if (a == null || b == null) return null
  let diff = b - a
  if (diff <= 0) diff += 24 * 60 // turno oltre la mezzanotte
  diff -= Math.max(0, Number(breakMinutes) || 0)
  if (diff < 0) return null
  return Math.round((diff / 60) * 100) / 100
}

// Chiave mese di una data ISO (YYYY-MM-DD → YYYY-MM).
export const monthKey = (date) => String(date || '').slice(0, 7)

// Ore totali di un elenco di turni.
export const sumHours = (entries) =>
  Math.round((entries || []).reduce((s, e) => s + (Number(e.hours) || 0), 0) * 100) / 100

// Turni raggruppati per giorno: Map 'YYYY-MM-DD' → { total, entries }.
export function byDay(entries) {
  const m = new Map()
  for (const e of entries || []) {
    const cur = m.get(e.date) || { total: 0, entries: [] }
    cur.entries.push(e)
    cur.total = Math.round((cur.total + (Number(e.hours) || 0)) * 100) / 100
    m.set(e.date, cur)
  }
  return m
}

// Le 6 settimane (42 giorni) che coprono il mese, partendo dal lunedì:
// [{ date: 'YYYY-MM-DD', inMonth }]. `weekStartsMonday` per l'Italia.
export function monthGrid(monthStr) {
  const [y, mo] = String(monthStr).split('-').map(Number)
  const first = new Date(Date.UTC(y, mo - 1, 1))
  const dow = (first.getUTCDay() + 6) % 7 // 0 = lunedì
  const start = new Date(first)
  start.setUTCDate(first.getUTCDate() - dow)
  const days = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    days.push({ date: d.toISOString().slice(0, 10), inMonth: d.getUTCMonth() === mo - 1 })
  }
  return days
}

// I 7 giorni (lun→dom) della settimana che contiene `dateStr`.
export function weekDays(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const dow = (d.getUTCDay() + 6) % 7
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() - dow)
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday)
    x.setUTCDate(monday.getUTCDate() + i)
    return x.toISOString().slice(0, 10)
  })
}

// Sposta una data ISO di N giorni.
export function shiftDay(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

// Totali del mese per persona: [{ name, hours, turni }] ordinati per nome,
// più il totale complessivo.
export function monthlyTotals(entries) {
  const byName = new Map()
  let total = 0
  for (const e of entries || []) {
    const h = Number(e.hours) || 0
    total += h
    const cur = byName.get(e.staff_name) || { name: e.staff_name, hours: 0, turni: 0 }
    cur.hours = Math.round((cur.hours + h) * 100) / 100
    cur.turni += 1
    byName.set(e.staff_name, cur)
  }
  return {
    people: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)),
    total: Math.round(total * 100) / 100,
  }
}
