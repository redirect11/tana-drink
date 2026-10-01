// ── L'ORARIO DEL LOCALE (REQ-CASSA-015) ───────────────────────────────
//
// Flavio, 01/10/2026: «la giornata di lavoro non è dalle 5 fino alle 4.59
// del giorno dopo. Devo mettere io un inizio e una fine». Il cambio di
// giornata (business_day_cutoff_hour) dice dove finisce una giornata e
// comincia l'altra; l'orario dice quando il locale LAVORA. Sono due numeri
// diversi apposta: un conto battuto dieci minuti dopo la chiusura resta
// della sera, e se il cambio di giornata fosse la chiusura finirebbe nel
// giorno dopo.

// La fascia che le statistiche avevano scritta nel codice prima di questa
// impostazione: è il punto di partenza, così chi non tocca niente vede
// quello di prima.
export const ORARIO_PREDEFINITO = { apertura: '18:30', chiusura: '03:30' }

// "HH:MM" → minuti dalla mezzanotte (null se illeggibile). È il solo
// lettore di orari: lo usano anche le fasce delle statistiche (stats.js).
export function parseHM(s) {
  const m = String(s || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return Math.min(23, Number(m[1])) * 60 + Math.min(59, Number(m[2]))
}

// La fascia oraria delle statistiche che parte dall'orario del locale. Un
// valore illeggibile ripiega su quello predefinito, campo per campo.
export function fasciaDelLocale(settings) {
  const ok = (hm, riserva) => (parseHM(hm) == null ? riserva : hm)
  return {
    from: ok(settings?.orario_apertura, ORARIO_PREDEFINITO.apertura),
    to: ok(settings?.orario_chiusura, ORARIO_PREDEFINITO.chiusura),
  }
}

// IL CAMBIO DI GIORNATA CADE DENTRO L'ORARIO? Allora spezza una serata in
// due giornate: i conti di prima e di dopo finirebbero in giorni diversi,
// con la numerazione che riparte a metà sera. Sui bordi va bene: alla
// chiusura in punto la serata è finita. L'orario può scavalcare la
// mezzanotte (18:30 → 03:30).
export function cambioDentroOrario(cutoffHour, settings) {
  const { from, to } = fasciaDelLocale(settings)
  const a = parseHM(from)
  const c = parseHM(to)
  const t = (Number(cutoffHour) || 0) * 60
  if (a === c) return false
  return a < c ? t > a && t < c : t > a || t < c
}
