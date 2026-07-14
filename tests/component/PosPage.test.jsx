// @vitest-environment happy-dom
'use strict'

// Test di COMPONENTE della cassa (PosPage): layout identico al dettaglio
// ordine, conferma con modale nome, pagamento diretto e serata auto-aperta.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'

let mockSerata = { id: 'serata1', status: 'open' }
vi.mock('../../src/lib/api.js', () => ({
  subscribeOpenSerata: vi.fn((cb) => {
    cb(mockSerata)
    return () => {}
  }),
  openSerata: vi.fn(() => Promise.resolve({ id: 'nuova-serata' })),
  createOrder: vi.fn(() =>
    Promise.resolve({
      id: 'ord-nuovo',
      daily_number: 9,
      status: 'aperto',
      payment_status: 'non_richiesto',
      total: 7,
      payments: [],
      discount_amount: 0,
      comande: [
        {
          id: 'c1',
          seq: 1,
          status: 'in_preparazione',
          items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 1 }],
        },
      ],
      order_items: [{ id: 'x', drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 1 }],
    })
  ),
  subscribeOrder: vi.fn(() => () => {}),
  subscribeSettings: vi.fn((cb) => {
    cb({ payments_reader_enabled: false, sumup_reader_id: null })
    return () => {}
  }),
  DEFAULT_SETTINGS: {},
  fetchInventoryItems: vi.fn(() => Promise.resolve([])),
  registerPayment: vi.fn(() => Promise.resolve({ closed: true })),
  setOrderDiscount: vi.fn(() => Promise.resolve()),
  setOrderLotteryCode: vi.fn(() => Promise.resolve()),
  createInvoice: vi.fn(() => Promise.resolve({ id: 'inv1', number: '1/2026' })),
  markInvoiceSent: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../src/lib/pendingOrders.js', () => ({
  submitPosOrder: vi.fn(),
}))
vi.mock('../../src/lib/paymentsApi.js', () => ({
  readerCheckout: vi.fn(() => Promise.resolve({})),
}))
vi.mock('../../src/lib/printer.js', () => ({
  printScontrino: vi.fn(() => Promise.resolve()),
  printFattura: vi.fn(() => Promise.resolve()),
  loadPrinterSettings: vi.fn(() => ({ ivaRate: 10 })),
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
import { openSerata, createOrder } from '../../src/lib/api.js'

function mount() {
  // Il carrello persiste in localStorage: pulito per ogni test.
  localStorage.clear()
  return render(
    <MemoryRouter>
      <PosPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSerata = { id: 'serata1', status: 'open' }
})

describe('cassa: layout identico al dettaglio ordine', () => {
  it('categorie a sinistra, griglia al centro, ORDINE a destra', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Cocktail' })).toBeInTheDocument()
    expect(screen.getByText('Gin Tonic')).toBeInTheDocument()
    expect(screen.getByText('ORDINE')).toBeInTheDocument()
    expect(screen.getByText(/Tocca i prodotti per aggiungerli/)).toBeInTheDocument()
    // stessi elementi del dettaglio: prodotto libero e dati conto ripiegabili
    expect(screen.getByRole('button', { name: /Prodotto libero/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dati conto/ })).toBeInTheDocument()
  })

  it('tap sulla griglia → riga a destra con +/− e totale live', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByText('Mojito'))
    await user.click(screen.getAllByText('Mojito')[0])
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    expect(screen.getByText('14,00 €')).toBeInTheDocument()
  })
})

describe('conferma con modale nome', () => {
  it('Conferma chiede il nome e salva con quello indicato', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByText('Mojito'))
    await user.click(screen.getByRole('button', { name: '✅ Conferma' }))
    // modale nome
    const modal = screen.getByRole('dialog', { name: 'Nome del conto' })
    await user.type(screen.getByLabelText('Nome'), 'iole')
    expect(modal).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Salva$/ }))
    expect(submitPosOrder).toHaveBeenCalledTimes(1)
    const arg = submitPosOrder.mock.calls[0][0]
    expect(arg.serata_id).toBe('serata1')
    expect(arg.customer_name).toBe('iole')
    expect(arg.printNow).toBe(false)
    expect(arg.items).toEqual([expect.objectContaining({ drink_id: 'mojito', qty: 1 })])
  })

  it('senza nome: salva col progressivo (customer_name null)', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByText('Mojito'))
    await user.click(screen.getByRole('button', { name: '✅ Conferma' }))
    await user.click(screen.getByRole('button', { name: /Salva senza nome/ }))
    expect(submitPosOrder).toHaveBeenCalledTimes(1)
    expect(submitPosOrder.mock.calls[0][0].customer_name).toBeNull()
  })

  it('senza serata aperta: si apre da sola al primo ordine', async () => {
    mockSerata = null
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByText('Mojito'))
    await user.click(screen.getByRole('button', { name: '✅ Conferma' }))
    await user.click(screen.getByRole('button', { name: /Salva senza nome/ }))
    await waitFor(() => expect(submitPosOrder).toHaveBeenCalledTimes(1))
    expect(openSerata).toHaveBeenCalledTimes(1)
    expect(submitPosOrder.mock.calls[0][0].serata_id).toBe('nuova-serata')
  })
})

describe('pagamento diretto dal POS', () => {
  it('💳 Pagamento crea il conto e apre subito la schermata Pagamento', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByText('Mojito'))
    await user.click(screen.getByRole('button', { name: /💳 Pagamento/ }))
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1))
    expect(createOrder.mock.calls[0][0]).toMatchObject({
      serata_id: 'serata1',
      status: 'in_preparazione',
    })
    // schermata Pagamento aperta sull'ordine appena creato
    expect(await screen.findByRole('dialog', { name: 'Pagamento' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Riscuotere/ })).toBeInTheDocument()
  })
})

describe('ricerca prodotti', () => {
  it('la barra di ricerca filtra la griglia prodotti', async () => {
    const user = userEvent.setup()
    mount()
    await user.type(screen.getByLabelText('Cerca prodotto'), 'gin')
    expect(screen.getByText('Gin Tonic')).toBeInTheDocument()
    expect(screen.queryByText('Mojito')).not.toBeInTheDocument()
  })
})
