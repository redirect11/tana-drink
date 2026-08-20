// @vitest-environment happy-dom
'use strict'

// Come si SALVA una riga di ricetta. Vive a parte perché saveDrink tira
// dentro Firebase (createDrink/updateDrink), che qui non serve.

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../src/lib/firebaseClient.js', () => ({ db: {}, auth: {}, functions: {}, storage: {} }))
vi.mock('../../src/lib/api.js', () => ({ createDrink: vi.fn(), updateDrink: vi.fn() }))
vi.mock('../../src/lib/storage.js', () => ({
  uploadDrinkImage: vi.fn(),
  deleteDrinkImageByUrl: vi.fn(),
}))

const { buildRecipeItems, aliquotaVendita, saveDrinkFromForm } = await import(
  '../../src/lib/saveDrink.js'
)
const { createDrink } = await import('../../src/lib/api.js')

// "4 cl di gin" su una bottiglia contata a PEZZI deve restare 40 ml, non
// diventare 40 pezzi: la riga di ricetta salva la base di quello che si è
// scritto, non l'unità con cui si conta la giacenza.
describe('salvataggio di una riga di ricetta', () => {
  const inventario = [
    { id: 'gin', name: 'Gin', unit: 'pz', package_size: 700, content_unit: 'ml' },
    { id: 'coca', name: 'Coca', unit: 'pz' },
    { id: 'sciroppo', name: 'Sciroppo', unit: 'ml', package_size: 700 },
  ]

  it('cl su un articolo a pezzo → millilitri', () => {
    const [r] = buildRecipeItems([{ inventory_item_id: 'gin', qty: '4', unit: 'cl' }], inventario)
    expect(r).toMatchObject({ inventory_item_id: 'gin', qty: 40, unit: 'ml' })
  })

  it('pezzi restano pezzi', () => {
    const [r] = buildRecipeItems([{ inventory_item_id: 'coca', qty: '1', unit: 'pz' }], inventario)
    expect(r).toMatchObject({ qty: 1, unit: 'pz' })
  })

  it('articolo a volume: come prima', () => {
    const [r] = buildRecipeItems([{ inventory_item_id: 'sciroppo', qty: '2', unit: 'cl' }], inventario)
    expect(r).toMatchObject({ qty: 20, unit: 'ml' })
  })
})


// ── L'IVA DI VENDITA DELLA SINGOLA VOCE (REQ-MENU-013) ───────────────
// Il campo si compila solo dove fa eccezione: vuoto vuol dire «usa quella
// del locale», e chi non ha eccezioni non deve scrivere niente.
describe('l’IVA di vendita scritta sulla scheda', () => {
  it('vuota vuol dire «quella del locale»', () => {
    expect(aliquotaVendita('')).toBeNull()
    expect(aliquotaVendita(null)).toBeNull()
    expect(aliquotaVendita(undefined)).toBeNull()
  })

  it('un numero si salva com’è, e lo zero è un’aliquota vera', () => {
    expect(aliquotaVendita('22')).toBe(22)
    expect(aliquotaVendita(4)).toBe(4)
    // Esente: se finisse in un falsy, quella voce si scorporerebbe al 10%.
    expect(aliquotaVendita('0')).toBe(0)
  })

  // Meglio ripiegare sull'aliquota del locale che salvare un NaN, che poi
  // scorpora male e non lo dice a nessuno.
  it('una scritta che non è un numero vale come vuoto', () => {
    expect(aliquotaVendita('boh')).toBeNull()
  })

  it('e finisce nel prodotto salvato', async () => {
    await saveDrinkFromForm({
      form: { name: 'Bottiglia di gin', price: '90', sale_vat: '22', recipe_rows: [] },
    })
    expect(createDrink.mock.calls[0][0]).toMatchObject({ sale_vat: 22 })

    await saveDrinkFromForm({
      form: { name: 'Negroni', price: '8', sale_vat: '', recipe_rows: [] },
    })
    expect(createDrink.mock.calls[1][0]).toMatchObject({ sale_vat: null })
  })
})
