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

// LE ALTERNATIVE DEL CLIENTE (REQ-MENU-042): i prodotti di magazzino che il
// cliente può scegliere dal menù hanno un documento pubblico
// `alternative_cliente/{id}` con solo `disponibile`: fra le scelte compare
// chi ha giacenza (la stessa soglia delle voci), e del magazzino al
// telefono non arriva altro. Senza la spunta, il documento non c'è.
// Torna { scrivi: { disponibile } } | { cancella: true } | null (niente).
//
// Si riscrive anche quando si salva la scheda del prodotto, non solo quando
// la spunta cambia: i prodotti spuntati PRIMA di questa Function non hanno
// il documento, e senza al telefono non compaiono mai. Non a ogni vendita,
// però: un cambio della sola giacenza che non attraversa la soglia non
// scrive niente.
const CAMPI_DELLA_GIACENZA = new Set(['stock', 'updated_at'])
function soloGiacenza(prima, dopo) {
  const campi = new Set([...Object.keys(prima || {}), ...Object.keys(dopo || {})])
  for (const c of campi) {
    if (CAMPI_DELLA_GIACENZA.has(c)) continue
    if (JSON.stringify(prima?.[c]) !== JSON.stringify(dopo?.[c])) return false
  }
  return true
}

function alternativaDopo(prima, dopo, impostazioni) {
  const soglia = sogliaDi(impostazioni)
  const era = prima?.scelta_cliente === true
  const e = dopo?.scelta_cliente === true
  if (!e) return era ? { cancella: true } : null
  if (era && soloGiacenza(prima, dopo) && manca(prima, soglia) === manca(dopo, soglia)) return null
  return { scrivi: { disponibile: !manca(dopo, soglia) } }
}

// ── LE RIGHE CHE LA SCELTA SOSTITUISCE SEGUONO LA RICETTA (REQ-MENU-042) ─
//
// La scelta del cliente ricorda quali righe della ricetta prende il posto
// (`scelta.sostituisce`): le scrive l'editor, che legge il magazzino. Se
// poi la ricetta cambia — il Bombay diventa Tanqueray — la scelta restava
// sul Bombay: il cliente pagava il supplemento del Mare, e il magazzino
// scalava il Tanqueray. Quando la ricetta di un prodotto cambia, le voci
// del menù collegate si riallineano qui. Stessa regola dell'editor
// (src/lib/etichetteIngredienti.js, righeSostituite).
// `categoriaDi`: Map id del prodotto di magazzino → categoria.
function righeDellEtichetta(e, ricetta, categoriaDi) {
  const ids = (ricetta || []).map((r) => r?.inventory_item_id).filter(Boolean)
  if (e?.tipo === 'prodotto') return ids.includes(e.id) ? [e.id] : []
  if (e?.tipo !== 'categoria') return []
  return [...new Set(ids.filter((id) => categoriaDi.get(id) === e.id))]
}

// Le etichette con le righe riallineate, o null se non cambia niente.
function scelteRiallineate(etichette, ricetta, categoriaDi) {
  let cambiato = false
  const nuove = (etichette || []).map((e) => {
    if (!e?.scelta) return e
    const s = righeDellEtichetta(e, ricetta, categoriaDi)
    if (JSON.stringify(s) === JSON.stringify(e.scelta.sostituisce || [])) return e
    cambiato = true
    return { ...e, scelta: { ...e.scelta, sostituisce: s } }
  })
  return cambiato ? nuove : null
}

module.exports = {
  manca,
  nonDisponibile,
  haAttraversato,
  cambiDiDisponibilita,
  usaIlProdotto,
  sogliaDi,
  rigaDiServizio,
  alternativaDopo,
  righeDellEtichetta,
  scelteRiallineate,
}
