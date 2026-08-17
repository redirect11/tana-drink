// Logica pura della CODA ordini (niente Firebase): smistamento per stato e
// riepilogo. Il servizio è perpetuo: non esistono più "serate", i conti
// restano aperti finché non li si chiude a mano. Testabile a unità.

import { ORDER_STATUSES } from './orderStatus.js'

// Smista gli ordini negli stati di lavorazione della COMANDA ATTIVA
// (workflow_status; esclude gli annullati).
export function bucketByStatus(orders) {
  const buckets = {
    [ORDER_STATUSES.RICEVUTO]: [],
    [ORDER_STATUSES.IN_PREPARAZIONE]: [],
    [ORDER_STATUSES.PRONTO]: [],
    [ORDER_STATUSES.RITIRATO]: [],
    [ORDER_STATUSES.PAGATO]: [],
  }
  for (const o of orders || []) {
    const w = o.workflow_status ?? o.status
    if (w === ORDER_STATUSES.ANNULLATO) continue
    if (buckets[w]) buckets[w].push(o)
  }
  return buckets
}

// Riepilogo: numero ordini e totale (esclude gli annullati).
export function ordersRecap(orders, isClosed = () => false) {
  let count = 0
  let total = 0
  let aperti = 0
  let chiusi = 0
  // GLI ANNULLATI SI CONTANO A PARTE. Non sono incassi e non entrano nel
  // totale — ci mancherebbe — ma sapere quanti conti sono saltati in questa
  // apertura è un dato del banco: tre annullati in una serata sono una
  // domanda da farsi.
  let annullati = 0
  for (const o of orders || []) {
    if (annullato(o) || o.status === ORDER_STATUSES.ANNULLATO) {
      annullati += 1
      continue
    }
    count += 1
    total += Number(o.total) || 0
    if (isClosed(o)) chiusi += 1
    else aperti += 1
  }
  return { count, total, aperti, chiusi, annullati }
}

// Conti ancora aperti (non pagati né annullati).
export function openOrdersCount(orders) {
  return (orders || []).filter(
    (o) => o.status !== ORDER_STATUSES.PAGATO && o.status !== ORDER_STATUSES.ANNULLATO
  ).length
}

// I conti INSERITI DA una persona (placed_by). È il filtro «Miei» della
// coda, che ha preso il posto della pagina «I miei ordini» della sala:
// stessa coda per tutti, e chi vuole ritrovare i propri la filtra.
export function inseritiDa(orders, email) {
  const e = String(email || '').trim().toLowerCase()
  if (!e) return []
  return (orders || []).filter((o) => o.placed_by?.email?.toLowerCase() === e)
}

// "Questo conto risponde a quello che sto cercando?" — numero, cliente,
// tavolo, chi l'ha battuto, drink dentro.
//
// Sta qui, in una riga sola, perché la ricerca della coda ha DUE modi di
// usarla: filtrare la lista, oppure lasciarla intera e accendere il conto
// trovato. Se le due strade rispondessero in modo diverso, cambiando
// impostazione lo stesso testo troverebbe conti diversi.
export function ordineCorrisponde(o, query) {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q || !o) return false
  return (
    String(o.daily_number ?? '').includes(q) ||
    !!o.customer_name?.toLowerCase().includes(q) ||
    !!o.table_label?.toLowerCase().includes(q) ||
    !!o.placed_by?.email?.toLowerCase().includes(q) ||
    !!o.placed_by?.name?.toLowerCase().includes(q) ||
    (o.order_items || []).some((i) => i.name?.toLowerCase().includes(q))
  )
}

// Il PRIMO conto che risponde, nell'ordine in cui sta sullo schermo: è
// quello da accendere e da portare sotto gli occhi. L'ordine lo decide chi
// chiama, passando la lista già come la si vede.
export function primoCorrispondente(orders, query) {
  return (orders || []).find((o) => ordineCorrisponde(o, query)) || null
}

// ── I FILTRI DELLA CODA ──────────────────────────────────────────────
// «In corso» è quello che c'è da fare; «Chiusi» sono i conti incassati —
// i soldi della serata — e gli ANNULLATI hanno una tab loro: mescolati ai
// chiusi facevano numero senza essere incassi, e per ritrovarne uno da
// riaprire bisognava cercarlo in mezzo a quelli buoni.
export const annullato = (o) =>
  o?.status === ORDER_STATUSES.ANNULLATO || o?.workflow_status === ORDER_STATUSES.ANNULLATO

// UN CONTO CHIUSO RESTA IN CODA SOLO PER QUESTA APERTURA DI CASSA. La coda
// è il lavoro di adesso: un conto incassato o annullato prima dell'ultima
// chiusura non è lavoro, è storia — sta in Cassa, nella lista ordini. Non
// basta guardare la giornata: in una serata la cassa si chiude e si riapre,
// e i conti della tornata precedente sono già stati contati.
//
// CONTA QUANDO È STATO CHIUSO, NON QUANDO È STATO APERTO. Un conto di ieri
// rimasto aperto e annullato stasera è successo STASERA: guardando la
// sessione in cui era nato spariva dalla tab «annullati» nell'istante in cui
// lo si annullava — si agisce su un conto e quello svanisce, senza sapere se
// l'operazione è andata a buon fine.
//
// I conti APERTI restano sempre, cassa chiusa compresa: quelli sono da
// chiudere, e nasconderli vorrebbe dire perderli.
// Senza un orario di chiusura leggibile si ripiega sulla sessione scritta
// sull'ordine, e in mancanza anche di quella sulla giornata: chi la cassa non
// la apre mai non ha altro riferimento.
export function restaInCoda(o, { chiuso, cassa, apertaDa, giornata, oggi } = {}) {
  if (!chiuso) return true
  const quando = chiusuraDelConto(o)
  if (quando && apertaDa) return quando >= apertaDa
  if (o?.cash_session_id) return o.cash_session_id === cassa
  return !giornata || !oggi || giornata === oggi
}

// Quando il conto è stato chiuso: incassato o annullato.
export function chiusuraDelConto(o) {
  return (
    o?.tempi_conto?.[ORDER_STATUSES.ANNULLATO] ||
    o?.status_times?.[ORDER_STATUSES.ANNULLATO] ||
    o?.paid_at ||
    o?.tempi_conto?.[ORDER_STATUSES.PAGATO] ||
    null
  )
}

export function passaFiltroCoda(o, filtro, isChiuso = () => false) {
  if (filtro === 'tutti') return true
  if (filtro === 'annullati') return annullato(o)
  // Un annullato non è un conto chiuso: è un conto che non c'è più.
  if (filtro === 'chiusi') return isChiuso(o) && !annullato(o)
  return !isChiuso(o)
}

// COSA MOSTRA LA CODA, in una funzione sola: quello che resta in coda per
// questa apertura di cassa, filtrato per la tab scelta. Sta qui e non nella
// pagina perché è la cosa da provare — «annullo un conto e lo ritrovo sotto
// Annullati» — e a provarla a pezzi si finisce col dimostrare che le regole
// funzionano mentre a schermo non compare niente.
export function ordiniInCoda(
  orders,
  { filtro = 'attivi', isChiuso = () => false, cassa = null, apertaDa = null, giornataDi = () => null, oggi = null } = {}
) {
  return (orders || [])
    .filter((o) =>
      restaInCoda(o, {
        chiuso: isChiuso(o) || annullato(o),
        cassa,
        apertaDa,
        giornata: giornataDi(o),
        oggi,
      })
    )
    .filter((o) => passaFiltroCoda(o, filtro, isChiuso))
}

// ── LA VOCE DELLA CASSA NEL MENU DELLA CODA ──────────────────────────
//
// Aprire e chiudere la cassa sono le due cose che si fanno a inizio e fine
// serata, e si fanno dalla schermata in cui si sta già. Ma sono del BANCO:
// chi serve ai tavoli non ci mette mano, e un tasto che risponde «non puoi»
// è peggio di un tasto che non c'è.
//
// Chiudere, poi, non si può con dei conti ancora aperti: un conto aperto è
// un incasso che manca, e far quadrare una serata con dentro un buco non si
// può. La voce resta, spenta, con scritto perché — sparire mentre si cerca
// è il modo migliore per far pensare che l'app sia rotta.
export function voceCassa({ gestore = false, cassaAperta = false, contiAperti = 0 } = {}) {
  if (!gestore) return null
  if (!cassaAperta) {
    return {
      id: 'apri-cassa',
      icon: '🟢',
      label: 'Apri cassa',
      hint: 'Senza cassa aperta non si battono ordini.',
      disabled: false,
    }
  }
  return {
    id: 'chiudi-cassa',
    icon: '🔒',
    label: 'Chiudi cassa',
    disabled: contiAperti > 0,
    hint:
      contiAperti > 0
        ? `Prima incassa i ${contiAperti} conti ancora aperti.`
        : 'Conta il contante e chiudi la serata.',
  }
}
