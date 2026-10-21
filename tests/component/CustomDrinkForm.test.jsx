// @vitest-environment happy-dom
'use strict'

// Test di COMPONENTE del "Prodotto libero": nome+prezzo bastano (nessuno
// scarico), ingredienti opzionali cercandoli per nome (niente tendina).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
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
    expect(await screen.findByRole('button', { name: /Salva nuova/ })).toBeInTheDocument()
  })

  // Creando un prodotto libero da zero non c'è ancora niente da salvare
  // altrove; e senza qualcuno che sappia dove portare, un tasto che non
  // porta da nessuna parte è peggio di uno assente.
  it('e non c’è creando un prodotto libero da zero', async () => {
    render(<CustomDrinkForm onCancel={vi.fn()} onAdd={vi.fn()} onSaveAsNew={vi.fn()} />)
    await screen.findByRole('button', { name: /Ingredienti/ })
    expect(screen.queryByRole('button', { name: /Salva nuova/ })).toBeNull()
  })

  // Senza qualcuno che sappia dove portare, un tasto che non porta da
  // nessuna parte è peggio di uno assente.
  it('né senza qualcuno che sappia dove portare', async () => {
    render(<CustomDrinkForm onCancel={vi.fn()} onAdd={vi.fn()} initial={INIZIALE} />)
    // In modifica gli ingredienti sono già aperti: si aspetta la riga della
    // ricetta, che compare quando il magazzino è arrivato.
    await screen.findByLabelText('Quantità Rum bianco')
    expect(screen.queryByRole('button', { name: /Salva nuova/ })).toBeNull()
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
    await user.click(screen.getByRole('button', { name: /Salva nuova/ }))
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
    await user.click(screen.getByRole('button', { name: /Salva nuova/ }))
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

// REQ-UI-028 (10/10/2026): «non aprire tastiera all'avvio di schermata
// ricetta». Su un tablet il cursore in una casella apre la tastiera, che
// copriva metà della ricetta da ritoccare.
describe('la tastiera all’apertura', () => {
  const RIGA = {
    name: 'Mojito',
    price: 8,
    recipe_items: [
      { inventory_item_id: 'rum', name: 'Rum bianco', unit: 'ml', qty: 40 },
      { inventory_item_id: 'menta', name: 'Menta', unit: 'pz', qty: 1 },
    ],
  }

  it('ritoccando una riga nessuna casella prende il cursore', async () => {
    render(<CustomDrinkForm onCancel={vi.fn()} onAdd={vi.fn()} initial={RIGA} />)
    await screen.findByLabelText('Quantità Menta')
    expect(document.activeElement?.tagName).not.toBe('INPUT')
  })

  // Un prodotto libero nuovo il nome lo deve scrivere comunque.
  it('per un prodotto libero nuovo il cursore va sul nome', async () => {
    mount()
    // Si lascia arrivare l'elenco del magazzino, che il form chiede aprendosi.
    await act(async () => {})
    expect(document.activeElement).toBe(screen.getByLabelText(/Nome/))
  })

  it('il cursore va sulla quantità dell’ingrediente appena aggiunto, non sulle altre', async () => {
    const user = userEvent.setup()
    render(<CustomDrinkForm onCancel={vi.fn()} onAdd={vi.fn()} initial={{ ...RIGA, recipe_items: [RIGA.recipe_items[1]] }} />)
    await user.type(await screen.findByPlaceholderText(/Cerca/), 'rum')
    await user.click(await screen.findByRole('button', { name: /Rum bianco/ }))
    expect(document.activeElement).toBe(screen.getByLabelText('Quantità Rum bianco'))
  })
})

// REQ-UI-028 / BUG-116: la scheda chiede 720px FISICI tramite `--larga`;
// la larghezza in px CSS sul tablet a zoom 0,7 rendeva 500.
describe('la finestra della ricetta', () => {
  it('è quella larga, da 720px veri', async () => {
    mount()
    await screen.findByRole('button', { name: /Ingredienti/ })
    const form = document.querySelector('form.confirm-box')
    expect(form).toHaveClass('larga')
    expect(form.style.getPropertyValue('--larga')).toBe('720px')
    expect(form.style.width).toBe('')
  })

  // Daniele, 21/10/2026: «il prezzo più in piccolo a destra del nome della
  // ricetta». Stessa riga, il prezzo nella sua casella stretta.
  it('nome e prezzo stanno sulla stessa riga, il prezzo a destra', async () => {
    mount()
    await screen.findByRole('button', { name: /Ingredienti/ })
    const riga = screen.getByLabelText('Nome *').closest('.cd-nome-prezzo')
    expect(riga).not.toBeNull()
    expect(riga.querySelector('.cd-prezzo input')).toBe(screen.getByLabelText('Prezzo (€) *'))
  })

  // «Il tasto salva nuova ricetta chiamalo solo salva nuova e mettila a
  // destra degli altri tasti quando la schermata è abbastanza larga»: il
  // tasto sta nello stesso gruppo degli altri, per ultimo; dove va a finire
  // lo decide il foglio di stile (tests/unit/css.test.js).
  it('«Salva nuova» è l’ultimo dei tre tasti, nello stesso gruppo', async () => {
    render(
      <CustomDrinkForm
        onCancel={vi.fn()}
        onAdd={vi.fn()}
        onSaveAsNew={vi.fn()}
        initial={{ name: 'Negroni', price: 8, recipe_items: [], note: '' }}
      />
    )
    const nuova = await screen.findByRole('button', { name: '✨ Salva nuova' })
    const gruppo = nuova.closest('.cd-azioni')
    const tasti = [...gruppo.querySelectorAll('button')].map((b) => b.textContent.trim())
    expect(tasti).toEqual(['Annulla', 'Salva 8,00\u00a0€', '✨ Salva nuova'])
  })
})
