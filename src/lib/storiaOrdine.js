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

import { ORDER_STATUSES, PAYMENT_METHOD_LABELS, formatPrice } from './orderStatus.js'

const iso = (v) => {
  if (!v) return null
  // Timestamp Firestore già mappati arrivano come stringhe ISO.
  if (typeof v === 'string') return v
  if (v instanceof Date) return v.toISOString()
  if (typeof v.toDate === 'function') return v.toDate().toISOString()
  return null
}

// CHI HA FATTO LA COSA, scritto sempre allo stesso modo. La stessa persona
// compariva tre volte con tre nomi diversi nella stessa storia:
// «banco@tana.local» all'apertura (l'email), «bartender» all'annullo (il
// RUOLO, che era l'unica cosa che quella strada scriveva) e «banco» alla
// riapertura. Chi legge deve poter dire «è stato lui» a colpo d'occhio.
//
// Si scrive il NOME. Il ruolo, se si sa, va fra parentesi — a volte serve
// («chi l'ha annullato aveva le chiavi?»). L'email non serve mai: è un
// indirizzo, non una persona.
const RUOLI_NOTI = new Set(['admin', 'bartender', 'staff', 'cliente'])

export function attore(chi) {
  if (!chi) return null
  if (typeof chi === 'string') {
    const v = chi.trim()
    if (!v) return null
    // Una strada vecchia scriveva solo il ruolo: meglio quello che niente.
    if (RUOLI_NOTI.has(v.toLowerCase())) return v.toLowerCase()
    return soloNome(v)
  }
  const nome = soloNome(chi.name) || soloNome(chi.email)
  const ruolo = chi.role || chi.ruolo || null
  if (!nome) return ruolo ? String(ruolo).toLowerCase() : null
  return ruolo && String(ruolo).toLowerCase() !== nome.toLowerCase()
    ? `${nome} (${String(ruolo).toLowerCase()})`
    : nome
}

// «banco@tana.local» → «banco». Quello che sta prima della chiocciola è il
// nome con cui si chiamano fra loro; il dominio non lo legge nessuno.
function soloNome(v) {
  const s = String(v || '').trim()
  if (!s) return null
  return s.includes('@') ? s.split('@')[0] : s
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
      chi: attore(order.placed_by),
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
      // La persona se c'è; sui conti annullati prima che la si scrivesse
      // resta il ruolo, che è quello che c'era.
      chi: attore(order.cancelled_persona) || attore(order.cancelled_by),
    })
  }

  // LE CHIUSURE PASSATE. I tempi del conto tengono solo l'ULTIMA: chiudendo
  // e riaprendo due volte, la prima spariva e restavano riaperture che non
  // riaprivano niente. Ogni riapertura si porta dietro cosa stava annullando
  // (vedi patchRipristino), e da lì la storia si ricompone.
  for (const r of order.riaperture || []) {
    const prima = iso(r.chiudeva_at)
    if (!prima || prima === chiusura || prima === annullo) continue
    eventi.push({
      at: prima,
      tipo: r.chiudeva === 'annullato' ? 'annullato' : 'chiuso',
      titolo: r.chiudeva === 'annullato' ? 'Conto annullato' : 'Conto chiuso',
      dettaglio: null,
      chi: null,
    })
  }

  for (const r of order.riaperture || []) {
    // I SOLDI TOLTI SI DICONO. Riaprendo, quello che era stato incassato
    // esce dai guadagni della serata: se la storia non lo dice, a fine
    // turno la cassa non torna e non si capisce perché.
    const tolti = Number(r.incassi_tolti) || 0
    const soldi = tolti > 0 ? `tolti ${formatPrice(tolti)} dagli incassi` : null
    eventi.push({
      at: iso(r.at),
      tipo: 'riaperto',
      titolo: 'Conto riaperto',
      dettaglio: [r.motivo || null, soldi].filter(Boolean).join(' · ') || null,
      chi: attore(r.chi),
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
