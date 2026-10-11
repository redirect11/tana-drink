// ── I GIORNI IN CUI C'È STATO SERVIZIO (REQ-STAT-007) ─────────────────
//
// Per colorare i calendari: una giornata commerciale ha avuto servizio se
// c'è una chiusura di cassa dell'app, oppure una giornata di Tiller (prima
// dell'app, REQ-STAT-006). Sono due letture piccole — un anno di chiusure e
// l'indice delle serate di Tiller, un documento — e il risultato non cambia
// durante la serata se non alla prossima apertura di cassa: si tiene in
// mano, e le tre schermate col calendario non lo rileggono ognuna per sé.

import { fetchCashSessions, fetchSerateStoriche } from './api.js'
import { businessDayKey } from './businessDay.js'

// Logica pura: dalle chiusure e dalle serate storiche all'insieme delle
// giornate.
export function giornateConServizio(sessions, serateStoriche, cutoffHour) {
  const g = new Set()
  for (const s of sessions || []) {
    const k = s?.opened_at ? businessDayKey(s.opened_at, cutoffHour) : null
    if (k) g.add(k)
  }
  for (const s of serateStoriche || []) if (s?.giorno) g.add(s.giorno)
  return g
}

let inMano = null // { cutoffHour, giornate }
export async function fetchGiorniDiServizio(cutoffHour) {
  if (inMano && inMano.cutoffHour === cutoffHour) return inMano.giornate
  const [sessions, storiche] = await Promise.all([
    fetchCashSessions({ limit: 400 }).catch(() => []),
    fetchSerateStoriche(),
  ])
  const giornate = giornateConServizio(sessions, storiche, cutoffHour)
  inMano = { cutoffHour, giornate }
  return giornate
}

// Una chiusura appena fatta: si aggiunge, senza rileggere.
export function segnaServizio(giorno) {
  if (inMano && giorno) inMano.giornate.add(giorno)
}
