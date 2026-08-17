// @vitest-environment happy-dom
'use strict'

// DUPLICARE UN DRINK. Mezzo listino sono variazioni: lo stesso drink col
// gin diverso, la versione analcolica, il formato grande. Rifarli a mano
// vuol dire riscrivere la RICETTA ingrediente per ingrediente, ed è lì che
// si sbaglia una dose e poi il magazzino scala storto.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const DRINKS = [
  {
    id: 'mojito',
    name: 'Mojito',
    price: 7,
    description: 'Rum, lime, menta',
    recipe: 'Pesta la menta, poi allunga con soda.',
    available: true,
    category_id: 'c1',
    image_url: 'https://esempio/mojito.jpg',
    recipe_items: [{ inventory_item_id: 'i1', name: 'Rum', qty: 50, unit: 'ml' }],
  },
]
const CATEGORIE = [{ id: 'c1', name: 'Cocktail', sort_order: 0 }]
const MAGAZZINO = [{ id: 'i1', name: 'Rum', unit: 'ml', qty: 3000, cost: 20, package_qty: 700 }]

vi.mock('../../src/lib/api.js', () => ({
  fetchDrinks: vi.fn(() => Promise.resolve(DRINKS)),
  updateDrink: vi.fn(() => Promise.resolve()),
  deleteDrink: vi.fn(() => Promise.resolve()),
  fetchCategories: vi.fn(() => Promise.resolve(CATEGORIE)),
  createCategory: vi.fn(() => Promise.resolve({ id: 'c2', name: 'Nuova' })),
  updateCategory: vi.fn(() => Promise.resolve()),
  deleteCategory: vi.fn(() => Promise.resolve()),
  fetchInventoryItems: vi.fn(() => Promise.resolve(MAGAZZINO)),
  subscribePosPrefs: vi.fn(() => () => {}),
  savePosColors: vi.fn(() => Promise.resolve()),
  subscribeSettings: vi.fn(() => () => {}),
  fetchMacroCategories: vi.fn((ambito) =>
    Promise.resolve(ambito === 'menu' ? [{ id: 'm1', name: 'Cocktail', sort_order: 0 }] : [])
  ),
  createMacroCategory: vi.fn(() => Promise.resolve({ id: 'm2', name: 'Nuova' })),
  updateMacroCategory: vi.fn(() => Promise.resolve()),
  deleteMacroCategory: vi.fn(() => Promise.resolve()),
  DEFAULT_SETTINGS: { stripe_menu: 'scorte' },
  settingsIniziali: () => ({ stripe_menu: 'scorte' }),
}))
vi.mock('../../src/lib/storage.js', () => ({
  deleteDrinkImageByUrl: vi.fn(() => Promise.resolve()),
  uploadDrinkImage: vi.fn(() => Promise.resolve('https://esempio/nuova.jpg')),
}))

const salvaDrink = vi.fn(() => Promise.resolve())
vi.mock('../../src/lib/saveDrink.js', () => ({
  saveDrinkFromForm: (...a) => salvaDrink(...a),
}))

import MenuManager from '../../src/components/MenuManager.jsx'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

// Apre le azioni della card del Mojito e restituisce il riquadro.
async function azioniMojito(user) {
  const card = (await screen.findByText('Mojito')).closest('.menu-card')
  await user.click(within(card).getByRole('button', { name: /Azioni/ }))
  return within(card)
}

describe('duplicare un drink dalle azioni della card', () => {
  it('apre la scheda già piena, col nome marcato come copia', async () => {
    const user = userEvent.setup()
    render(<MenuManager />)
    const card = await azioniMojito(user)
    await user.click(card.getByRole('button', { name: /Duplica/ }))

    expect(await screen.findByLabelText('Nome *')).toHaveValue('Mojito (copia)')
    expect(screen.getByLabelText(/Prezzo/)).toHaveValue(7)
    // LA RICETTA VIENE DIETRO: è la parte lunga, ed è il motivo per cui si
    // duplica invece di rifare da capo.
    expect(screen.getByText('Rum')).toBeInTheDocument()
  })

  it('salvando NASCE un drink nuovo: l’originale non si tocca', async () => {
    const user = userEvent.setup()
    render(<MenuManager />)
    const card = await azioniMojito(user)
    await user.click(card.getByRole('button', { name: /Duplica/ }))
    await screen.findByLabelText('Nome *')
    await user.click(screen.getByRole('button', { name: /^Salva/ }))

    await waitFor(() => expect(salvaDrink).toHaveBeenCalled())
    const arg = salvaDrink.mock.calls[0][0]
    expect(arg.existing).toBe(null) // nuovo, non una modifica del Mojito
    expect(arg.form.name).toBe('Mojito (copia)')
  })

  it('la copia non si porta dietro la foto dell’originale', async () => {
    // Il file è agganciato al drink che l'ha caricato: cancellando
    // l'originale sparirebbe anche dalla copia, che resterebbe con un
    // riquadro rotto in carta.
    const user = userEvent.setup()
    render(<MenuManager />)
    const card = await azioniMojito(user)
    await user.click(card.getByRole('button', { name: /Duplica/ }))
    await screen.findByLabelText('Nome *')
    await user.click(screen.getByRole('button', { name: /^Salva/ }))

    await waitFor(() => expect(salvaDrink).toHaveBeenCalled())
    expect(salvaDrink.mock.calls[0][0].form.image_url).toBe(null)
  })

  it('«Aggiungi prodotto» dopo una duplica parte da vuoto', async () => {
    const user = userEvent.setup()
    render(<MenuManager />)
    const card = await azioniMojito(user)
    await user.click(card.getByRole('button', { name: /Duplica/ }))
    await screen.findByLabelText('Nome *')
    await user.click(screen.getByRole('button', { name: /Annulla/ }))
    await user.click(await screen.findByRole('button', { name: /Aggiungi prodotto/ }))
    expect(await screen.findByLabelText('Nome *')).toHaveValue('')
  })
})
