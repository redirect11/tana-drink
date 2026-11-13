'use strict'

// ── LA VOCE NON DISPONIBILE NEL MENÙ DEI CLIENTI (REQ-MENU-017) ─────────
//
// Flavio, 22/10/2026: «se io finisco il gin mare … scompare direttamente dal
// menu». Daniele, 13/11/2026: al cliente non si dice MAI cosa manca; la voce
// sparisce o resta con «Non disponibile», lo sceglie il titolare, e la
// soglia è sua: ingrediente ESAURITO, oppure già IN ESAURIMENTO.
//
// Il cliente non legge il magazzino (le regole lo vietano): il segno sta
// sul prodotto della cassa, `non_disponibile_cliente`, e lo scrive questa
// Function. Vale solo per i prodotti che SEGUONO LE GIACENZE (opzione sul
// prodotto, spenta di partenza): lime, sciroppi e ghiaccio spesso non
// hanno una giacenza tenuta bene, e con una regola per tutti sparirebbero
// cocktail interi per un numero sbagliato.
//
// Logica pura: chi chiama legge e scrive.

const SOGLIE = ['esaurito', 'esaurimento']
const sogliaDi = (impostazioni) => (SOGLIE.includes(impostazioni?.menu_soglia_disponibilita) ? impostazioni.menu_soglia_disponibilita : 'esaurito')

// Le righe della ricetta che non contano: unità generiche (porzione,
// spruzzo…), la manodopera, il ghiaccio. Le stesse di ingredientiCarta.js
// nell'app.
const MANODOPERA = /lavorazione/i
const GHIACCIO = /^ghiaccio\b/i
// L'unità generica dell'app è «U» (src/lib/inventory.js, UNITA_GENERICA).
const rigaDiServizio = (r) =>
  String(r?.unit || '').toUpperCase() === 'U' || MANODOPERA.test(r?.name || '') || GHIACCIO.test(r?.name || '')

// Un prodotto di magazzino MANCA, per quella soglia? Esaurito: giacenza a
// zero o sotto. In esaurimento: anche sotto la scorta minima, se ce n'è una.
function manca(item, soglia) {
  if (!item) return false
  const stock = Number(item.stock) || 0
  if (stock <= 0) return true
  if (soglia !== 'esaurimento') return false
  const minima = Number(item.low_threshold) || 0
  return minima > 0 && stock <= minima
}

// Il prodotto della cassa è disponibile per il cliente? Solo se segue le
// giacenze conta; e allora manca se manca uno dei suoi ingredienti.
function nonDisponibile(drink, itemsById, impostazioni) {
  if (drink?.segue_giacenze !== true) return false
  const soglia = sogliaDi(impostazioni)
  return (drink.recipe_items || []).some((r) => !rigaDiServizio(r) && r.inventory_item_id && manca(itemsById.get(r.inventory_item_id), soglia))
}

// Il cambio di un prodotto di magazzino ha attraversato la soglia? Solo
// allora si guardano i prodotti della cassa: non a ogni vendita.
function haAttraversato(prima, dopo, impostazioni) {
  const soglia = sogliaDi(impostazioni)
  return manca(prima, soglia) !== manca(dopo, soglia)
}

// I prodotti della cassa da aggiornare, fra quelli dati: { id, valore }
// solo dove il segno cambia.
function cambiDiDisponibilita(drinks, itemsById, impostazioni) {
  const out = []
  for (const d of drinks || []) {
    const valore = nonDisponibile(d, itemsById, impostazioni)
    if ((d.non_disponibile_cliente === true) !== valore) out.push({ id: d.id, valore })
  }
  return out
}

const usaIlProdotto = (drink, itemId) => (drink?.recipe_items || []).some((r) => r.inventory_item_id === itemId)

module.exports = { manca, nonDisponibile, haAttraversato, cambiDiDisponibilita, usaIlProdotto, sogliaDi, rigaDiServizio }
