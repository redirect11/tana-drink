// @vitest-environment happy-dom
'use strict'

// Test di COMPONENTE della cassa (PosPage): il layout deve essere IDENTICO
// al dettaglio ordine — categorie a sinistra, griglia al centro e i prodotti
// dell'ordine sulla DESTRA, con la stessa struttura del pannello.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/lib/api.js', () => ({
  subscribeOpenSerata: vi.fn((cb) => {
    cb({ id: 'serata1', status: 'open' })
    return () => {}
  }),
  fetchInventoryItems: vi.fn(() => Promise.resolve([])),
}))
vi.mock('../../src/lib/pendingOrders.js', () => ({
  submitPosOrder: vi.fn(),
}))
vi.mock('../../src/lib/menuCache.js', () => ({
  useMenu: () => ({
    drinks: [
      { id: 'mojito', name: 'Mojito', price: 7, available: true, category_id: 'cat1' },
      { id: 'gin', name: 'Gin Tonic', price: 8, available: true, category_id: 'cat1' },
    ],
    cats: [{ id: 'cat1', name: 'Cocktail', sort_order: 0 }],
    loading: false,
  }),
}))
vi.mock('../../src/lib/firebaseClient.js', () => ({ auth: {} }))
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => () => {}),
}))

import PosPage from '../../src/pages/PosPage.jsx'
import { submitPosOrder } from '../../src/lib/pendingOrders.js'

function mount() {
  // Il carrello persiste in localStorage: pulito per ogni test.
  localStorage.clear()
  return render(
    <MemoryRouter>
      <PosPage />
    </MemoryRouter>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('cassa: layout identico al dettaglio ordine', () => {
  it('categorie a sinistra, griglia al centro, ORDINE a destra', () => {
    mount()
    // sinistra: categorie
    expect(screen.getByRole('button', { name: 'Cocktail' })).toBeInTheDocument()
    // centro: griglia prodotti
    expect(screen.getByText('Gin Tonic')).toBeInTheDocument()
    // destra: pannello ORDINE (stessa etichetta del dettaglio)
    expect(screen.getByText('ORDINE')).toBeInTheDocument()
    expect(screen.getByText(/Tocca i prodotti per aggiungerli/)).toBeInTheDocument()
    // stessi elementi del dettaglio: drink custom e dati conto ripiegabili
    expect(screen.getByRole('button', { name: /Drink custom/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dati conto/ })).toBeInTheDocument()
  })

  it('tap sulla griglia → riga a destra con +/− e totale live', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByText('Mojito'))
    await user.click(screen.getAllByText('Mojito')[0])
    // riga nel pannello con quantità 2 e totale aggiornato
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    expect(screen.getByText('14,00 €')).toBeInTheDocument()
  })

  it('Conferma crea l’ordine con gli item e i dati conto (senza stampa)', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByText('Mojito'))
    await user.click(screen.getByRole('button', { name: /Dati conto/ }))
    await user.type(screen.getByLabelText('Nome'), 'iole')
    await user.click(screen.getByRole('button', { name: '✅ Conferma' }))
    expect(submitPosOrder).toHaveBeenCalledTimes(1)
    const arg = submitPosOrder.mock.calls[0][0]
    expect(arg.serata_id).toBe('serata1')
    expect(arg.customer_name).toBe('iole')
    expect(arg.items).toEqual([expect.objectContaining({ drink_id: 'mojito', qty: 1 })])
    expect(arg.printNow).toBe(false)
  })

  it('la barra di ricerca filtra la griglia prodotti', async () => {
    const user = userEvent.setup()
    mount()
    await user.type(screen.getByLabelText('Cerca prodotto'), 'gin')
    expect(screen.getByText('Gin Tonic')).toBeInTheDocument()
    expect(screen.queryByText('Mojito')).not.toBeInTheDocument()
  })
})
