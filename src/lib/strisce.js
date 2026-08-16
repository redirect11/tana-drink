// ── COSA DICE LA STRISCIA A SINISTRA DELLE CARD ──────────────────────
//
// La striscia è lo stesso segno in tre schermate — la griglia del conto,
// le card del menù, la coda — e finora diceva una cosa decisa da noi. Ma
// dipende da come si lavora: chi conosce il listino a memoria vuole i
// colori delle categorie per trovare il prodotto al tatto; chi sta finendo
// le bottiglie vuole vedere subito cosa non si può più fare; chi ha già
// abbastanza colori addosso la vuole spenta.
//
// Quindi la si sceglie, e la scelta è del locale (settings/bar), non del
// dispositivo: la griglia dev'essere la stessa su tutti i terminali, o due
// persone parlano di due schermate diverse.
//
// I quattro modi:
//   spenta     grigia sempre — meno rumore, il colore lo dice la linguetta
//   prodotto   il colore del prodotto; se non ne ha uno, la sua categoria
//   categoria  sempre quello della categoria (il colore del singolo
//              prodotto resta nella linguetta in alto a sinistra)
//   scorte     rosso ingrediente esaurito, arancione in esaurimento,
//              e «c'è abbastanza» a scelta: grigio (discreto) o verde
//
// Le regole stanno qui, pure: la stessa striscia deve significare la
// stessa cosa dovunque, e con la logica dentro le schermate finiva per
// divergere (è già successo col rosso che diceva due cose opposte).

export const MODI_STRISCIA = [
  {
    id: 'spenta',
    label: 'Spenta',
    desc: 'Sempre grigia: il colore del prodotto resta nella linguetta.',
  },
  {
    id: 'prodotto',
    label: 'Colore del prodotto',
    desc: 'Il suo colore; se non ne ha uno, quello della sua categoria.',
  },
  {
    id: 'categoria',
    label: 'Colore della categoria',
    desc: 'Sempre la categoria. Il colore del singolo prodotto lo dice la linguetta.',
  },
  {
    id: 'scorte',
    label: 'Scorte',
    desc: 'Rosso: ingrediente esaurito. Arancione: sta finendo.',
  },
]

export const MODO_STRISCIA_DEFAULT = 'prodotto'

const GRIGIO = 'var(--line)'
const ROSSO = '#e74c3c'
const ARANCIONE = '#f39c12'
const VERDE = '#2ecc71'

// Il colore della striscia, dato il modo e quello che si sa del prodotto.
//   modo         uno dei MODI_STRISCIA (un valore sconosciuto → grigio)
//   coloreProdotto / coloreCategoria: stringhe CSS o null
//   scorte       'empty' | 'low' | 'ok' | 'nascosto' (fuori menu)
//   verdeQuandoOk «c'è abbastanza» in verde invece che grigio
export function coloreStriscia({
  modo = MODO_STRISCIA_DEFAULT,
  coloreProdotto = null,
  coloreCategoria = null,
  scorte = null,
  verdeQuandoOk = false,
} = {}) {
  if (modo === 'spenta') return GRIGIO
  if (modo === 'prodotto') return coloreProdotto || coloreCategoria || GRIGIO
  if (modo === 'categoria') return coloreCategoria || GRIGIO
  if (modo === 'scorte') {
    if (scorte === 'empty') return ROSSO
    if (scorte === 'low') return ARANCIONE
    // Fuori menu è spento, non rotto: grigio, mai verde.
    if (scorte === 'nascosto') return GRIGIO
    return verdeQuandoOk ? VERDE : GRIGIO
  }
  return GRIGIO
}

// Serve caricare le scorte per disegnare la striscia? Le ricette e le
// giacenze non si leggono per niente: nella cassa si caricano solo se
// qualcuno le sta guardando.
export const striscaGuardaLeScorte = (modo) => modo === 'scorte'

// Lo stato scorte di un DRINK guardando i suoi ingredienti: il peggiore
// vince, perché è quello che impedisce di farlo. `statoDi` dice com'è messo
// un articolo di magazzino ('empty' | 'low' | 'ok').
export function scorteDelDrink(drink, perId, statoDi) {
  if (drink?.available === false) return 'nascosto'
  const ingredienti = (drink?.recipe_items || [])
    .map((r) => perId?.[r.inventory_item_id])
    .filter(Boolean)
  if (ingredienti.some((i) => statoDi(i) === 'empty')) return 'empty'
  if (ingredienti.some((i) => statoDi(i) === 'low')) return 'low'
  return 'ok'
}
