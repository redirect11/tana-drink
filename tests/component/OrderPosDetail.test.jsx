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
vi.mock('../../src/lib/api.js', () => ({
  advanceComanda: vi.fn(() => Promise.resolve()),
  addComanda: vi.fn(() => Promise.resolve()),
  bartenderUpdateComanda: vi.fn(() => Promise.resolve()),
  updateOrderInfo: vi.fn(() => Promise.resolve()),
  markOrderPaid: vi.fn(() => Promise.resolve()),
  cancelOrder: vi.fn(() => Promise.resolve()),
  fetchInventoryItems: vi.fn(() => Promise.resolve([])),
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
  markOrderPaid,
} from '../../src/lib/api.js'
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

describe('layout SumUp: tutto visibile insieme', () => {
  it('griglia al centro E prodotti del conto a destra, senza tab', () => {
    mount(baseOrder())
    // header: numero + nome
    expect(screen.getByText(/#4/)).toBeInTheDocument()
    // destra: la comanda inviata con i suoi item
    expect(screen.getByText(/COMANDA 1/)).toBeInTheDocument()
    expect(screen.getAllByText(/Mojito/).length).toBeGreaterThan(0)
    // centro: la griglia prodotti è visibile CONTEMPORANEAMENTE
    expect(screen.getByText('Gin Tonic')).toBeInTheDocument()
    // sinistra: le categorie
    expect(screen.getByRole('button', { name: 'Cocktail' })).toBeInTheDocument()
  })

  it('conto vuoto: griglia + pannello nuova comanda vuoto', () => {
    mount(baseOrder({ comande: [], order_items: [], workflow_status: 'ricevuto' }))
    expect(screen.getByText('Tocca i prodotti per aggiungerli.')).toBeInTheDocument()
    expect(screen.getByText('Gin Tonic')).toBeInTheDocument()
  })
})

describe('nuova comanda (aggiunte al conto)', () => {
  it('tap sul prodotto → bozza; "Invia comanda" chiama addComanda con gli item', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    // aggiungi 2 Gin Tonic dalla griglia (sempre visibile)
    await user.click(screen.getByText('Gin Tonic'))
    const send1 = screen.getByRole('button', { name: /Invia comanda/ })
    expect(send1).toHaveTextContent('8,00')
    // dopo il primo tap il nome appare anche nella bozza: ritocca la TILE
    await user.click(screen.getAllByText('Gin Tonic')[0])
    // invia
    await user.click(screen.getByRole('button', { name: /Invia comanda/ }))
    expect(addComanda).toHaveBeenCalledTimes(1)
    const [orderId, items] = addComanda.mock.calls[0]
    expect(orderId).toBe('ord1')
    expect(items).toEqual([
      expect.objectContaining({ drink_id: 'gin', qty: 2, unit_price: 8 }),
    ])
  })

  it('la nuova comanda è numerata dopo quelle esistenti', () => {
    mount(baseOrder())
    expect(screen.getByText('NUOVA COMANDA (2)')).toBeInTheDocument()
  })
})

describe('gestione comande esistenti', () => {
  it('avanza lo stato della comanda (in_preparazione → pronto)', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Segna “Pronto al servizio”/ }))
    expect(advanceComanda).toHaveBeenCalledWith('ord1', 'c1', 'pronto')
  })

  it('il + aggiorna la qty e sincronizza in background (debounce)', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    // il + della riga Mojito nella COMANDA 1 (pannello destro)
    await user.click(screen.getByRole('button', { name: 'Aumenta' }))
    // UI subito aggiornata, scrittura remota dopo il debounce
    expect(screen.getByText('3')).toBeInTheDocument()
    await waitFor(() => expect(bartenderUpdateComanda).toHaveBeenCalledTimes(1), { timeout: 2000 })
    const [, comandaId, payload] = bartenderUpdateComanda.mock.calls[0]
    expect(comandaId).toBe('c1')
    expect(payload.items[0]).toMatchObject({ drink_id: 'mojito', qty: 3 })
  })

  it('comanda servita: niente +/− né avanzamento', () => {
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
    expect(screen.queryByRole('button', { name: 'Aumenta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Segna/ })).not.toBeInTheDocument()
  })
})

describe('stampa per comanda', () => {
  it('ogni comanda ha il suo bottone Stampa: stampa SOLO quella comanda', async () => {
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
    expect(screen.getByRole('button', { name: 'Stampa comanda 1' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stampa comanda 2' }))
    expect(printComanda).toHaveBeenCalledTimes(1)
    const [printedOrder, printedComanda] = printComanda.mock.calls[0]
    expect(printedOrder.id).toBe('ord1')
    expect(printedComanda.id).toBe('c2')
    expect(printedComanda.items[0].name).toBe('Gin Tonic')
  })
})

describe('modifiche ottimistiche (UX istantanea)', () => {
  it('tap rapidi su +: UI aggiornata SUBITO, una sola scrittura remota (debounce)', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    const plus = screen.getByRole('button', { name: 'Aumenta' })
    await user.click(plus)
    await user.click(plus)
    await user.click(plus)
    // la quantità è già 5 in UI, senza attendere il server
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(bartenderUpdateComanda).not.toHaveBeenCalled()
    // dopo il debounce parte UNA sola scrittura col valore finale
    await waitFor(() => expect(bartenderUpdateComanda).toHaveBeenCalledTimes(1), { timeout: 2000 })
    const [, comandaId, payload] = bartenderUpdateComanda.mock.calls[0]
    expect(comandaId).toBe('c1')
    expect(payload.items[0]).toMatchObject({ drink_id: 'mojito', qty: 5 })
  })
})

describe('incasso e chiusura del conto', () => {
  it('con comande NON servite chiede conferma, poi incassa', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Incassa e chiudi/ }))
    // avviso: comande non servite
    expect(screen.getByText(/comande non ancora servite/)).toBeInTheDocument()
    expect(markOrderPaid).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Incassa e chiudi' }))
    expect(markOrderPaid).toHaveBeenCalledWith('ord1', 'banco')
  })

  it('con tutto servito incassa direttamente (niente avviso)', async () => {
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
    await user.click(screen.getByRole('button', { name: /Incassa e chiudi/ }))
    expect(markOrderPaid).toHaveBeenCalledWith('ord1', 'banco')
    expect(screen.queryByText(/comande non ancora servite/)).not.toBeInTheDocument()
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
    expect(screen.queryByRole('button', { name: /Incassa e chiudi/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Annulla ordine/ })).not.toBeInTheDocument()
  })
})
