// ── RIAPRIRE UN CONTO: COSA DIVENTA ──────────────────────────────────
//
// Un conto chiuso sul tavolo sbagliato, annullato per un malinteso, o su
// cui il cliente vuole ordinare ancora. Riaprirlo vuol dire riportarlo
// ESATTAMENTE com'era prima che qualcuno lo chiudesse: un conto normale,
// da battere e da incassare.
//
// GLI INCASSI SI TOLGONO. Prima restavano attaccati: il conto tornava in
// corso ma "ad acconto", con le righe pagate bloccate — e riaprire serve
// proprio a toccarle. Peggio, i soldi restavano nei guadagni della serata
// di un conto di nuovo da incassare, e a fine turno si incassava due volte
// lo stesso conto. La cassa legge gli incassi dagli ordini (lib/cassa.js),
// quindi toglierli di qui li toglie anche dal flusso di cassa.
//
// Non si butta via niente: quello che era entrato resta in
// `payments_annullati` con l'ora in cui è stato tolto, e il totale finisce
// nella storia del conto, che è dove lo si va a cercare.
//
// Qui c'è solo la regola, pura e provabile: chi scrive è api.js.

import { ORDER_STATUSES } from './orderStatus.js'
import { arrotonda, movimentoInPezzi } from './magazzinoPeriodo.js'

export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// Quanto era stato incassato su questo conto.
export function incassatoSuConto(order) {
  return r2((order?.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0))
}

// UN CONTO INCASSATO CHE SI RIAPRE RIMETTE LE SCORTE (BUG-113); uno
// annullato no, l'aveva già fatto l'annullo. La regola sta qui, una volta:
// la usano la patch (le comande tornano «da scalare») e api.js (lo storno).
// Se le due cose si separassero, si tornerebbe a scalare due volte.
export const rimetteScorte = (order) => order?.status === ORDER_STATUSES.PAGATO

// Le comande ANNULLATE col conto tornano da fare; quelle già servite
// restano servite — il drink è stato bevuto davvero.
//
// `rimettiScorte` (un conto INCASSATO che si riapre, BUG-113): le scorte
// che il conto aveva scalato tornano in magazzino, quindi ogni comanda
// torna «da scalare» — alla nuova chiusura si scala una volta, con quello
// che c'è sul conto in quel momento. Un conto annullato no: le sue scorte
// le aveva già rimesse l'annullo, e le comande erano già da scalare.
export function comandeRiaperte(comande, nowIso, { rimettiScorte = false } = {}) {
  return (comande || []).map((c) => {
    const riaperta =
      c.status === ORDER_STATUSES.ANNULLATO
        ? {
            ...c,
            status: ORDER_STATUSES.RICEVUTO,
            status_times: { ...(c.status_times || {}), [ORDER_STATUSES.RICEVUTO]: nowIso },
          }
        : c
    return rimettiScorte ? { ...riaperta, inventory_applied: false, inventory_consumption: null } : riaperta
  })
}

// QUANTO HA SCALATO UN CONTO, dai suoi movimenti (BUG-113): gli scarichi
// della chiusura meno quello che riallineamenti e storni hanno già rimesso,
// riportato a pezzi prodotto per prodotto. Torna quello da rimettere:
// [{ inventory_item_id, qty, unit }] nell'unità della giacenza.
// Si legge dai MOVIMENTI e non dal segno sulle comande: i conti chiusi
// prima di BUG-113 il segno non ce l'hanno, ma i movimenti sì. Un prodotto
// che non c'è più si salta: senza l'articolo non si sa in che unità sia.
export function scaricoNetto(movimenti, itemsById) {
  const netto = new Map()
  for (const m of movimenti || []) {
    const mp = movimentoInPezzi(m, itemsById[m.item_id])
    if (mp) netto.set(m.item_id, (netto.get(m.item_id) || 0) + mp.q)
  }
  return [...netto]
    .map(([id, q]) => ({ inventory_item_id: id, qty: arrotonda(-q), unit: itemsById[id].unit ?? null }))
    .filter((c) => c.qty > 0)
}

// La patch da scrivere sull'ordine. `comande` arriva già normalizzata.
export function patchRipristino(order, { comande, nowIso, motivo = null, chi = null }) {
  const incassato = incassatoSuConto(order)
  const tolti = order?.payments || []
  return {
    payments: [],
    payment_status: 'non_richiesto',
    payment_method: null,
    paid_at: null,
    payments_annullati: [
      ...(Array.isArray(order?.payments_annullati) ? order.payments_annullati : []),
      ...tolti.map((p) => ({ ...p, tolto_at: nowIso })),
    ],
    comande: comandeRiaperte(comande, nowIso, { rimettiScorte: rimetteScorte(order) }),
    riaperture: [
      ...(Array.isArray(order?.riaperture) ? order.riaperture : []),
      {
        at: nowIso,
        motivo: motivo || null,
        chi: chi || null,
        incassi_tolti: incassato,
        // COSA STAVA ANNULLANDO. I tempi del conto tengono solo l'ULTIMA
        // chiusura: chiudendo e riaprendo due volte, la prima chiusura
        // spariva dalla storia — restavano due riaperture che non
        // riaprivano niente. Qui resta scritto cosa c'era prima.
        chiudeva: order?.status === 'annullato' ? 'annullato' : 'pagato',
        chiudeva_at:
          (order?.status === 'annullato'
            ? order?.status_times?.annullato
            : order?.status_times?.pagato || order?.paid_at) || null,
      },
    ],
  }
}

// I BUONI USATI PER PAGARE VANNO RIMESSI A POSTO.
//
// Il saldo di un buono si scala quando lo si usa, non quando i soldi
// entrano in cassa: pagando con un buono nasce una riga di incasso
// (`method: 'buono'`) e il saldo cala subito. Riaprendo il conto quella
// riga sparisce insieme alle altre — il conto è di nuovo da incassare — e
// se il saldo restasse scalato il cliente avrebbe pagato due volte: una col
// buono che non torna, una quando ripaga il conto.
//
// Il buono-SCONTO invece resta dov'è: lo sconto è ancora sul conto, quindi
// qualcuno deve pagarlo, e ri-chiudere il conto non lo scala una seconda
// volta. (Su un conto ANNULLATO il saldo era tornato al beneficiario: lì lo
// sconto si ri-addebita, vedi vouchers.js.)
//
// Oggi il buono si applica SOLO come sconto (il tastierino dello sconto,
// «🎟 Buono»): la strada che lo registrava come incasso è stata tolta
// perché non la chiamava nessuno. Questo controllo però resta, e non è
// codice per il futuro: i conti chiusi quando quella strada era attiva
// hanno righe di incasso col buono, e riaprendone uno il saldo deve
// tornare comunque.
// UNA VOLTA SOLA. Un incasso col buono già restituito porta addosso
// `restituito_at`: annullando un conto il saldo torna, e riaprendo quello
// stesso conto non deve tornare una seconda volta — sarebbe credito
// inventato, l'errore opposto a quello che si stava correggendo.
// E ANCHE I BUONI GIÀ CONSUMATI COME SCONTO. Da quando lo sconto viaggia
// dentro il pagamento (uno sconto per riscossione), un buono speso su due
// birre resta scritto lì: `payments[].sconto`, col suo `voucher_id`. Riaprendo
// il conto quel pagamento sparisce — e con lui lo sconto — quindi il credito
// deve tornare al beneficiario, se no ha pagato due volte le stesse due birre.
const buonoScontatoNel = (p) =>
  p?.sconto?.type === 'buono' && p.sconto.voucher_id && !p.sconto.restituito_at
    ? { voucher_id: p.sconto.voucher_id, amount: r2(p.sconto.amount) }
    : null

export function buoniDaRestituire(order) {
  const per = new Map()
  const aggiungi = ({ voucher_id, amount }) => {
    if (!(amount > 0)) return
    per.set(voucher_id, r2((per.get(voucher_id) || 0) + amount))
  }
  for (const p of order?.payments || []) {
    if (p?.method === 'buono' && p.voucher_id && !p.restituito_at) {
      aggiungi({ voucher_id: p.voucher_id, amount: r2(p.amount) })
    }
    const sconto = buonoScontatoNel(p)
    if (sconto) aggiungi(sconto)
  }
  return [...per.entries()].map(([voucher_id, amount]) => ({ voucher_id, amount }))
}

// Le righe di incasso col buono — e gli sconti col buono che si portano
// dentro — segnate come restituite: si scrivono sull'ordine insieme allo
// storno, così nessuno le restituisce di nuovo.
export function segnaBuoniRestituiti(payments, nowIso) {
  return (payments || []).map((p) => {
    let out = p
    if (p?.method === 'buono' && p.voucher_id && !p.restituito_at) {
      out = { ...out, restituito_at: nowIso }
    }
    if (buonoScontatoNel(p)) {
      out = { ...out, sconto: { ...p.sconto, restituito_at: nowIso } }
    }
    return out
  })
}
