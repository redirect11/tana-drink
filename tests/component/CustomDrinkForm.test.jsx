// @vitest-environment happy-dom
'use strict'

// Test di COMPONENTE del "Prodotto libero": nome+prezzo bastano (nessuno
// scarico), ingredienti opzionali cercandoli per nome (niente tendina).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/lib/api.js', () => ({
  fetchInventoryItems: vi.fn(() =>
    Promise.resolve([
      // Rum: bottiglia da 70 cl a 9,00 € + IVA → costo al cl noto.
      { id: 'rum', name: 'Rum bianco', unit: 'ml', package_size: 700, cost: 9, vat: 22 },
      { id: 'menta', name: 'Menta', unit: 'pz' },
    ])
  ),
  DEFAULT_SETTINGS: { price_markup: 3, price_round_step: 0.5 },
  settingsIniziali: () => ({ price_markup: 3, price_round_step: 0.5 }),
  subscribeSettings: vi.fn((cb) => {
    cb({ price_markup: 3, price_round_step: 0.5 })
    return () => {}
  }),
}))

import CustomDrinkForm from '../../src/components/CustomDrinkForm.jsx'
import { toBaseQty } from '../../src/lib/inventory.js'

function mount(onAdd = vi.fn()) {
  render(<CustomDrinkForm onCancel={vi.fn()} onAdd={onAdd} />)
  return onAdd
}

beforeEach(() => vi.clearAllMocks())

describe('prodotto libero', () => {
  it('bastano nome e prezzo: nessun ingrediente, nessuno scarico', async () => {
    const user = userEvent.setup()
    const onAdd = mount()
    await user.type(screen.getByLabelText('Nome *'), 'Consumazione')
    await user.type(screen.getByLabelText('Prezzo (€) *'), '10')
    await user.click(screen.getByRole('button', { name: /Aggiungi/ }))
    expect(onAdd).toHaveBeenCalledWith({
      name: 'Consumazione',
      price: 10,
      recipe_items: [],
      note: null, // nessuna nota di riga inserita
    })
  })

  it('gli ingredienti si cercano per nome e si aggiungono al tocco', async () => {
    const user = userEvent.setup()
    const onAdd = mount()
    await user.type(screen.getByLabelText('Nome *'), 'Mojito special')
    await user.type(screen.getByLabelText('Prezzo (€) *'), '9')
    await user.click(await screen.findByRole('button', { name: /Ingredienti/ }))
    // niente tendina: ricerca + chip
    await user.type(screen.getByLabelText('Ingredienti'), 'rum')
    await user.click(screen.getByRole('button', { name: '+ Rum bianco' }))
    await user.type(screen.getByLabelText('Quantità Rum bianco'), '5')
    await user.click(screen.getByRole('button', { name: /Aggiungi/ }))
    const arg = onAdd.mock.calls[0][0]
    expect(arg.recipe_items).toEqual([
      {
        inventory_item_id: 'rum',
        name: 'Rum bianco',
        unit: 'ml', // unità BASE dell'articolo (si inserisce in cl)
        qty: toBaseQty(5, 'cl'),
      },
    ])
  })
})
