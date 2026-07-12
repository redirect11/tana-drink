// @vitest-environment happy-dom
'use strict'

// Test di COMPONENTE della schermata Pagamento in stile POS SumUp:
// articoli selezionabili a SINISTRA (split del conto), sconto/preconto/
// metodi di pagamento a DESTRA.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/lib/api.js', () => ({
  registerPayment: vi.fn(() => Promise.resolve({ closed: false })),
  setOrderDiscount: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../src/lib/paymentsApi.js', () => ({
  readerCheckout: vi.fn(() => Promise.resolve({})),
}))
vi.mock('../../src/lib/printer.js', () => ({
  printScontrino: vi.fn(() => Promise.resolve()),
}))

import PaymentScreen from '../../src/components/PaymentScreen.jsx'
import { registerPayment, setOrderDiscount } from '../../src/lib/api.js'
import { printScontrino } from '../../src/lib/printer.js'

const baseOrder = (over = {}) => ({
  id: 'ord1',
  daily_number: 4,
  status: 'aperto',
  payment_status: 'non_richiesto',
  total: 22,
  discount: null,
  discount_amount: 0,
  payments: [],
  comande: [
    {
      id: 'c1',
      seq: 1,
      status: 'ritirato',
      items: [
        { drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 },
        { drink_id: 'gin', name: 'Gin Tonic', unit_price: 8, qty: 1 },
      ],
    },
  ],
  ...over,
})

const noReader = { payments_reader_enabled: false, sumup_reader_id: null }

function mount(order, settings = noReader) {
  return render(
    <PaymentScreen order={order} settings={settings} onClose={vi.fn()} onBeforePay={vi.fn()} />
  )
}

beforeEach(() => vi.clearAllMocks())

describe('split: articoli selezionabili e pagabili singolarmente', () => {
  it('selezionando un articolo si incassa solo quello', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    // articoli a sinistra con le quantità del conto
    expect(screen.getByText('Mojito')).toBeInTheDocument()
    expect(screen.getByText('Gin Tonic')).toBeInTheDocument()
    // seleziona 1 Mojito → il totale da incassare diventa la selezione
    await user.click(screen.getByRole('button', { name: 'Paga Mojito' }))
    expect(screen.getByText('Selezione da incassare')).toBeInTheDocument()
    expect(screen.getByText('7,00 €')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Contanti/ }))
    expect(registerPayment).toHaveBeenCalledWith('ord1', {
      amount: 7,
      method: 'banco',
      items: [expect.objectContaining({ drink_id: 'mojito', qty: 1 })],
    })
  })

  it('gli articoli già pagati spariscono dalla lista e restano nello storico', () => {
    mount(
      baseOrder({
        payment_status: 'parziale',
        payments: [
          {
            id: 'p1',
            amount: 14,
            method: 'banco',
            at: '2026-07-12T21:00:00.000Z',
            items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 }],
          },
        ],
      })
    )
    // il Mojito è saldato: resta solo il Gin Tonic da pagare
    expect(screen.queryByText('Mojito')).not.toBeInTheDocument()
    expect(screen.getByText('Gin Tonic')).toBeInTheDocument()
    expect(screen.getByText('GIÀ PAGATO')).toBeInTheDocument()
    expect(screen.getByText('Già pagato')).toBeInTheDocument()
    // residuo = 22 − 14
    expect(screen.getByText('8,00 €')).toBeInTheDocument()
  })
})

describe('sconto: percentuale o in euro sul conto', () => {
  it('digitando 10 e Applica (in %) salva lo sconto', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.type(screen.getByLabelText('Sconto'), '10')
    await user.click(screen.getByRole('button', { name: 'Applica' }))
    expect(setOrderDiscount).toHaveBeenCalledWith('ord1', { type: 'percent', value: 10 })
  })

  it('in euro: il toggle € cambia il tipo di sconto', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.type(screen.getByLabelText('Sconto'), '5')
    await user.click(screen.getByRole('button', { name: '€' }))
    await user.click(screen.getByRole('button', { name: 'Applica' }))
    expect(setOrderDiscount).toHaveBeenCalledWith('ord1', { type: 'euro', value: 5 })
  })

  it('lo sconto applicato riduce il residuo mostrato', () => {
    mount(baseOrder({ discount: { type: 'percent', value: 10 }, discount_amount: 2.2 }))
    expect(screen.getByText('Sconto applicato')).toBeInTheDocument()
    expect(screen.getByText('19,80 €')).toBeInTheDocument()
  })
})

describe('preconto e stato del conto', () => {
  it('"Stampa preconto" stampa lo scontrino non fiscale del conto', async () => {
    const user = userEvent.setup()
    const order = baseOrder()
    mount(order)
    await user.click(screen.getByRole('button', { name: /Stampa preconto/ }))
    expect(printScontrino).toHaveBeenCalledWith(order)
    expect(registerPayment).not.toHaveBeenCalled()
  })

  it('conto pagato: metodi nascosti e conferma visibile', () => {
    mount(baseOrder({ payment_status: 'pagato', status: 'pagato' }))
    expect(screen.queryByRole('button', { name: /Contanti/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Conto pagato e chiuso/)).toBeInTheDocument()
  })
})
