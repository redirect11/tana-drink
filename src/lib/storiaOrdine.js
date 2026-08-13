// ── LA STORIA DI UN CONTO ─────────────────────────────────────────────
// Quando un conto viene riaperto, chi lo guarda un'ora dopo deve poter
// capire cos'è successo: era stato chiuso? annullato? chi l'ha riaperto e
// perché? Senza, un conto "in corso" con dentro un incasso è solo un
// mistero — e i misteri, a fine serata, diventano una cassa che non torna.
//
// La storia NON è un campo nuovo da riempire: si ricostruisce da quello che
// il conto porta già addosso (status_times, incassi, dati dell'annullo) e
// dagli eventi di riapertura, che sono l'unica cosa che va scritta apposta.
// Così vale anche per i conti di ieri, senza migrazioni.
//
// Logica pura: niente Firebase, tutto testabile.

import { ORDER_STATUSES, PAYMENT_METHOD_LABELS } from './orderStatus.js'

const iso = (v) => {
  if (!v) return null
  // Timestamp Firestore già mappati arrivano come stringhe ISO.
  if (typeof v === 'string') return v
  if (v instanceof Date) return v.toISOString()
  if (typeof v.toDate === 'function') return v.toDate().toISOString()
  return null
}

// Un evento: { at, tipo, titolo, dettaglio, chi }
// tipo ∈ 'aperto' | 'chiuso' | 'annullato' | 'riaperto'
export function storiaOrdine(order) {
  if (!order) return []
  const eventi = []
  // `tempi_conto` sono i tempi del CONTO (chiusura, annullo); `status_times`,
  // su un ordine mappato, è quello della comanda attiva — lì dentro la
  // chiusura del conto non c'è. Si guardano tutti e due: i conti vecchi
  // hanno solo il secondo.
  const t = { ...(order.status_times || {}), ...(order.tempi_conto || {}) }

  const apertura = iso(t[ORDER_STATUSES.APERTO]) || iso(order.created_at)
  if (apertura) {
    eventi.push({
      at: apertura,
      tipo: 'aperto',
      titolo: 'Conto aperto',
      dettaglio: null,
      chi: order.placed_by?.name || order.placed_by?.email || null,
    })
  }

  // CHIUSO. Il momento buono è quello dell'incasso che ha chiuso il conto;
  // sui conti vecchi resta solo `status_times.pagato`.
  const chiusura = iso(t[ORDER_STATUSES.PAGATO])
  if (chiusura) {
    const metodo = order.payment_method
    eventi.push({
      at: chiusura,
      tipo: 'chiuso',
      titolo: 'Conto chiuso',
      dettaglio: metodo ? (PAYMENT_METHOD_LABELS[metodo] || metodo) : null,
      chi: null,
    })
  }

  const annullo = iso(t[ORDER_STATUSES.ANNULLATO])
  if (annullo) {
    eventi.push({
      at: annullo,
      tipo: 'annullato',
      titolo: 'Conto annullato',
      dettaglio: order.cancel_message || order.cancel_phrase || null,
      chi: order.cancelled_by || null,
    })
  }

  for (const r of order.riaperture || []) {
    eventi.push({
      at: iso(r.at),
      tipo: 'riaperto',
      titolo: 'Conto riaperto',
      dettaglio: r.motivo || null,
      chi: r.chi || null,
    })
  }

  // In ordine di tempo. Chi non ha una data finisce in fondo: meglio in
  // fondo che a caso in mezzo agli altri.
  return eventi.sort((a, b) => {
    if (!a.at) return 1
    if (!b.at) return -1
    return a.at < b.at ? -1 : a.at > b.at ? 1 : 0
  })
}

// L'ultima riapertura: è quella da mostrare dentro il conto, col motivo.
export function ultimaRiapertura(order) {
  const lista = order?.riaperture || []
  if (lista.length === 0) return null
  return lista.reduce((piuRecente, r) =>
    !piuRecente || String(iso(r.at)) > String(iso(piuRecente.at)) ? r : piuRecente
  )
}

// Si può ripristinare solo un conto che è stato chiuso o annullato: su uno
// già in corso il tasto non deve nemmeno comparire.
export function ripristinabile(order) {
  const s = order?.status
  return s === ORDER_STATUSES.PAGATO || s === ORDER_STATUSES.ANNULLATO
}

// "12/08, 21:30" — la data serve a rimettere in fila i fatti, non è un
// documento: niente secondi, niente fuso scritto.
export function quando(v) {
  const s = iso(v)
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
