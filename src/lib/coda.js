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
export const annullato = (o) => o?.workflow_status === ORDER_STATUSES.ANNULLATO

// UN CONTO CHIUSO RESTA IN CODA SOLO PER QUESTA APERTURA DI CASSA. La coda
// è il lavoro di adesso: un conto incassato o annullato prima dell'ultima
// chiusura non è lavoro, è storia — sta in Cassa, nella lista ordini. Non
// basta guardare la giornata: in una serata la cassa si chiude e si riapre,
// e i conti della tornata precedente sono già stati contati e rendicontati.
// Comparivano lo stesso perché la coda tiene d'occhio i conti APERTI senza
// limite di data (giusto: si chiudono solo a mano), e un conto incassato
// rimasto indietro con gli stati continuava a passare da lì.
//
// I conti APERTI restano sempre, cassa chiusa compresa: quelli sono da
// chiudere, e nasconderli vorrebbe dire perderli.
// Chi la cassa non la apre mai — l'ordine non porta scritta nessuna
// sessione — ricade sulla giornata, che è l'unico riferimento che ha.
export function restaInCoda(o, { chiuso, cassa, giornata, oggi } = {}) {
  if (!chiuso) return true
  if (o?.cash_session_id) return o.cash_session_id === cassa
  return !giornata || !oggi || giornata === oggi
}

export function passaFiltroCoda(o, filtro, isChiuso = () => false) {
  if (filtro === 'tutti') return true
  if (filtro === 'annullati') return annullato(o)
  // Un annullato non è un conto chiuso: è un conto che non c'è più.
  if (filtro === 'chiusi') return isChiuso(o) && !annullato(o)
  return !isChiuso(o)
}
