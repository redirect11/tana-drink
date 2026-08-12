// @vitest-environment happy-dom
'use strict'

// LA RICERCA NELLA GRIGLIA PRODOTTI, in creazione e modifica ordine.
// Filtrando, la griglia si svuota di tutto quello che non risponde: chi
// batte gli ordini conosce a memoria dove sta ogni card e se la ritrova
// diversa a ogni lettera. Da qui il secondo modo: la griglia non si tocca,
// si accende la prima card trovata e ce la si porta sotto gli occhi.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/lib/api.js', () => ({
  subscribePosPrefs: () => () => {},
  savePosOrder: vi.fn(() => Promise.resolve()),
  savePosFavorites: vi.fn(() => Promise.resolve()),
  savePosColors: vi.fn(() => Promise.resolve()),
  updateDrink: vi.fn(() => Promise.resolve()),
  createCategory: vi.fn(() => Promise.resolve({ id: 'c' })),
  fetchInventoryItems: vi.fn(() => Promise.resolve([])),
}))
vi.mock('../../src/components/DrinkForm.jsx', () => ({ default: () => <div>SCHEDA PRODOTTO</div> }))

import PosProductPicker from '../../src/components/PosProductPicker.jsx'

const drinks = [
  { id: '1', name: 'Gin Tonic', price: 7, available: true },
  { id: '2', name: 'Negroni', price: 8, available: true },
  { id: '3', name: 'Negroni Sbagliato', price: 8, available: true },
  { id: '4', name: 'Mojito', price: 7, available: true },
]
const cats = [{ id: 'c1', name: 'Cocktail' }]

function mostra(props = {}) {
  const onAdd = vi.fn()
  const utils = render(
    <PosProductPicker
      drinks={drinks}
      cats={cats}
      loading={false}
      qtyByDrink={{}}
      onAdd={onAdd}
      onSetQty={vi.fn()}
      {...props}
    />
  )
  // Le card sono i riquadri con l'identificativo del prodotto.
  const cards = () => [...utils.container.querySelectorAll('[data-drink-id]')]
  return { ...utils, onAdd, cards }
}

beforeEach(() => localStorage.clear())

describe('ricerca prodotti: filtra (come è sempre stato)', () => {
  it('restano solo le card che rispondono', async () => {
    const user = userEvent.setup()
    const { cards } = mostra()
    await user.type(screen.getByLabelText('Cerca prodotto'), 'negro')
    expect(cards().map((c) => c.dataset.drinkId)).toEqual(['2', '3'])
  })

  it('nessuna card accesa: qui a trovarle ci pensa il vuoto intorno', async () => {
    const user = userEvent.setup()
    const { container } = mostra()
    await user.type(screen.getByLabelText('Cerca prodotto'), 'negro')
    expect(container.querySelector('.prodotto-acceso')).toBeNull()
  })
})

describe('ricerca prodotti: accendi e porta lì', () => {
  it('la griglia non perde nemmeno una card e si accende la PRIMA che risponde', async () => {
    const user = userEvent.setup()
    const { cards, container } = mostra({ ricercaEvidenzia: true })
    await user.type(screen.getByLabelText('Cerca prodotto'), 'negro')
    expect(cards()).toHaveLength(4)
    // "Negroni" prima di "Negroni Sbagliato": conta l'ordine della griglia.
    expect(container.querySelectorAll('.prodotto-acceso')).toHaveLength(1)
    expect(container.querySelector('.prodotto-acceso').dataset.drinkId).toBe('2')
  })

  it('toccando una card la ricerca si azzera', async () => {
    const user = userEvent.setup()
    const { onAdd, container } = mostra({ ricercaEvidenzia: true })
    const ricerca = screen.getByLabelText('Cerca prodotto')
    await user.type(ricerca, 'negro')
    await user.click(screen.getByText('Mojito'))
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: '4' }))
    expect(ricerca).toHaveValue('')
    expect(container.querySelector('.prodotto-acceso')).toBeNull()
  })

  it('se non c è niente da accendere lo dice: la griglia da sola non lo direbbe', async () => {
    const user = userEvent.setup()
    const { cards } = mostra({ ricercaEvidenzia: true })
    await user.type(screen.getByLabelText('Cerca prodotto'), 'zzz')
    expect(cards()).toHaveLength(4) // niente è sparito…
    expect(screen.getByText(/Nessun prodotto per/)).toBeInTheDocument() // …quindi si scrive
  })
})
