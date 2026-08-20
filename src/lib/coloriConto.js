import { CATEGORY_PALETTE } from './categoryColors.js'
import { ORDER_STATUSES } from './orderStatus.js'

// ── IL COLORE DEL CONTO ───────────────────────────────────────────────
//
// Un conto con tre comande finisce in tre colonne diverse, e da lontano
// non si vede più che sono lo stesso tavolo. Il colore serve a quello: lo
// stesso segno sulla card del conto e su tutte le card delle sue comande.
//
// IL COLORE È SCRITTO SUL CONTO, non ricalcolato dal suo id. Un hash
// sull'id — come si fa per le categorie — sarebbe stato meno codice, ma
// due cose non tornano: cambiando la tavolozza domani cambierebbero i
// colori dei conti già aperti stasera, e un terminale con una versione
// diversa dell'app disegnerebbe lo stesso conto di un altro colore. Il
// campo `colore` sul documento risolve tutte e due: si decide una volta,
// alla nascita, e da lì in poi è quello.
//
// LA TAVOLOZZA È QUELLA DELLE CATEGORIE (categoryColors.js): dodici tinte
// già scelte perché si distinguano fra loro e si leggano su tema chiaro e
// scuro. Averne una seconda vorrebbe dire due posti dove ritoccare i
// colori, e nessun motivo per cui debbano essere diversi.
export const COLORI_CONTO = CATEGORY_PALETTE

// ── CHI VINCE FRA COLORE DEL CONTO E COLORE DELLO STATO ───────────────
//
// La domanda è vera e va risposta qui, non lasciata all'ordine delle
// regole CSS: sulla card ci sono due segni colorati — la STRISCIA da 4px a
// sinistra e il FONDO — e le informazioni da dire sono tre (a che punto sta
// il lavoro, com'è messo il pagamento, di chi è questo conto).
//
// IL FONDO È SEMPRE DEL CONTO. È il segno che risponde da LONTANO —
// «quelle tre card sparse sono lo stesso tavolo» — e per quello serve una
// superficie: provato prima come pallino da 10px accanto al numero, e da
// due metri dieci pixel non ci sono.
//
// LA STRISCIA LA SCEGLIE CHI COMANDA IL LOCALE, con l'impostazione
// `bordo_colore_conto`. Di suo dice lo STATO — un vocabolario chiuso di
// tinte: arancio da fare, azzurro al banco, verde pronto, grigio uscito,
// ambra pagato-da-servire — ed è quello che chi sta allo shaker legge per
// sapere cosa fare adesso. Era l'unica risposta possibile finché la
// domanda non l'ha fatta l'utente (20/08/2026): «serve una impostazione
// che mi permetta di scegliere se il bordino rappresenta gli stati del
// pagamento ordine o può essere del colore scelto per la card». Dove i
// conti si spezzano in tante comande, riconoscere il tavolo vale più del
// passo di lavoro — che resta scritto sulla pill dello stato e sul 💳 —
// e quella è una scelta di chi il locale lo manda avanti, non nostra.
//
// DUE ECCEZIONI, e stanno tutte e due qui dentro invece che nel CSS:
//   · un conto SENZA colore (nato coi colori spenti, o tolto a mano) tiene
//     la striscia dello stato: sparire o diventare trasparente sarebbe
//     peggio di entrambe le risposte;
//   · un conto ANNULLATO tiene il grigio, impostazione o no. È lavoro
//     buttato, e una striscia accesa lo rimetterebbe in mezzo ai vivi.
//
// LA DECISIONE È UNA SOLA FUNZIONE (`coloreCardConto`), usata da tutte le
// viste della coda: corsie di stato, corsie delle comande, griglia e
// lista. Tre ternari nel JSX si sarebbero scollati al primo ritocco, ed è
// esattamente com'era nata la striscia ambra del BUG-064.

// Un conto (o la sua comanda) è lavoro buttato? Si guarda in tutti e due i
// posti perché il campo che porta l'annullamento non è sempre lo stesso:
// sul conto è `status`, sulla card di una corsia arriva in `workflow_status`.
function contoAnnullato(order) {
  return (
    order?.status === ORDER_STATUSES.ANNULLATO ||
    order?.workflow_status === ORDER_STATUSES.ANNULLATO
  )
}

// COSA METTERE SULLA CARD per il colore del conto: la classe e la
// variabile CSS, non un pezzo di schermata — il colore non è una cosa
// DENTRO la card, è la card.
//
// `bordoColoreConto` è l'impostazione del locale, già in cache come tutte
// le altre: qui dentro non si legge niente, è una funzione pura e le viste
// la chiamano mentre disegnano.
export function coloreCardConto(order, bordoColoreConto = false) {
  const colore = coloreDelConto(order)
  if (!colore) return null
  const striscia = bordoColoreConto === true && !contoAnnullato(order)
  return {
    className: striscia ? 'conto-colorato bordo-conto' : 'conto-colorato',
    style: { '--conto-colore': colore },
  }
}

// IL COLORE AUTOMATICO, dal numero del conto. Il resto della divisione
// per la tavolozza: due conti battuti di fila non prendono mai lo stesso
// colore, ed è proprio quando i conti sono vicini che serve distinguerli.
// Si calcola UNA VOLTA, alla nascita, e il risultato si scrive.
export function coloreAutomatico(numero) {
  // `Number(null)` e `Number('')` fanno zero, non «non è un numero»: senza
  // questa riga un conto senza progressivo prenderebbe il primo colore
  // della tavolozza come se fosse una scelta.
  if (numero === null || numero === undefined || numero === '') return null
  const n = Number(numero)
  if (!Number.isFinite(n)) return null
  const i = Math.trunc(n) % COLORI_CONTO.length
  // Il resto in JavaScript è negativo per i numeri negativi: non dovrebbe
  // capitare (i progressivi partono da 1), ma un indice negativo qui
  // significherebbe una card senza pallino e nessuno saprebbe perché.
  return COLORI_CONTO[(i + COLORI_CONTO.length) % COLORI_CONTO.length]
}

// Il colore di un conto che si ha in mano: quello scritto sopra, o niente.
// Niente ripieghi calcolati al volo — un conto senza colore è un conto
// nato quando i colori erano spenti, e deve restare senza finché qualcuno
// non gliene dà uno.
export function coloreDelConto(order) {
  return order?.colore || null
}

// Un colore che si può scrivere sul conto: uno della tavolozza, oppure
// null per toglierlo. Serve a non farsi mettere sul documento una stringa
// arrivata da chissà dove, che poi finisce dentro uno `style`.
export function coloreValido(c) {
  if (c === null || c === undefined || c === '') return true
  return COLORI_CONTO.some((p) => p.toLowerCase() === String(c).toLowerCase())
}
