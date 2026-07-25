// @vitest-environment happy-dom
'use strict'

// Test di COMPONENTE del dettaglio ordine POS (OrderPosDetail): monta il
// componente vero con React Testing Library e verifica ciò che il bartender
// vede e tocca. Firebase/menu/stampante sono mockati.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'

// ── Mock dei moduli con dipendenze Firebase/hardware ──
const mockSettings = { payments_reader_enabled: false, sumup_reader_id: null }
vi.mock('../../src/lib/api.js', () => ({
  advanceComanda: vi.fn(() => Promise.resolve()),
  addComanda: vi.fn(() => Promise.resolve({ comande: [] })),
  bartenderUpdateComanda: vi.fn(() => Promise.resolve()),
  updateOrderInfo: vi.fn(() => Promise.resolve()),
  registerPayment: vi.fn(() => Promise.resolve({ closed: true })),
  setOrderDiscount: vi.fn(() => Promise.resolve()),
  setOrderLotteryCode: vi.fn(() => Promise.resolve()),
  createInvoice: vi.fn(() => Promise.resolve({ id: 'inv1', number: '1/2026' })),
  markInvoiceSent: vi.fn(() => Promise.resolve()),
  subscribeVouchers: vi.fn((cb) => { cb([]); return () => {} }),
  applyVoucherDiscount: vi.fn(() => Promise.resolve({ redeemed: 0 })),
  cancelOrder: vi.fn(() => Promise.resolve()),
  fetchInventoryItems: vi.fn(() => Promise.resolve([])),
  // Usati solo in creazione (order == null): qui no-op.
  createOrder: vi.fn(() => Promise.resolve({ id: 'ord-nuovo' })),
  ensureTodaySerata: vi.fn(() => Promise.resolve({ id: 'serata1' })),
  subscribeOrder: vi.fn(() => () => {}),
  fetchRecentDrinkIds: vi.fn(() => Promise.resolve([])),
  subscribePosPrefs: vi.fn(() => () => {}),
  savePosOrder: vi.fn(() => Promise.resolve()),
  savePosFavorites: vi.fn(() => Promise.resolve()),
  DEFAULT_SETTINGS: {},
  subscribeSettings: vi.fn((cb) => {
    cb(mockSettings)
    return () => {}
  }),
}))
vi.mock('../../src/lib/pendingOrders.js', () => ({ submitPosOrder: vi.fn() }))
vi.mock('../../src/lib/firebaseClient.js', () => ({ auth: {} }))
vi.mock('firebase/auth', () => ({ onAuthStateChanged: vi.fn(() => () => {}) }))
vi.mock('../../src/lib/paymentsApi.js', () => ({
  readerCheckout: vi.fn(() => Promise.resolve({})),
}))
vi.mock('../../src/lib/menuCache.js', () => ({
  useMenu: () => ({
    drinks: [
      { id: 'mojito', name: 'Mojito', price: 7, available: true, category_id: 'cat1' },
      {
        id: 'gin',
        name: 'Gin Tonic',
        price: 8,
        available: true,
        category_id: 'cat1',
        recipe_items: [{ inventory_item_id: 'inv-gin', name: 'Gin', qty: 40, unit: 'ml' }],
      },
    ],
    cats: [{ id: 'cat1', name: 'Cocktail', sort_order: 0 }],
    loading: false,
  }),
}))
vi.mock('../../src/lib/printer.js', () => ({
  printComanda: vi.fn(() => Promise.resolve()),
  printScontrino: vi.fn(() => Promise.resolve()),
  printFattura: vi.fn(() => Promise.resolve()),
  loadPrinterSettings: vi.fn(() => ({ ivaRate: 10 })),
}))

import OrderPosDetail from '../../src/components/OrderPosDetail.jsx'
import {
  advanceComanda,
  addComanda,
  bartenderUpdateComanda,
  registerPayment,
} from '../../src/lib/api.js'
import { readerCheckout } from '../../src/lib/paymentsApi.js'
import { printComanda } from '../../src/lib/printer.js'

const baseOrder = (over = {}) => ({
  id: 'ord1',
  daily_number: 4,
  status: 'aperto',
  workflow_status: 'in_preparazione',
  payment_status: 'non_richiesto',
  customer_name: 'iole',
  table_label: '3',
  note: null,
  total: 14,
  coperto_amount: 0,
  service_charge_amount: 0,
  tip_amount: 0,
  order_items: [
    { id: 'ord1-0', drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2, custom: false },
  ],
  comande: [
    {
      id: 'c1',
      seq: 1,
      status: 'in_preparazione',
      status_times: {},
      created_at: '2026-07-11T21:00:00.000Z',
      items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 }],
    },
  ],
  ...over,
})

function mount(order) {
  return render(
    <MemoryRouter>
      <OrderPosDetail order={order} />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  // La bozza è persistita in localStorage per ordine: pulisco tra i test.
  localStorage.clear()
})

describe('vista aggregata: ordine a destra, comande nascoste', () => {
  it("mostra i prodotti dell'ORDINE aggregato, non le singole comande", () => {
    mount(baseOrder())
    // testata colonna ordine: numero + nome del conto (spostati a destra)
    expect(screen.getAllByText(/#4/).length).toBeGreaterThan(0)
    expect(screen.getByText(/· iole/)).toBeInTheDocument()
    // destra: l'ordine aggregato (niente sezioni COMANDA in vista)
    expect(screen.queryByText(/COMANDA 1/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/Mojito/).length).toBeGreaterThan(0)
    // accesso alle comande dal bottone dedicato
    expect(screen.getByRole('button', { name: /Comande \(1\)/ })).toBeInTheDocument()
    // centro: griglia visibile contemporaneamente
    expect(screen.getByText('Gin Tonic')).toBeInTheDocument()
  })

  it('conto vuoto: griglia + ordine vuoto', () => {
    mount(baseOrder({ comande: [], order_items: [], workflow_status: 'ricevuto' }))
    expect(screen.getByText(/Tocca i prodotti per aggiungerli/)).toBeInTheDocument()
    expect(screen.getByText('Gin Tonic')).toBeInTheDocument()
  })
})

describe('aggiunte: la nuova comanda è gestita internamente', () => {
  it('tap sulla griglia → gli item si CONFERMANO da soli, confluiscono nella comanda in prep.', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getAllByText('Gin Tonic')[0])
    await user.click(screen.getAllByText('Gin Tonic')[0])
    // l'aggiunta è confermata da sola (senza cliccare Conferma)
    await waitFor(() => expect(bartenderUpdateComanda).toHaveBeenCalled())
    // l'ordine è in preparazione → NON crea una nuova comanda: confluisce in c1
    expect(addComanda).not.toHaveBeenCalled()
    const [orderId, comandaId, payload] = bartenderUpdateComanda.mock.calls.at(-1)
    expect(orderId).toBe('ord1')
    expect(comandaId).toBe('c1')
    expect(payload.items.some((i) => i.drink_id === 'gin')).toBe(true)
    expect(payload.items.some((i) => i.drink_id === 'mojito')).toBe(true)
    expect(printComanda).not.toHaveBeenCalled()
  })

  it('ordine già SERVITO: l\'aggiunta crea una NUOVA comanda (addComanda)', async () => {
    const user = userEvent.setup()
    mount(
      baseOrder({
        comande: [
          { id: 'c1', seq: 1, status: 'ritirato', status_times: {}, items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 }] },
        ],
      })
    )
    await user.click(screen.getAllByText('Gin Tonic')[0])
    // nessuna comanda modificabile → nuova comanda, da sola
    await waitFor(() => expect(addComanda).toHaveBeenCalled())
    expect(bartenderUpdateComanda).not.toHaveBeenCalled()
    const [orderId, items] = addComanda.mock.calls.at(-1)
    expect(orderId).toBe('ord1')
    expect(items.some((i) => i.drink_id === 'gin')).toBe(true)
  })

  it('la modifica per-item PRECARICA gli ingredienti del drink (si sostituiscono, non solo si aggiungono)', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByText('Gin Tonic'))
    await user.click(screen.getByRole('button', { name: /Modifica Gin Tonic/ }))
    // la ricetta del prodotto è già lì, quindi si può togliere/cambiare
    expect(screen.getByLabelText('Quantità Gin')).toHaveValue(40)
    expect(screen.queryByText(/non ha ingredienti configurati/)).not.toBeInTheDocument()
  })

  it('drink SENZA ingredienti: avvisa il bartender', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    // Il Mojito non ha recipe_items nel menù mock
    await user.click(screen.getAllByText('Mojito')[0])
    await user.click(screen.getByRole('button', { name: /Modifica Mojito/ }))
    expect(screen.getByText(/non ha ingredienti configurati/)).toBeInTheDocument()
  })

  it("il + su un item del conto è un'aggiunta che si conferma da sola", async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getAllByRole('button', { name: 'Aumenta' }).at(-1))
    // ordine in preparazione → l'aggiunta confluisce da sola nella comanda c1
    await waitFor(() => expect(bartenderUpdateComanda).toHaveBeenCalled())
    expect(addComanda).not.toHaveBeenCalled()
  })
})

describe('diminuzioni: solo dalle comande ancora modificabili', () => {
  it('avanza lo stato della comanda ATTIVA dal footer', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Segna “Pronto al servizio”/ }))
    expect(advanceComanda).toHaveBeenCalledWith('ord1', 'c1', 'pronto')
  })

  it('il − scala la comanda modificabile con sync in background (debounce)', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getAllByRole('button', { name: 'Riduci' }).at(-1))
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
    await waitFor(() => expect(bartenderUpdateComanda).toHaveBeenCalledTimes(1), { timeout: 2000 })
    const [, comandaId, payload] = bartenderUpdateComanda.mock.calls[0]
    expect(comandaId).toBe('c1')
    expect(payload.items[0]).toMatchObject({ drink_id: 'mojito', qty: 1 })
  })

  it('comanda servita: il − è disabilitato (quantità bloccate), il + resta', () => {
    mount(
      baseOrder({
        workflow_status: 'ritirato',
        comande: [
          {
            id: 'c1',
            seq: 1,
            status: 'ritirato',
            status_times: {},
            items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 }],
          },
        ],
      })
    )
    expect(screen.getAllByRole('button', { name: 'Riduci' }).at(-1)).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Aumenta' }).at(-1)).toBeEnabled()
    expect(screen.queryByRole('button', { name: /Segna/ })).not.toBeInTheDocument()
  })
})

describe('modale comande: consultazione, avanzamento e stampa', () => {
  it('le comande si aprono a parte e ognuna si stampa singolarmente', async () => {
    const user = userEvent.setup()
    const order = baseOrder({
      comande: [
        {
          id: 'c1', seq: 1, status: 'ritirato', status_times: {},
          items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 }],
        },
        {
          id: 'c2', seq: 2, status: 'ricevuto', status_times: {},
          items: [{ drink_id: 'gin', name: 'Gin Tonic', unit_price: 8, qty: 1 }],
        },
      ],
    })
    mount(order)
    // le comande NON sono in vista finché non apro la modale
    expect(screen.queryByText(/COMANDA 1/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Comande \(2\)/ }))
    expect(screen.getByText(/COMANDA 1/)).toBeInTheDocument()
    expect(screen.getByText(/COMANDA 2/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stampa comanda 2' }))
    expect(printComanda).toHaveBeenCalledTimes(1)
    const [printedOrder, printedComanda] = printComanda.mock.calls[0]
    expect(printedOrder.id).toBe('ord1')
    expect(printedComanda.id).toBe('c2')
  })
})

describe('modifiche ottimistiche (UX istantanea)', () => {
  it('aggiunta ISTANTANEA: parte in background senza attendere il server', async () => {
    const user = userEvent.setup()
    bartenderUpdateComanda.mockImplementationOnce(() => new Promise(() => {})) // server lento
    mount(baseOrder())
    await user.click(screen.getAllByText('Gin Tonic')[0])
    // parte da sola (ottimistico), senza aspettare la risoluzione del server
    await waitFor(() => expect(bartenderUpdateComanda).toHaveBeenCalled())
    expect(bartenderUpdateComanda.mock.calls.at(-1)[0]).toBe('ord1')
  })

  it('avanzamento ISTANTANEO: lo stato cambia subito, il server segue', async () => {
    const user = userEvent.setup()
    advanceComanda.mockImplementationOnce(() => new Promise(() => {})) // in volo
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Segna “Pronto al servizio”/ }))
    // la pill mostra già "Pronto al servizio" senza attendere la transazione
    expect(screen.getAllByText(/Pronto al servizio/).length).toBeGreaterThan(0)
    expect(
      screen.queryByRole('button', { name: /Segna “Pronto al servizio”/ })
    ).not.toBeInTheDocument()
  })

  it('tap rapidi sulla griglia: le aggiunte confluiscono nella comanda in prep., senza tasto Conferma', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    const tile = () => screen.getAllByText('Mojito')[0] // la tile della griglia
    await user.click(tile())
    await user.click(tile())
    await user.click(tile())
    // si confermano da sole nella comanda in preparazione (senza cliccare Conferma)
    await waitFor(() => expect(bartenderUpdateComanda).toHaveBeenCalled())
    expect(addComanda).not.toHaveBeenCalled()
    const payload = bartenderUpdateComanda.mock.calls.at(-1)[2]
    expect(payload.items.some((i) => i.drink_id === 'mojito')).toBe(true)
  })
})

describe('schermata Pagamento', () => {
  it('"Pagamento" apre la schermata POS con dovuto e avviso; Riscuotere incassa tutto', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Pagamento/ }))
    // schermata: articoli a sinistra, importo al centro, avviso (c1 in prep.)
    expect(screen.getByRole('dialog', { name: 'Pagamento' })).toBeInTheDocument()
    expect(screen.getByTestId('pay-amount')).toHaveTextContent('14,00')
    expect(screen.getByText(/[Cc]omande non ancora servite/)).toBeInTheDocument()
    expect(registerPayment).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /Riscuotere/ }))
    expect(registerPayment).toHaveBeenCalledWith('ord1', {
      amount: 14,
      method: 'banco',
      items: null,
      autoServe: false,
    })
  })

  it('con tutto servito la schermata non mostra avvisi', async () => {
    const user = userEvent.setup()
    mount(
      baseOrder({
        workflow_status: 'ritirato',
        comande: [
          {
            id: 'c1',
            seq: 1,
            status: 'ritirato',
            status_times: {},
            items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 }],
          },
        ],
      })
    )
    await user.click(screen.getByRole('button', { name: /Pagamento/ }))
    expect(screen.queryByText(/[Cc]omande non ancora servite/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Riscuotere/ }))
    expect(registerPayment).toHaveBeenCalledWith('ord1', {
      amount: 14,
      method: 'banco',
      items: null,
      autoServe: false,
    })
  })

  it('lettore SumUp: metodo visibile solo se configurato, Riscuotere avvia readerCheckout', async () => {
    const user = userEvent.setup()
    mockSettings.payments_reader_enabled = true
    mockSettings.sumup_reader_id = 'reader1'
    try {
      mount(baseOrder())
      await user.click(screen.getByRole('button', { name: /Pagamento/ }))
      await user.click(screen.getByRole('button', { name: /SumUp/ }))
      await user.click(screen.getByRole('button', { name: /Riscuotere/ }))
      expect(readerCheckout).toHaveBeenCalledWith('ord1', { amount: 14, items: null })
      expect(registerPayment).not.toHaveBeenCalled()
    } finally {
      mockSettings.payments_reader_enabled = false
      mockSettings.sumup_reader_id = null
    }
  })

  it('lettore NON configurato: il metodo SumUp è in lista ma spento', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Pagamento/ }))
    expect(screen.getByRole('button', { name: /SumUp/ })).toBeDisabled()
  })

  it('conto chiuso (pagato): griglia e modifiche disabilitate', () => {
    mount(
      baseOrder({
        status: 'pagato',
        workflow_status: 'pagato',
        payment_status: 'pagato',
        comande: [
          {
            id: 'c1',
            seq: 1,
            status: 'ritirato',
            status_times: {},
            items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 }],
          },
        ],
      })
    )
    expect(screen.queryByRole('button', { name: /Pagamento/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Annulla ordine/ })).not.toBeInTheDocument()
  })
})

describe('ricerca prodotti', () => {
  it('digitando nella barra la griglia filtra su tutto il catalogo', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    expect(screen.getByText('Gin Tonic')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Cerca prodotto'), 'moj')
    expect(screen.queryByText('Gin Tonic')).not.toBeInTheDocument()
    // Mojito resta sia in griglia sia nella riga dell'ordine
    expect(screen.getAllByText('Mojito').length).toBeGreaterThan(0)
  })
})
