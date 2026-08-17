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
const nomeDi = (chi) => chi?.name || String(chi?.email || '').split('@')[0] || null
const inRange = (ts, from, to) => !!ts && ts >= from && (!to || ts <= to)

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
  // CHI HA INCASSATO. In una serata al banco si alternano in due o tre alla
  // cassa: se il contante non torna, sapere chi ha battuto cosa è la prima
  // domanda che ci si fa — e senza, l'unica risposta possibile è «boh».
  const perChi = new Map()
  // L'ULTIMA ORA. La curva dice com'è andata la serata; questo dice come sta
  // andando ADESSO, che è quello che serve per decidere se aprire un'altra
  // cassa o mandare qualcuno in pausa.
  const daUnOra = to ? new Date(new Date(to).getTime() - 60 * 60 * 1000).toISOString() : null
  let ultimaOra = 0
  let nUltimaOra = 0
  // I COPERTI: quante persone, non quanti conti. Il conto medio per tavolo e
  // la spesa a testa sono due numeri diversi, e in un cocktail bar il secondo
  // dice più del primo.
  let coperti = 0

  const bump = (ts, amt, method, chi) => {
    if (!(amt > 0)) return
    if (chi) {
      const cur = perChi.get(chi) || { chi, importo: 0, n: 0 }
      cur.importo = round2(cur.importo + amt)
      cur.n += 1
      perChi.set(chi, cur)
    }
    if (daUnOra && ts && ts >= daUnOra) {
      ultimaOra = round2(ultimaOra + amt)
      nUltimaOra += 1
    }
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
        // Chi ha incassato è scritto sul pagamento; sui conti vecchi non
        // c'è, e allora si ripiega su chi ha aperto il conto — meglio un
        // nome vicino al vero che una riga «sconosciuto».
        bump(p.at, a, p.method || 'banco', nomeDi(p.by) || nomeDi(o.placed_by))
        collected += a
      }
    } else if (o?.payment_status === 'pagato' && inRange(o?.paid_at, from, to)) {
      // Chiusura "secca" (contanti/singolo ordine): l'intero conto scontato.
      const amt = round2((Number(o.total) || 0) - (Number(o.discount_amount) || 0))
      bump(o.paid_at, amt, o.payment_method || 'banco', nomeDi(o.placed_by))
      collected += amt
    }
    if (collected > 0 && o?.payment_status === 'pagato') {
      nPagati += 1
      coperti += Number(o.coperto_persons) || 0
    }
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
    // Lo «scontrino medio»: quanto lascia un conto. Zero conti chiusi vuol
    // dire nessuna media, non una media di zero.
    contoMedio: nPagati > 0 ? round2(incassato / nPagati) : null,
    coperti,
    perCoperto: coperti > 0 ? round2(incassato / coperti) : null,
    perChi: [...perChi.values()].sort((a, b) => b.importo - a.importo),
    ultimaOra,
    nUltimaOra,
  }
}
