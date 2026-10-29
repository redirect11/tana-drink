import { formatQty, unitaGenerica } from './inventory.js'

// GLI INGREDIENTI CHE LEGGE IL CLIENTE (REQ-MENU-019), nel menù, nel menù
// Special e nel carosello. L'utente, 29/10/2026: «negli special devono
// uscire anche gli ingredienti del drink, e anche nel menu».
//
// Due fonti, in quest'ordine:
//
// 1. IL CAMPO «Ingredienti in carta» della scheda, scritto dal gestore: è
//    quello che si legge, così com'è, separato da virgole. Serve dove la
//    ricetta non c'è (i Signature sul test non ne hanno nessuna) e dove
//    quella di magazzino non è roba da carta.
// 2. Altrimenti LA RICETTA, ripulita. La ricetta elenca articoli di
//    magazzino, e stampata com'era diceva al cliente «Ghiaccio Hoshizaki ·
//    Tempo di Lavorazione» o «Lime Succo Homemade 1kg - 50cl». Restano fuori
//    la manodopera (in U, o col nome, perché nelle ricette vecchie è ancora
//    in grammi: REQ-MAG-012) e il ghiaccio, che c'è in quasi tutto e non è
//    un ingrediente da menù; dal nome si toglie il formato della confezione.
//    Da due ingredienti in su, come prima: con uno solo la lista ripete il
//    nome del drink.
//
// Un ingrediente sbagliato in carta è un allergene sbagliato: qui non si
// inventa niente, si riporta quello che c'è scritto.

const MANODOPERA = /lavorazione/i
const GHIACCIO = /^ghiaccio\b/i
// « 1kg - 50cl», « 18cl», « 70 cl», « 0,7l» in fondo al nome: il formato
// della confezione, che serve all'ordine al fornitore e non a chi beve.
const FORMATO = /\s+\d+(?:[.,]\d+)?\s*(?:ml|cl|dl|l|lt|kg|gr|g|pz)\b.*$/i

export function nomeInCarta(nome) {
  return String(nome || '').replace(FORMATO, '').trim()
}

export function ingredientiDalCampo(testo) {
  return String(testo || '')
    .split(/[,·\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// L'elenco da mostrare (stringhe), o null se non c'è niente da dire.
export function ingredientiInCarta(drink, { quantita = false } = {}) {
  const scritti = ingredientiDalCampo(drink?.ingredienti)
  if (scritti.length) return scritti
  const visti = new Set()
  const righe = []
  for (const r of drink?.recipe_items || []) {
    if (unitaGenerica(r.unit) || MANODOPERA.test(r.name || '') || GHIACCIO.test(r.name || '')) continue
    const nome = nomeInCarta(r.name)
    if (!nome || visti.has(nome.toLowerCase())) continue
    visti.add(nome.toLowerCase())
    righe.push(quantita ? `${nome} ${formatQty(r.qty, r.unit)}` : nome)
  }
  return righe.length > 1 ? righe : null
}
