// @vitest-environment happy-dom
'use strict'

// IL MENÙ DEL PIANO FREE HA AL MASSIMO `prodotti_max` PRODOTTI (REQ-LIC-003).
// Il controllo sta nel salvataggio (saveDrinkFromForm), dove passano tutte
// le strade da cui nasce un prodotto: il gestionale, la copia di un drink,
// la ricetta nuova battuta dal conto. Quelli che ci sono restano e si
// modificano; non se ne aggiungono. Senza limiti si salva come sempre.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/lib/firebaseClient.js', () => ({ db: {}, auth: {}, functions: {}, storage: {} }))
vi.mock('../../src/lib/api.js', () => ({ createDrink: vi.fn(), updateDrink: vi.fn() }))
vi.mock('../../src/lib/storage.js', () => ({
  uploadDrinkImage: vi.fn(() => Promise.resolve('https://bucket.example/f.jpg')),
  deleteDrinkImageByUrl: vi.fn(),
}))

const { saveDrinkFromForm } = await import('../../src/lib/saveDrink.js')
const { createDrink, updateDrink } = await import('../../src/lib/api.js')
const { uploadDrinkImage } = await import('../../src/lib/storage.js')

const FREE = { licenza: { piano: 'free', limiti: { prodotti_max: 10 } } }
const dieci = Array.from({ length: 10 }, (_, i) => ({ id: `d${i}`, name: `Drink ${i}` }))
const form = { name: 'Spritz', price: '6', available: true }

beforeEach(() => vi.clearAllMocks())

describe('il limite dei prodotti', () => {
  it('col menù pieno un prodotto nuovo non nasce, e il motivo si legge', async () => {
    await expect(saveDrinkFromForm({ form, impostazioni: FREE, prodotti: dieci })).rejects.toThrow(
      'Nel piano Free il menù ha al massimo 10 prodotti. Per aggiungerne passa a un piano a pagamento.'
    )
    expect(createDrink).not.toHaveBeenCalled()
  })

  it('sotto il limite si crea', async () => {
    await saveDrinkFromForm({ form, impostazioni: FREE, prodotti: dieci.slice(0, 9) })
    expect(createDrink).toHaveBeenCalledTimes(1)
  })

  it('quelli che ci sono si modificano anche col menù pieno', async () => {
    await saveDrinkFromForm({ form, existing: dieci[3], impostazioni: FREE, prodotti: dieci })
    expect(updateDrink).toHaveBeenCalledWith('d3', expect.objectContaining({ name: 'Spritz' }))
  })

  it('senza limiti nella licenza si crea come sempre, anche con cento prodotti', async () => {
    const cento = Array.from({ length: 100 }, (_, i) => ({ id: `x${i}` }))
    await saveDrinkFromForm({ form, impostazioni: {}, prodotti: cento })
    await saveDrinkFromForm({ form, impostazioni: { licenza: { piano: 'pro', limiti: null } }, prodotti: cento })
    // Chi non passa né impostazioni né prodotti salva come prima.
    await saveDrinkFromForm({ form })
    expect(createDrink).toHaveBeenCalledTimes(3)
  })

  it('sul profilo leggero la foto scelta non va su Storage', async () => {
    await saveDrinkFromForm({ form: { ...form, _file: {} }, impostazioni: FREE, prodotti: [] })
    expect(uploadDrinkImage).not.toHaveBeenCalled()
    await saveDrinkFromForm({ form: { ...form, _file: {} }, impostazioni: {}, prodotti: [] })
    expect(uploadDrinkImage).toHaveBeenCalledTimes(1)
  })
})
