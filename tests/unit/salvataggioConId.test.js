// @vitest-environment happy-dom
'use strict'

// IL SALVATAGGIO DI UN PRODOTTO DICE CHE ID HA (REQ-MENU-036). Un prodotto
// creato da una sezione del menù dei clienti entra subito come voce di quella
// sezione: per collegarla serve l'id del prodotto appena nato, e cercarlo
// per nome fra centinaia di prodotti (con doppioni possibili) sarebbe
// tirare a indovinare.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/lib/firebaseClient.js', () => ({ db: {}, auth: {}, functions: {}, storage: {} }))
vi.mock('../../src/lib/api.js', () => ({
  createDrink: vi.fn((d) => Promise.resolve({ id: 'nato-ora', ...d })),
  updateDrink: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../src/lib/storage.js', () => ({ uploadDrinkImage: vi.fn(), deleteDrinkImageByUrl: vi.fn() }))

const { saveDrinkFromForm } = await import('../../src/lib/saveDrink.js')
const { createDrink } = await import('../../src/lib/api.js')

const form = { name: 'Paloma', price: '9', available: true }

beforeEach(() => vi.clearAllMocks())

describe('il salvataggio torna con l’id del prodotto', () => {
  it('un prodotto nuovo: quello appena creato', async () => {
    const salvato = await saveDrinkFromForm({ form })
    expect(salvato).toMatchObject({ id: 'nato-ora', name: 'Paloma', price: 9 })
  })

  it('un prodotto modificato: il suo', async () => {
    const salvato = await saveDrinkFromForm({ form, existing: { id: 'paloma-1', name: 'Paloma' } })
    expect(salvato.id).toBe('paloma-1')
  })

  it('una creazione che non torna niente non inventa un id', async () => {
    createDrink.mockResolvedValueOnce(undefined)
    expect((await saveDrinkFromForm({ form })).id).toBeNull()
  })
})
