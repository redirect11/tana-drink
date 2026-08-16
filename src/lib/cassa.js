// FLUSSO CASSA: recap in tempo reale della cassa (serata) APERTA, calcolato
// dagli ordini nella finestra della sessione [apertura → adesso/chiusura].
//
// Si basa sugli ORDINI (order.total, payments[], paid_at, payment_method) e
// non sul ledger `payments`, che oggi non registra gli incassi di singolo
// ordine e gli acconti: partendo dagli ordini il conto è completo e coerente
// col resto dell'app (coda, statistiche).
//
// Logica pura (niente Firebase), interamente testabile.

import { orderDue } from './pagamento.js'
import { CASH_METHOD_ORDER } from './orderStatus.js'

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const inRange = (ts, from, to) => !!ts && ts >= from && (!to || ts <= to)

// I CONTI DI QUESTA APERTURA DI CASSA. Il riepilogo in cima alla coda
// diceva «0 aperti · 425 chiusi · 10.228,40 €» a cassa appena riaperta:
// contava la GIORNATA, e nella giornata ci stanno anche le serate già
// chiuse e rendicontate. I numeri in testata sono di questa apertura —
// cassa chiusa, sono zeri — perché è quello il metro con cui si guarda il
// banco: da quando ho aperto, quanto ho fatto.
//
// Gli ordini portano scritta la sessione che li ha numerati
// (`cash_session_id`), quindi non serve confrontare orari. Chi la cassa non
// la apre mai — nessun ordine ha la sessione — continua a vedere la
// giornata: togliergli i numeri sarebbe togliergli l'unico riepilogo che ha.
export function ordiniDellaCassaAperta(orders, sessione) {
  const lista = orders || []
  if (!lista.some((o) => o.cash_session_id)) return lista
  if (!sessione?.id) return []
  return lista.filter((o) => o.cash_session_id === sessione.id)
}

// Recap della cassa aperta. `session` = { opened_at, closed_at?, fondo_cassa? }.
// `nowIso` è il limite superiore per la sessione ancora aperta. Ritorna null
// se non c'è una sessione. Incassato e acconti sono contati nella finestra;
// i conti ancora aperti danno il "da incassare".
export function cashRecap(orders, session, nowIso) {
  if (!session?.opened_at) return null
  const from = session.opened_at
  const to = session.closed_at || nowIso || null

  // Il secchio dei metodi è APERTO: si accumula qualunque `method` sia stato
  // battuto, anche uno mai visto prima. Prima era un elenco fisso con un
  // fallback silenzioso su 'banco': la carta di credito, che nell'elenco non
  // c'era, finiva nel contante e gonfiava il contante atteso in cassa — una
  // serata intera contata sbagliata senza un solo segnale. I metodi noti
  // partono da zero così le righe del riepilogo non ballano.
  const byMethod = Object.fromEntries(CASH_METHOD_ORDER.map((k) => [k, 0]))
  const perOra = new Map()
  let incassato = 0
  let nPagati = 0
  let apertoDaIncassare = 0
  let nAperti = 0
  let sconti = 0 // sconti applicati ai conti chiusi nella finestra

  const bump = (ts, amt, method) => {
    if (!(amt > 0)) return
    incassato = round2(incassato + amt)
    // Niente rimappature: un metodo sconosciuto si porta dietro il suo nome
    // e si vede nel riepilogo, non viene assorbito dal contante.
    const m = method || 'banco'
    byMethod[m] = round2((byMethod[m] || 0) + amt)
    if (ts) {
      const h = String(ts).slice(11, 13)
      perOra.set(h, round2((perOra.get(h) || 0) + amt))
    }
  }

  for (const o of orders || []) {
    if (o?.status === 'annullato') continue
    const entries = o?.payments || []
    let collected = 0
    if (entries.length) {
      // Pagamenti/acconti registrati sull'ordine (split, parziali).
      for (const p of entries) {
        if (!inRange(p.at, from, to)) continue
        const a = round2(Number(p.amount) || 0)
        bump(p.at, a, p.method || 'banco')
        collected += a
      }
    } else if (o?.payment_status === 'pagato' && inRange(o?.paid_at, from, to)) {
      // Chiusura "secca" (contanti/singolo ordine): l'intero conto scontato.
      const amt = round2((Number(o.total) || 0) - (Number(o.discount_amount) || 0))
      bump(o.paid_at, amt, o.payment_method || 'banco')
      collected += amt
    }
    if (collected > 0 && o?.payment_status === 'pagato') nPagati += 1
    // Sconti concessi sui conti chiusi in questa cassa: sono già dedotti dagli
    // incassi, ma vanno mostrati per sapere quanto si è "lasciato sul tavolo".
    if (o?.payment_status === 'pagato' && inRange(o?.paid_at, from, to)) {
      sconti = round2(sconti + (Number(o.discount_amount) || 0))
    }

    if (o?.payment_status !== 'pagato') {
      const due = orderDue(o)
      if (due > 0) {
        apertoDaIncassare = round2(apertoDaIncassare + due)
        nAperti += 1
      }
    }
  }

  const perOraArr = [...perOra.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ora, importo]) => ({ ora, importo }))

  return {
    incassato,
    sconti,
    byMethod,
    nPagati,
    apertoDaIncassare,
    nAperti,
    perOra: perOraArr,
    fondo: round2(session.fondo_cassa || 0),
    // Contante atteso in cassa a fine serata = fondo + incassato in contanti.
    contanteAtteso: round2((session.fondo_cassa || 0) + byMethod.banco),
  }
}
