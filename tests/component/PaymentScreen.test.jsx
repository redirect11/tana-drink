// @vitest-environment happy-dom
'use strict'

// Test di COMPONENTE della schermata Pagamento in stile POS SumUp:
// articoli a SINISTRA (split per deselezione), tastierino calcolatrice e
// "Riscuotere" al CENTRO, metodi di pagamento e Sconto a DESTRA.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/lib/api.js', () => ({
  registerPayment: vi.fn(() => Promise.resolve({ closed: false })),
  setOrderDiscount: vi.fn(() => Promise.resolve()),
  setOrderLotteryCode: vi.fn(() => Promise.resolve()),
  createInvoice: vi.fn(() =>
    Promise.resolve({
      id: 'inv1',
      number: '1/2026',
      total: 22,
      items: [],
      customer: { denominazione: 'ACME srl', email: 'amministrazione@acme.it' },
    })
  ),
  markInvoiceSent: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../src/lib/paymentsApi.js', () => ({
  readerCheckout: vi.fn(() => Promise.resolve({})),
}))
vi.mock('../../src/lib/printer.js', () => ({
  printScontrino: vi.fn(() => Promise.resolve()),
  printFattura: vi.fn(() => Promise.resolve()),
  loadPrinterSettings: vi.fn(() => ({ ivaRate: 10, businessName: 'La Tana' })),
}))

import PaymentScreen from '../../src/components/PaymentScreen.jsx'
import {
  registerPayment,
  setOrderDiscount,
  setOrderLotteryCode,
  createInvoice,
} from '../../src/lib/api.js'
import { readerCheckout } from '../../src/lib/paymentsApi.js'
import { printScontrino, printFattura } from '../../src/lib/printer.js'

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
const withReader = { payments_reader_enabled: true, sumup_reader_id: 'reader1' }

function mount(order, settings = noReader) {
  return render(
    <PaymentScreen order={order} settings={settings} onClose={vi.fn()} onBeforePay={vi.fn()} />
  )
}

const payAmount = () => screen.getByTestId('pay-amount')

beforeEach(() => vi.clearAllMocks())

describe('layout POS: tutto già in pagamento, Riscuotere incassa', () => {
  it('si apre con il residuo intero e Riscuotere lo incassa in Contante', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    // sinistra: articoli con selezione piena; centro: importo = dovuto
    expect(screen.getByText('Mojito')).toBeInTheDocument()
    expect(screen.getByText('2/2')).toBeInTheDocument()
    expect(payAmount()).toHaveTextContent('22,00')
    // destra: Contante è il metodo di default
    expect(screen.getByRole('button', { name: /Contante/ })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: /Riscuotere/ }))
    expect(registerPayment).toHaveBeenCalledWith('ord1', {
      amount: 22,
      method: 'banco',
      items: null,
    })
  })

  it('split per deselezione: si incassa solo la selezione con il dettaglio articoli', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: 'Togli Mojito dal pagamento' }))
    await user.click(screen.getByRole('button', { name: 'Togli Gin Tonic dal pagamento' }))
    expect(payAmount()).toHaveTextContent('7,00')
    await user.click(screen.getByRole('button', { name: /Riscuotere/ }))
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
    expect(screen.queryByText('Mojito')).not.toBeInTheDocument()
    expect(screen.getByText('Gin Tonic')).toBeInTheDocument()
    expect(screen.getByText('GIÀ PAGATO')).toBeInTheDocument()
    // residuo = 22 − 14
    expect(payAmount()).toHaveTextContent('8,00')
  })
})

describe('tastierino calcolatrice', () => {
  it('digitando un importo libero si incassa quello (senza dettaglio articoli)', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    // "500" in centesimi → 5,00 €
    await user.click(screen.getByRole('button', { name: '5' }))
    await user.click(screen.getByRole('button', { name: '00' }))
    expect(payAmount()).toHaveTextContent('5,00')
    await user.click(screen.getByRole('button', { name: /Riscuotere/ }))
    expect(registerPayment).toHaveBeenCalledWith('ord1', {
      amount: 5,
      method: 'banco',
      items: null,
    })
  })

  it('/2 divide l\'importo corrente (split alla romana)', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: '/2' }))
    expect(payAmount()).toHaveTextContent('11,00')
  })

  it('oltre il dovuto: mostra il RESTO e incassa solo il residuo', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    // il cliente dà 25,00 €
    await user.click(screen.getByRole('button', { name: '2' }))
    await user.click(screen.getByRole('button', { name: '5' }))
    await user.click(screen.getByRole('button', { name: '00' }))
    expect(payAmount()).toHaveTextContent('25,00')
    expect(screen.getByText(/Resto:/)).toBeInTheDocument()
    expect(screen.getByText('3,00 €')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Riscuotere/ }))
    expect(registerPayment).toHaveBeenCalledWith('ord1', {
      amount: 22,
      method: 'banco',
      items: null,
    })
  })

  it('C annulla il digitato e torna all\'importo della selezione', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: '5' }))
    expect(payAmount()).toHaveTextContent('0,05')
    await user.click(screen.getByRole('button', { name: 'C' }))
    expect(payAmount()).toHaveTextContent('22,00')
  })
})

describe('metodi di pagamento', () => {
  it('Carta di Credito (POS esterno): registra l\'incasso con metodo carta', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Carta di Credito/ }))
    await user.click(screen.getByRole('button', { name: /Riscuotere/ }))
    expect(registerPayment).toHaveBeenCalledWith('ord1', {
      amount: 22,
      method: 'carta',
      items: null,
    })
  })

  it('SumUp (lettore Solo): selezionandolo, Riscuotere avvia readerCheckout', async () => {
    const user = userEvent.setup()
    mount(baseOrder(), withReader)
    await user.click(screen.getByRole('button', { name: /SumUp/ }))
    await user.click(screen.getByRole('button', { name: /Riscuotere/ }))
    expect(readerCheckout).toHaveBeenCalledWith('ord1', { amount: 22, items: null })
    expect(registerPayment).not.toHaveBeenCalled()
  })

  it('lettore NON configurato: SumUp c'è ma è spento, con la nota', () => {
    mount(baseOrder())
    expect(screen.getByRole('button', { name: /Carta di Credito/ })).toBeInTheDocument()
    const sumup = screen.getByRole('button', { name: /SumUp/ })
    expect(sumup).toBeDisabled()
    expect(sumup).toHaveTextContent(/configura il lettore/)
  })
})

describe('sconto: modale con tastierino', () => {
  it('percentuale: si digita sul tastierino della modale e si applica', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Sconto/ }))
    const modal = within(screen.getByRole('dialog', { name: 'Sconto' }))
    await user.click(modal.getByRole('button', { name: '1' }))
    await user.click(modal.getByRole('button', { name: '0' }))
    expect(modal.getByTestId('disc-amount')).toHaveTextContent('10%')
    expect(modal.getByText(/Sconto sul conto: −/)).toHaveTextContent('2,20 €') // anteprima su 22 €
    await user.click(modal.getByRole('button', { name: /Applica/ }))
    expect(setOrderDiscount).toHaveBeenCalledWith('ord1', { type: 'percent', value: 10 })
  })

  it('in euro: il toggle € interpreta le cifre come centesimi', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Sconto/ }))
    const modal = within(screen.getByRole('dialog', { name: 'Sconto' }))
    await user.click(modal.getByRole('button', { name: '€' }))
    await user.click(modal.getByRole('button', { name: '5' }))
    await user.click(modal.getByRole('button', { name: '0' }))
    await user.click(modal.getByRole('button', { name: '0' }))
    expect(modal.getByTestId('disc-amount')).toHaveTextContent('5,00')
    await user.click(modal.getByRole('button', { name: /Applica/ }))
    expect(setOrderDiscount).toHaveBeenCalledWith('ord1', { type: 'euro', value: 5 })
  })

  it('lo sconto applicato riduce il dovuto e si può rimuovere', async () => {
    const user = userEvent.setup()
    mount(baseOrder({ discount: { type: 'percent', value: 10 }, discount_amount: 2.2 }))
    expect(payAmount()).toHaveTextContent('19,80')
    await user.click(screen.getByRole('button', { name: /Sconto/ }))
    const modal = within(screen.getByRole('dialog', { name: 'Sconto' }))
    await user.click(modal.getByRole('button', { name: 'Rimuovi sconto' }))
    expect(setOrderDiscount).toHaveBeenCalledWith('ord1', null)
  })
})

describe('codice lotteria e fattura', () => {
  it('Codice Lotteria: modale, salva il codice in maiuscolo sul conto', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Codice Lotteria/ }))
    const modal = within(screen.getByRole('dialog', { name: 'Codice Lotteria' }))
    await user.type(modal.getByLabelText('Codice'), 'abcd1234')
    await user.click(modal.getByRole('button', { name: 'Salva codice' }))
    expect(setOrderLotteryCode).toHaveBeenCalledWith('ord1', 'ABCD1234')
  })

  it('Invia fattura: form dati cliente → emissione → invio/stampa', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Invia fattura/ }))
    const modal = within(screen.getByRole('dialog', { name: 'Invia fattura' }))
    await user.type(modal.getByLabelText(/Ragione sociale/), 'ACME srl')
    await user.type(modal.getByLabelText('Email'), 'amministrazione@acme.it')
    await user.click(modal.getByRole('button', { name: /Emetti fattura/ }))
    expect(createInvoice).toHaveBeenCalledWith({
      order: expect.objectContaining({ id: 'ord1' }),
      customer: expect.objectContaining({
        denominazione: 'ACME srl',
        email: 'amministrazione@acme.it',
      }),
      ivaRate: 10,
    })
    // emessa: numero visibile + stampa
    expect(await screen.findByText(/n\. 1\/2026/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Stampa fattura/ }))
    expect(printFattura).toHaveBeenCalledTimes(1)
  })
})

describe('preconto e stato del conto', () => {
  it('"Preconto" stampa lo scontrino non fiscale', async () => {
    const user = userEvent.setup()
    const order = baseOrder()
    mount(order)
    await user.click(screen.getByRole('button', { name: /Preconto/ }))
    expect(printScontrino).toHaveBeenCalledWith(order)
    expect(registerPayment).not.toHaveBeenCalled()
  })

  it('conto pagato: niente Riscuotere, conferma visibile', () => {
    mount(baseOrder({ payment_status: 'pagato', status: 'pagato' }))
    expect(screen.queryByRole('button', { name: /Riscuotere/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Conto pagato e chiuso/)).toBeInTheDocument()
  })
})
