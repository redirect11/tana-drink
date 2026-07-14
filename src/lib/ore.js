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
