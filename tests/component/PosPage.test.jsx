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
  // La serata non si apre più a mano: il POS chiama ensureTodaySerata.
  ensureTodaySerata: vi.fn(() => Promise.resolve(mockSerata ?? { id: 'nuova-serata' })),
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
  subscribeVouchers: vi.fn((cb) => { cb([]); return () => {} }),
  payWithVoucher: vi.fn(() => Promise.resolve({ redeemed: 0, closed: false })),
}))
vi.mock('../../src/lib/pendingOrders.js', () => ({
  submitPosOrder: vi.fn(),
}))
vi.mock('../../src/lib/paymentsApi.js', () => ({
  readerCheckout: vi.fn(() => Promise.resolve({})),
}))
vi.mock('../../src/lib/printer.js', () => ({
  printScontrino: vi.fn(() => Promise.resolve()),
  printComanda: vi.fn(() => Promise.resolve()),
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
import { createOrder } from '../../src/lib/api.js'
import { printComanda } from '../../src/lib/printer.js'

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
    expect(arg.serata_id).toBeNull() // la serata si risolve in background nello store
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

  it('la stampa comanda è un’azione a parte: stampa senza creare l’ordine', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByText('Mojito'))
    await user.click(screen.getByRole('button', { name: /Stampa comanda/ }))
    await waitFor(() => expect(printComanda).toHaveBeenCalledTimes(1))
    const [orderLike, comandaLike] = printComanda.mock.calls[0]
    expect(orderLike.daily_number).toBeNull()
    expect(comandaLike.items).toEqual([{ name: 'Mojito', qty: 1 }])
    expect(submitPosOrder).not.toHaveBeenCalled()
  })
})

describe('pagamento diretto dal POS', () => {
  it('💳 Pagamento apre SUBITO la schermata: la creazione va in background', async () => {
    const user = userEvent.setup()
    // server lento: la creazione non risolve mai, la UI non deve aspettarla
    createOrder.mockImplementationOnce(() => new Promise(() => {}))
    mount()
    await user.click(screen.getByText('Mojito'))
    await user.click(screen.getByRole('button', { name: /💳 Pagamento/ }))
    // schermata aperta all'istante sull'ordine LOCALE (totale già giusto)
    expect(screen.getByRole('dialog', { name: 'Pagamento' })).toBeInTheDocument()
    expect(screen.getByTestId('pay-amount')).toHaveTextContent('7,00')
    expect(screen.getByRole('button', { name: /Riscuotere/ })).toBeInTheDocument()
  })

  it('la creazione in background usa la serata di oggi e lo stato in preparazione', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByText('Mojito'))
    await user.click(screen.getByRole('button', { name: /💳 Pagamento/ }))
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1))
    expect(createOrder.mock.calls[0][0]).toMatchObject({
      serata_id: 'serata1',
      status: 'in_preparazione',
    })
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
