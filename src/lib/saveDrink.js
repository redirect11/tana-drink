// Salvataggio di un prodotto del menù a partire dal form (DrinkForm): foto su
// Storage, righe ricetta → recipe_items in unità base, create/update.
// Condiviso fra il backoffice (MenuManager) e il POS (Organizza → menu
// prodotto), così la logica di salvataggio è una sola.
import { createDrink, updateDrink } from './api.js'
import { uploadDrinkImage, deleteDrinkImageByUrl } from './storage.js'
import { toBaseQty } from './inventory.js'

// Righe editabili → recipe_items persistiti (quantità convertite in unità base).
export function buildRecipeItems(rows, inventory) {
  return (rows || [])
    .filter((r) => r.inventory_item_id && Number(r.qty) > 0)
    .map((r) => {
      const inv = (inventory || []).find((i) => i.id === r.inventory_item_id)
      return {
        inventory_item_id: r.inventory_item_id,
        name: inv?.name ?? '',
        unit: inv?.unit ?? 'pz',
        qty: toBaseQty(r.qty, r.unit),
      }
    })
}

// `existing`: il prodotto in modifica (null per crearne uno nuovo).
export async function saveDrinkFromForm({ form, existing = null, inventory = [], categories = [] }) {
  let imageUrl = form.image_url ?? null
  const previousUrl = existing?.image_url ?? null
  if (form._file) imageUrl = await uploadDrinkImage(form._file)

  const catName = (categories || []).find((c) => c.id === form.category_id)?.name
  const payload = {
    // Guardie su null: mapDrink restituisce description/recipe = null, e senza
    // il fallback ''.trim() il salvataggio con campi vuoti crashava.
    name: (form.name || '').trim(),
    description: (form.description || '').trim() || null,
    category_id: form.category_id || null,
    category: catName || null, // denormalizzato per compat/fallback
    recipe: (form.recipe || '').trim() || null,
    recipe_items: buildRecipeItems(form.recipe_rows, inventory),
    price: Number(form.price || 0),
    available: !!form.available,
    image_url: imageUrl,
  }

  if (existing && existing.id) await updateDrink(existing.id, payload)
  else await createDrink(payload)

  if (previousUrl && previousUrl !== imageUrl) deleteDrinkImageByUrl(previousUrl)
  return payload
}
