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

const { buildRecipeItems } = await import('../../src/lib/saveDrink.js')

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
