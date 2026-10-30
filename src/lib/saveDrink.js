// Salvataggio di un prodotto del menù a partire dal form (DrinkForm): foto su
// Storage, righe ricetta → recipe_items in unità base, create/update.
// Condiviso fra il backoffice (MenuManager) e il POS (Organizza → menu
// prodotto), così la logica di salvataggio è una sola.
import { sceltaIllustrazione } from './illustrazioneDrink.js'
import { createDrink, updateDrink } from './api.js'
import { uploadDrinkImage, deleteDrinkImageByUrl } from './storage.js'
import { toBaseQty, baseUnit } from './inventory.js'
import { puoCreareProdotto, maxProdotti, MESSAGGI_PIANO, profiloLeggero } from './limiti.js'

// Righe editabili → recipe_items persistiti (quantità convertite in unità base).
export function buildRecipeItems(rows, inventory) {
  return (rows || [])
    .filter((r) => r.inventory_item_id && Number(r.qty) > 0)
    .map((r) => {
      const inv = (inventory || []).find((i) => i.id === r.inventory_item_id)
      return {
        inventory_item_id: r.inventory_item_id,
        // Se l'inventario non è (ancora) caricato — es. salvataggio dal POS con
        // la lettura fallita — si TENGONO nome e unità già sulla riga: senza
        // questo la ricetta veniva riscritta con nome vuoto e unità "pz".
        name: inv?.name ?? r.name ?? '',
        // L'unità della riga è la BASE DI QUELLO CHE SI È SCRITTO, non
        // l'unità dell'articolo. Su un articolo contato a pezzo si dosa in
        // cl: scrivendo "4 cl" si salvava `40 pz`, cioè quaranta bottiglie
        // per un cocktail. Ora si salva `40 ml` e a convertire in frazione
        // di bottiglia ci pensa lo scarico (qtyInStockUnit).
        unit: r.unit ? baseUnit(r.unit) : (inv?.unit ?? r.invUnit ?? r.baseUnit ?? 'pz'),
        qty: toBaseQty(r.qty, r.unit),
      }
    })
}

// L'IVA di vendita scritta a mano → numero, oppure null («usa quella del
// locale»). Una scritta che non è un numero vale come vuoto: meglio
// ripiegare sull'aliquota del locale che salvare un NaN, che poi scorpora
// male e non lo dice a nessuno.
export function aliquotaVendita(valore) {
  if (valore === '' || valore == null) return null
  const n = Number(valore)
  return Number.isFinite(n) ? n : null
}

// `existing`: il prodotto in modifica (null per crearne uno nuovo).
// `impostazioni` e `prodotti` (quelli già in carta): servono ai limiti del
// piano (REQ-LIC-003). Senza limiti nella licenza non cambiano niente, e chi
// non li passa salva come sempre. Il controllo sta QUI, dove si salva, e non
// solo sul tasto: un prodotto nuovo nasce anche dal POS e da una copia.
export async function saveDrinkFromForm({
  form,
  existing = null,
  inventory = [],
  categories = [],
  impostazioni = null,
  prodotti = null,
}) {
  const nuovo = !(existing && existing.id)
  if (nuovo && prodotti && !puoCreareProdotto(impostazioni, prodotti.length)) {
    throw new Error(MESSAGGI_PIANO.prodotti(maxProdotti(impostazioni)))
  }
  let imageUrl = form.image_url ?? null
  const previousUrl = existing?.image_url ?? null
  // Sul profilo leggero Storage non c'è: la foto scelta non si carica (il
  // tasto è già nascosto, questa è la cintura).
  if (form._file && !profiloLeggero(impostazioni)) imageUrl = await uploadDrinkImage(form._file)

  const catName = (categories || []).find((c) => c.id === form.category_id)?.name
  const payload = {
    // Guardie su null: mapDrink restituisce description/recipe = null, e senza
    // il fallback ''.trim() il salvataggio con campi vuoti crashava.
    name: (form.name || '').trim(),
    description: (form.description || '').trim() || null,
    ingredienti: (form.ingredienti || '').trim() || null,
    category_id: form.category_id || null,
    category: catName || null, // denormalizzato per compat/fallback
    recipe: (form.recipe || '').trim() || null,
    recipe_items: buildRecipeItems(form.recipe_rows, inventory),
    price: Number(form.price || 0),
    // VUOTO = QUELLA DEL LOCALE. Le eccezioni si scrivono dove sono, una
    // per una, e chi non ne ha non compila niente. Uno zero invece è
    // un'aliquota vera (esente): va salvato, non scambiato per «vuoto».
    sale_vat: aliquotaVendita(form.sale_vat),
    available: !!form.available,
    image_url: imageUrl,
    speciale: !!form.speciale,
    // Il disegno composto, pulito; un id di testo è uno della prima
    // versione e resta com'è finché non lo si cambia.
    illustrazione:
      typeof form.illustrazione === 'string' ? form.illustrazione : sceltaIllustrazione(form.illustrazione),
  }

  if (!nuovo) await updateDrink(existing.id, payload)
  else await createDrink(payload)

  if (previousUrl && previousUrl !== imageUrl) deleteDrinkImageByUrl(previousUrl)
  return payload
}
