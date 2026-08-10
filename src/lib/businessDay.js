// GIORNATA COMMERCIALE — il locale lavora oltre la mezzanotte, quindi la
// "giornata" non coincide col giorno solare: con un'ora di taglio (default
// le 05:00) tutto ciò che accade fra mezzanotte e il taglio appartiene
// ancora alla giornata precedente. Sostituisce il vecchio concetto di
// "serata": niente più apertura/chiusura, il lavoro è perpetuo e i conti
// si chiudono a mano.
//
// Logica pura (niente Firebase), interamente testabile.

const TZ = 'Europe/Rome'

export const DEFAULT_CUTOFF_HOUR = 5

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

// Data e ora locali (Europe/Rome) di un istante.
function romeParts(date) {
  const parts = partsFmt.formatToParts(date)
  const get = (t) => parts.find((p) => p.type === t)?.value
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    // alcuni runtime rendono la mezzanotte come "24"
    h: Number(get('hour')) % 24,
  }
}

const normalizeCutoff = (h) => {
  const n = Number(h)
  return Number.isFinite(n) && n >= 0 && n <= 23 ? Math.floor(n) : DEFAULT_CUTOFF_HOUR
}

// Giornata commerciale (YYYY-MM-DD) a cui appartiene un istante.
export function businessDayKey(date = new Date(), cutoffHour = DEFAULT_CUTOFF_HOUR) {
  // Attenzione: new Date(null) è l'epoch, non una data invalida.
  if (date == null || date === '') return null
  const t = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(t.getTime())) return null
  const cutoff = normalizeCutoff(cutoffHour)
  const { y, m, d, h } = romeParts(t)
  const base = new Date(Date.UTC(y, m - 1, d))
  if (h < cutoff) base.setUTCDate(base.getUTCDate() - 1) // ancora la nottata di ieri
  return base.toISOString().slice(0, 10)
}

// Due istanti appartengono alla stessa giornata commerciale?
export function sameBusinessDay(a, b, cutoffHour = DEFAULT_CUTOFF_HOUR) {
  const ka = businessDayKey(a, cutoffHour)
  const kb = businessDayKey(b, cutoffHour)
  return !!ka && ka === kb
}

// L'istante da cui partire per essere certi di coprire tutta la giornata
// commerciale corrente: si torna indietro di una finestra abbondante e poi
// si filtra con `businessDayKey`. Evita conversioni fuso→UTC (e i guai del
// cambio ora) nelle query.
export function coverageStart(now = new Date(), hoursBack = 36) {
  const t = now instanceof Date ? now : new Date(now)
  return new Date(t.getTime() - hoursBack * 3600000)
}

// Etichetta COMPATTA per le card: "oggi", "ieri" o "13/06".
export function businessDayShort(key, now = new Date(), cutoffHour = DEFAULT_CUTOFF_HOUR) {
  if (!key) return ''
  const oggi = businessDayKey(now, cutoffHour)
  if (key === oggi) return 'oggi'
  const ieri = new Date(`${oggi}T00:00:00Z`)
  ieri.setUTCDate(ieri.getUTCDate() - 1)
  if (key === ieri.toISOString().slice(0, 10)) return 'ieri'
  const [, m, d] = key.split('-')
  return `${d}/${m}`
}

// Etichetta leggibile: "oggi", "ieri" o la data estesa.
export function businessDayLabel(key, now = new Date(), cutoffHour = DEFAULT_CUTOFF_HOUR) {
  if (!key) return ''
  const oggi = businessDayKey(now, cutoffHour)
  if (key === oggi) return 'oggi'
  const ieri = new Date(`${oggi}T00:00:00Z`)
  ieri.setUTCDate(ieri.getUTCDate() - 1)
  if (key === ieri.toISOString().slice(0, 10)) return 'ieri'
  return new Date(`${key}T00:00:00`).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
