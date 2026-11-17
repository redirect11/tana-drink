// ── LA PAGINA REGGE IL TRADUTTORE DEL BROWSER (REQ-CLI-010) ──────────
//
// Daniele, 17/11/2026: le pagine dei clienti le traduce il browser. Chrome
// (e Safari, dal menu «aA») sostituisce ogni testo della pagina con un
// <font> che porta la traduzione, e il nodo di testo originale esce dalla
// pagina. React però si ricorda quel nodo, e due cose vanno storte.
//
// 1. LA PAGINA BIANCA. Quando React vuole togliere quel nodo, o metterci
//    qualcosa accanto, il browser risponde «non è figlio di questo
//    elemento» (NotFoundError) e l'app intera cade, col cliente a metà
//    ordine. Qui sotto il rimedio indicato dagli stessi sviluppatori di
//    React (facebook/react#11538): la rimozione di un nodo che non c'è più
//    si salta, e l'inserimento accanto a un nodo spostato va in fondo
//    all'elemento invece di perdersi. Il prezzo, solo con la traduzione
//    accesa: un testo tradotto che doveva sparire resta a schermo, e un
//    elemento nuovo può finire fuori posto. Meglio di una pagina bianca.
//    Fuori dalla traduzione il caso non succede, quindi per tutti gli altri
//    non cambia niente; in sviluppo ogni salto lo dice in console, perché
//    non nasconda anche un nostro errore.
//
// 2. IL TESTO VECCHIO. Un testo che React aggiorna SUL POSTO, accanto ad
//    altri nodi dello stesso elemento, col traduttore acceso resta fermo:
//    React cambia il nodo che non è più a schermo. La regola, per i testi
//    che cambiano davanti al cliente (stato, tempi, prezzi, avvisi): IL
//    TESTO CHE CAMBIA È L'UNICO FIGLIO DEL SUO ELEMENTO, scritto tutto
//    intero (un template literal, non pezzi accostati). Un elemento con un
//    solo testo React lo aggiorna riscrivendone tutto il contenuto, <font>
//    compresi, e il traduttore traduce il testo nuovo. Vedi OrderStatusPage,
//    MyOrdersPage, ModificaDaConfermare.

const sviluppo = typeof import.meta !== 'undefined' && import.meta.env?.DEV

export function proteggiDalTraduttore(Nodo = typeof Node === 'function' ? Node : null) {
  if (!Nodo?.prototype || Nodo.prototype.__protettoDalTraduttore) return
  const togli = Nodo.prototype.removeChild
  Nodo.prototype.removeChild = function (figlio) {
    if (figlio.parentNode !== this) {
      if (sviluppo) console.warn('[traduttore] rimozione saltata: il nodo non è più qui', figlio)
      return figlio
    }
    return togli.call(this, figlio)
  }
  const inserisci = Nodo.prototype.insertBefore
  Nodo.prototype.insertBefore = function (nuovo, riferimento) {
    if (riferimento && riferimento.parentNode !== this) {
      if (sviluppo) console.warn('[traduttore] inserimento in fondo: il riferimento non è più qui', riferimento)
      return inserisci.call(this, nuovo, null)
    }
    return inserisci.call(this, nuovo, riferimento)
  }
  Object.defineProperty(Nodo.prototype, '__protettoDalTraduttore', { value: true })
}
