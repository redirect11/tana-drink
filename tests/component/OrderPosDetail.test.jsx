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
  cancelOrder: vi.fn(() => Promise.resolve()),
  fetchInventoryItems: vi.fn(() => Promise.resolve([])),
  DEFAULT_SETTINGS: {},
  subscribeSettings: vi.fn((cb) => {
    cb(mockSettings)
    return () => {}
  }),
}))
vi.mock('../../src/lib/paymentsApi.js', () => ({
  readerCheckout: vi.fn(() => Promise.resolve({})),
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
vi.mock('../../src/lib/printer.js', () => ({
  printComanda: vi.fn(() => Promise.resolve()),
  printScontrino: vi.fn(() => Promise.resolve()),
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

beforeEach(() => vi.clearAllMocks())

describe('vista aggregata: ordine a destra, comande nascoste', () => {
  it("mostra i prodotti dell'ORDINE aggregato, non le singole comande", () => {
    mount(baseOrder())
    // header: numero + nome
    expect(screen.getByText(/#4/)).toBeInTheDocument()
    // destra: l'ordine aggregato (niente sezioni COMANDA in vista)
    expect(screen.getByText('ORDINE')).toBeInTheDocument()
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
  it('tap sulla griglia → badge "da inviare"; "Conferma aggiunte" chiama addComanda SENZA stampare', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByText('Gin Tonic'))
    expect(screen.getByText('+1 da inviare')).toBeInTheDocument()
    await user.click(screen.getAllByText('Gin Tonic')[0])
    await user.click(screen.getByRole('button', { name: /Conferma aggiunte/ }))
    expect(addComanda).toHaveBeenCalledTimes(1)
    const [orderId, items] = addComanda.mock.calls[0]
    expect(orderId).toBe('ord1')
    expect(items).toEqual([
      expect.objectContaining({ drink_id: 'gin', qty: 2, unit_price: 8 }),
    ])
    expect(printComanda).not.toHaveBeenCalled()
  })

  it('"Conferma + stampa comanda" invia e stampa la comanda appena creata', async () => {
    const user = userEvent.setup()
    const nuova = { id: 'c2', seq: 2, status: 'ricevuto', items: [] }
    addComanda.mockResolvedValueOnce({ id: 'ord1', comande: [{ id: 'c1' }, nuova] })
    mount(baseOrder())
    await user.click(screen.getByText('Gin Tonic'))
    await user.click(screen.getByRole('button', { name: /Conferma \+ stampa comanda/ }))
    expect(addComanda).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(printComanda).toHaveBeenCalledTimes(1))
    expect(printComanda.mock.calls[0][1].id).toBe('c2')
  })

  it("il + su un item esistente è un'aggiunta (non tocca le comande)", async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getAllByRole('button', { name: 'Aumenta' }).at(-1))
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
    expect(screen.getByText('+1 da inviare')).toBeInTheDocument()
    expect(bartenderUpdateComanda).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /Conferma aggiunte/ }))
    expect(addComanda).toHaveBeenCalledTimes(1)
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
  it('tap rapidi su +: qty aggregata subito aggiornata, nessuna chiamata finché non invio', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    const plus = () => screen.getAllByRole('button', { name: 'Aumenta' }).at(-1)
    await user.click(plus())
    await user.click(plus())
    await user.click(plus())
    expect(screen.getAllByText('5').length).toBeGreaterThan(0)
    expect(screen.getByText('+3 da inviare')).toBeInTheDocument()
    expect(bartenderUpdateComanda).not.toHaveBeenCalled()
    expect(addComanda).not.toHaveBeenCalled()
  })
})

describe('schermata Pagamento', () => {
  it('"Pagamento" apre la schermata con residuo e avviso comande non servite; Contanti incassa tutto', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Pagamento/ }))
    // schermata: articoli a sinistra, residuo in evidenza, avviso (c1 in prep.)
    expect(screen.getByRole('dialog', { name: 'Pagamento' })).toBeInTheDocument()
    expect(screen.getByText('Residuo da incassare')).toBeInTheDocument()
    expect(screen.getByText(/comande non ancora servite/)).toBeInTheDocument()
    expect(registerPayment).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /Contanti/ }))
    expect(registerPayment).toHaveBeenCalledWith('ord1', {
      amount: 14,
      method: 'banco',
      items: null,
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
    expect(screen.queryByText(/comande non ancora servite/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Contanti/ }))
    expect(registerPayment).toHaveBeenCalledWith('ord1', {
      amount: 14,
      method: 'banco',
      items: null,
    })
  })

  it('lettore SumUp: visibile solo se configurato, e avvia readerCheckout sul residuo', async () => {
    const user = userEvent.setup()
    mockSettings.payments_reader_enabled = true
    mockSettings.sumup_reader_id = 'reader1'
    try {
      mount(baseOrder())
      await user.click(screen.getByRole('button', { name: /Pagamento/ }))
      await user.click(screen.getByRole('button', { name: /Carta sul lettore SumUp/ }))
      expect(readerCheckout).toHaveBeenCalledWith('ord1', { amount: 14, items: null })
      expect(registerPayment).not.toHaveBeenCalled()
    } finally {
      mockSettings.payments_reader_enabled = false
      mockSettings.sumup_reader_id = null
    }
  })

  it('lettore NON configurato: il bottone non esiste', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Pagamento/ }))
    expect(screen.queryByRole('button', { name: /lettore SumUp/ })).not.toBeInTheDocument()
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
