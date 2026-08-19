import { CATEGORY_PALETTE } from './categoryColors.js'

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
// regole CSS: sulla card c'è già una striscia colorata a sinistra, e dice
// A CHE PUNTO STA il lavoro (da fare, al banco, pronto, da incassare).
//
// VINCE LO STATO, sempre. La striscia non si tocca: è quella che chi sta
// allo shaker legge per sapere cosa fare adesso, ed è la stessa in tutte
// le viste della coda. Il colore del conto è un'ALTRA informazione — «di
// chi è questa comanda» — e prende un segno suo: il PALLINO accanto al
// numero. Due segni, due domande, nessuno dei due che copre l'altro.
//
// E non è mai un fondo pieno sotto il testo: dodici tinte sature dietro
// alle scritte sarebbero illeggibili su un tema e sull'altro, e la card
// del conto pagato non si distinguerebbe più da quella da fare.

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
