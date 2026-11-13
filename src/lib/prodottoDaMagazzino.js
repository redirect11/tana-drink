// ── IL PRODOTTO DELLA CASSA DA UNA BOTTIGLIA DEL MAGAZZINO (REQ-AI-002) ──
//
// Flavio, 22/10/2026: comprato un gin nuovo, «in automatico mi dovrebbe
// creare tutto». Dalla scheda del prodotto di magazzino, «Crea il prodotto
// della cassa» apre la scheda di un prodotto della cassa nuovo, già
// collegata a quella bottiglia: nome, categoria della cassa con lo stesso
// nome di quella di magazzino (un gin va in «Gin»), ricetta con la riga di
// quel prodotto. La QUANTITÀ della riga resta vuota e la scrive chi crea
// (Daniele, 13/11/2026: «non c'è una dose fissa»): 4 cl fa il bicchiere,
// 70 cl la bottiglia intera, 1 pezzo la birra. La descrizione la propone
// l'AI all'apertura, dove c'è.
//
// La scheda passa dal magazzino al Menù in memoria, una volta sola: il
// Menù la prende all'apertura (prendiProdottoInArrivo) e la apre come una
// scheda nuova, come il «duplica».

const normale = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export function prodottoDaMagazzino(item, { categorieMagazzino = [], categorieCassa = [], prezzo = null } = {}) {
  const nomeCategoria = categorieMagazzino.find((c) => c.id === item?.category_id)?.name
  const categoria = nomeCategoria ? categorieCassa.find((c) => normale(c.name) === normale(nomeCategoria)) : null
  return {
    name: item?.name ?? '',
    category_id: categoria?.id ?? '',
    price: prezzo != null && Number.isFinite(Number(prezzo)) ? Number(prezzo) : '',
    description: '',
    available: true,
    image_url: null,
    recipe_items: [{ inventory_item_id: item?.id ?? '', qty: '', unit: item?.unit ?? 'pz', name: item?.name ?? '' }],
    // Solo per la scheda: la descrizione AI parte all'apertura. Non si salva
    // (saveDrink scrive i suoi campi, uno per uno).
    da_magazzino: true,
  }
}

let _inArrivo = null
const _ascolto = new Set()
// Chi la manda (la scheda di magazzino, la chat) e chi la apre (il Menù):
// se il Menù è già aperto non si rimonta, e la sente arrivare da qui.
export const mettiProdottoInArrivo = (prodotto) => {
  _inArrivo = prodotto
  for (const f of _ascolto) f()
}
export function ascoltaProdottoInArrivo(f) {
  _ascolto.add(f)
  return () => _ascolto.delete(f)
}
export const prendiProdottoInArrivo = () => {
  const p = _inArrivo
  _inArrivo = null
  return p
}
