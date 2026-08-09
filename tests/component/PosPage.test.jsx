// @vitest-environment happy-dom
'use strict'

// Test di COMPONENTE della cassa (PosPage): layout identico al dettaglio
// ordine, conferma con modale nome e pagamento diretto.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Spia sulla navigazione: serve a verificare che "← Ordini" riporti davvero
// alla coda, non solo che non esploda.
const navigateSpy = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const vera = await orig()
  return { ...vera, useNavigate: () => navigateSpy }
})
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/lib/api.js', () => ({
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
  fetchRecentDrinkIds: vi.fn(() => Promise.resolve([])),
  subscribePosPrefs: vi.fn(() => () => {}),
  savePosOrder: vi.fn(() => Promise.resolve()),
  savePosFavorites: vi.fn(() => Promise.resolve()),
  subscribeOpenGroups: vi.fn((cb) => {
    cb([
      { id: 'g1', name: 'Tavolo 4', has_child_groups: false },
      { id: 'g2', name: 'Compleanno', has_child_groups: true },
    ])
    return () => {}
  }),
  peekNextDailyNumber: vi.fn(() => Promise.resolve(9)),
  subscribeSettings: vi.fn((cb) => {
    // 'uniti': due tap sullo stesso prodotto sommano la quantità.
    cb({
      payments_reader_enabled: false,
      sumup_reader_id: null,
      order_group_default: 'uniti',
      groups_enabled: true, // i gruppi sono opzionali: qui accesi
    })
    return () => {}
  }),
  DEFAULT_SETTINGS: {},
  advanceComanda: vi.fn(() => Promise.resolve()),
  addComanda: vi.fn(() => Promise.resolve({ comande: [] })),
  bartenderUpdateComanda: vi.fn(() => Promise.resolve()),
  updateOrderInfo: vi.fn(() => Promise.resolve()),
  cancelOrder: vi.fn(() => Promise.resolve()),
  fetchInventoryItems: vi.fn(() => Promise.resolve([])),
  registerPayment: vi.fn(() => Promise.resolve({ closed: true })),
  setOrderDiscount: vi.fn(() => Promise.resolve()),
  setOrderLotteryCode: vi.fn(() => Promise.resolve()),
  createInvoice: vi.fn(() => Promise.resolve({ id: 'inv1', number: '1/2026' })),
  markInvoiceSent: vi.fn(() => Promise.resolve()),
  subscribeVouchers: vi.fn((cb) => { cb([]); return () => {} }),
  applyVoucherDiscount: vi.fn(() => Promise.resolve({ redeemed: 0 })),
  // Senza cassa aperta il POS non fa battere ordini: qui la cassa è aperta.
  subscribeOpenCashSession: vi.fn((cb) => {
    cb({ id: 'cash1', status: 'open', opened_at: '2026-08-08T18:00:00.000Z' })
    return () => {}
  }),
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
import { createOrder, updateOrderInfo, subscribeSettings } from '../../src/lib/api.js'
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
})

describe('cassa: layout identico al dettaglio ordine', () => {
  it('categorie a sinistra, griglia al centro, ORDINE a destra', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Cocktail' })).toBeInTheDocument()
    expect(screen.getByText('Gin Tonic')).toBeInTheDocument()
    // La schermata di creazione è la stessa della modifica: intestazione "Nuovo ordine".
    expect(screen.getAllByText('Nuovo ordine').length).toBeGreaterThan(0)
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

describe('creazione: ordine creato al primo item, nome chiesto alla chiusura', () => {
  it('aggiungere un item CREA subito l’ordine (createOrder) con quegli item', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByText('Mojito'))
    // l'ordine si crea da solo poco dopo l'aggiunta (senza cliccare Conferma)
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1))
    expect(createOrder.mock.calls[0][0].items).toEqual([
      expect.objectContaining({ drink_id: 'mojito', qty: 1 }),
    ])
  })

  it('alla chiusura di un ordine appena creato chiede il nome e lo salva', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByText('Mojito'))
    await user.click(screen.getByRole('button', { name: /Torna agli ordini/ }))
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1))
    // l'ordine creato non ha nome → lo si chiede una volta
    await user.type(await screen.findByLabelText('Nome'), 'iole')
    await user.click(screen.getByRole('button', { name: /^Salva$/ }))
    expect(updateOrderInfo).toHaveBeenCalledWith('ord-nuovo', { customer_name: 'iole' })
  })

  it('chiusura senza nome: nessun nome salvato (resta il progressivo)', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByText('Mojito'))
    await user.click(screen.getByRole('button', { name: /Torna agli ordini/ }))
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1))
    await user.click(await screen.findByRole('button', { name: /Salva senza nome/ }))
    expect(updateOrderInfo).not.toHaveBeenCalled()
  })

})

describe('pagamento diretto dal POS', () => {
  it('💳 Pagamento apre SUBITO la schermata: la creazione va in background', async () => {
    const user = userEvent.setup()
    // server lento: la creazione non risolve mai, la UI non deve aspettarla
    createOrder.mockImplementationOnce(() => new Promise(() => {}))
    mount()
    await user.click(screen.getByText('Mojito'))
    await user.click(screen.getByRole('button', { name: /Pagamento/ }))
    // schermata aperta all'istante sull'ordine LOCALE (totale già giusto)
    expect(screen.getByRole('dialog', { name: 'Pagamento' })).toBeInTheDocument()
    expect(screen.getByTestId('pay-amount')).toHaveTextContent('7,00')
    expect(screen.getByRole('button', { name: /Riscuotere/ })).toBeInTheDocument()
  })

  it('la creazione in background parte con lo stato in preparazione', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByText('Mojito'))
    await user.click(screen.getByRole('button', { name: /Pagamento/ }))
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1))
    expect(createOrder.mock.calls[0][0]).toMatchObject({
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

describe('conto di gruppo dal POS', () => {
  const mountGroup = (id) => {
    localStorage.clear()
    return render(
      <MemoryRouter initialEntries={[`/pos?group=${id}`]}>
        <PosPage />
      </MemoryRouter>
    )
  }

  it('mostra il gruppo e ci associa l’ordine creato', async () => {
    const user = userEvent.setup()
    mountGroup('g1')
    expect(screen.getByText(/Tavolo 4/)).toBeInTheDocument()
    await user.click(screen.getByText('Mojito'))
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1))
    const arg = createOrder.mock.calls[0][0]
    expect(arg.group_id).toBe('g1')
    expect(arg.group_name_snapshot).toBe('Tavolo 4')
  })

  it('un gruppo CONTENITORE non può avere ordini diretti: avvisa', () => {
    mountGroup('g2')
    expect(screen.getByText(/contiene altri gruppi/)).toBeInTheDocument()
  })

  it('si può associare un gruppo anche senza arrivarci dal gruppo', async () => {
    const user = userEvent.setup()
    mount() // POS normale, nessun ?group=
    await user.click(screen.getByRole('button', { name: /Associa a gruppo/ }))
    await user.click(screen.getByRole('button', { name: /Tavolo 4/ }))
    await user.click(screen.getByText('Mojito'))
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1))
    expect(createOrder.mock.calls[0][0].group_id).toBe('g1')
  })

  it('un gruppo CONTENITORE non è fra quelli scegliibili', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: /Associa a gruppo/ }))
    expect(screen.getByRole('button', { name: /Tavolo 4/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Compleanno/ })).not.toBeInTheDocument()
  })

  it('senza gruppo l’ordine non ne porta nessuno', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByText('Mojito'))
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1))
    expect(createOrder.mock.calls[0][0].group_id).toBeNull()
  })
})

describe('gestione preparazione opzionale', () => {
  const mountConWorkflow = (on) => {
    localStorage.clear()
    subscribeSettings.mockImplementation((cb) => {
      cb({ order_group_default: 'uniti', workflow_enabled: on, service_mode: 'banco' })
      return () => {}
    })
    return render(
      <MemoryRouter>
        <PosPage />
      </MemoryRouter>
    )
  }

  it('ATTIVA: l’ordine nasce già in preparazione', async () => {
    const user = userEvent.setup()
    mountConWorkflow(true)
    await user.click(screen.getByText('Mojito'))
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1))
    expect(createOrder.mock.calls[0][0].status).toBe('in_preparazione')
  })

  it('SPENTA: l’ordine nasce e resta "ricevuto"', async () => {
    const user = userEvent.setup()
    mountConWorkflow(false)
    await user.click(screen.getByText('Mojito'))
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1))
    expect(createOrder.mock.calls[0][0].status).toBe('ricevuto')
  })

  it('il POS eredita la modalità di consegna del locale', async () => {
    const user = userEvent.setup()
    mountConWorkflow(true)
    await user.click(screen.getByText('Mojito'))
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1))
    expect(createOrder.mock.calls[0][0].service_mode).toBe('banco')
  })
})

// USCITA DAL POS: "← Ordini" deve riportare alla coda. Segnalato da Flavio:
// creato un conto e lasciato lì, premendo la freccia non si tornava alla
// lista degli ordini.
describe('uscita dal POS', () => {
  const mount = () =>
    render(
      <MemoryRouter initialEntries={['/pos']}>
        <PosPage />
      </MemoryRouter>
    )

  beforeEach(() => {
    vi.clearAllMocks()
    navigateSpy.mockClear()
  })

  it('senza niente in bozza torna subito alla coda', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: /Torna agli ordini/ }))
    expect(navigateSpy).toHaveBeenCalledWith('/bar')
  })

  it('col conto appena creato: dopo il nome torna alla coda', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByText('Mojito'))
    await user.click(screen.getByRole('button', { name: /Torna agli ordini/ }))
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1))
    await user.type(await screen.findByLabelText('Nome'), 'iole')
    await user.click(screen.getByRole('button', { name: /^Salva$/ }))
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/bar'))
  })

  it('e anche scegliendo di non dare un nome', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByText('Mojito'))
    await user.click(screen.getByRole('button', { name: /Torna agli ordini/ }))
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1))
    await user.click(await screen.findByRole('button', { name: /Salva senza nome/ }))
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/bar'))
  })
})
