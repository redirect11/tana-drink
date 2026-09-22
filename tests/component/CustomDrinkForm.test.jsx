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

// ── LA RICETTA RITOCCATA DIVENTA UNA VOCE DEL MENÙ (REQ-MENU-016) ────
//
// Daniele, 18/09/2026: «quando modifico una ricetta, un tasto "salva come
// nuova" deve apparire … mi si apre la schermata di creazione nuova ricetta
// già popolata con le modifiche fatte al drink che ho appena modificato».
//
// QUELLO CHE PASSA SONO LE MODIFICHE, non i valori di partenza: se si passa
// `initial` il prodotto nuovo nascerebbe uguale a quello di catalogo, cioè
// senza il ritocco che è la ragione per cui lo si sta salvando.
describe('salva come nuova ricetta', () => {
  const INIZIALE = {
    name: 'Negroni',
    price: 8,
    recipe_items: [{ inventory_item_id: 'rum', name: 'Rum bianco', unit: 'ml', qty: 40 }],
    note: '',
  }

  it('il tasto c’è solo modificando una ricetta', async () => {
    render(<CustomDrinkForm onCancel={vi.fn()} onAdd={vi.fn()} initial={INIZIALE} onSaveAsNew={vi.fn()} />)
    expect(await screen.findByRole('button', { name: /Salva come nuova ricetta/ })).toBeInTheDocument()
  })

  // Creando un prodotto libero da zero non c'è ancora niente da salvare
  // altrove; e senza qualcuno che sappia dove portare, un tasto che non
  // porta da nessuna parte è peggio di uno assente.
  it('e non c’è creando un prodotto libero da zero', async () => {
    render(<CustomDrinkForm onCancel={vi.fn()} onAdd={vi.fn()} onSaveAsNew={vi.fn()} />)
    await screen.findByRole('button', { name: /Ingredienti/ })
    expect(screen.queryByRole('button', { name: /Salva come nuova ricetta/ })).toBeNull()
  })

  // Senza qualcuno che sappia dove portare, un tasto che non porta da
  // nessuna parte è peggio di uno assente.
  it('né senza qualcuno che sappia dove portare', async () => {
    render(<CustomDrinkForm onCancel={vi.fn()} onAdd={vi.fn()} initial={INIZIALE} />)
    // In modifica gli ingredienti sono già aperti: si aspetta la riga della
    // ricetta, che compare quando il magazzino è arrivato.
    await screen.findByLabelText('Quantità Rum bianco')
    expect(screen.queryByRole('button', { name: /Salva come nuova ricetta/ })).toBeNull()
  })

  it('porta con sé le modifiche appena fatte, non il drink di partenza', async () => {
    const user = userEvent.setup()
    const onSaveAsNew = vi.fn()
    render(
      <CustomDrinkForm onCancel={vi.fn()} onAdd={vi.fn()} initial={INIZIALE} onSaveAsNew={onSaveAsNew} />
    )
    const nome = screen.getByLabelText('Nome *')
    await user.clear(nome)
    await user.type(nome, 'Negroni sbagliato')
    const prezzo = screen.getByLabelText('Prezzo (€) *')
    await user.clear(prezzo)
    await user.type(prezzo, '9')
    await user.click(screen.getByRole('button', { name: /Salva come nuova ricetta/ }))
    expect(onSaveAsNew).toHaveBeenCalledWith({
      name: 'Negroni sbagliato',
      price: 9,
      recipe_items: [{ inventory_item_id: 'rum', name: 'Rum bianco', unit: 'ml', qty: 40 }],
      note: null,
    })
  })

  // Il tasto manda ALTROVE: la riga del conto non si tocca, se no si
  // ritroverebbe modificata senza averlo chiesto.
  it('e non salva niente sulla riga del conto', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(
      <CustomDrinkForm onCancel={vi.fn()} onAdd={onAdd} initial={INIZIALE} onSaveAsNew={vi.fn()} />
    )
    await user.click(screen.getByRole('button', { name: /Salva come nuova ricetta/ }))
    expect(onAdd).not.toHaveBeenCalled()
  })
})

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
