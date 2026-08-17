// @vitest-environment happy-dom
'use strict'

// Test di COMPONENTE della schermata Pagamento in stile POS SumUp:
// articoli a SINISTRA (split per deselezione), tastierino calcolatrice e
// "Riscuotere" al CENTRO, metodi di pagamento e Sconto a DESTRA.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/lib/api.js', () => ({
  registerPayment: vi.fn(() => Promise.resolve({ closed: false })),
  markOrderPaid: vi.fn(() => Promise.resolve()),
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
  subscribeVouchers: vi.fn((cb) => {
    cb(mockVouchers)
    return () => {}
  }),
  applyVoucherDiscount: vi.fn(() => Promise.resolve({ redeemed: 10 })),
}))
vi.mock('../../src/lib/paymentsApi.js', () => ({
  readerCheckout: vi.fn(() => Promise.resolve({})),
}))
vi.mock('../../src/lib/printer.js', () => ({
  printScontrino: vi.fn(() => Promise.resolve()),
  printFattura: vi.fn(() => Promise.resolve()),
  loadPrinterSettings: vi.fn(() => ({ ivaRate: 10, businessName: 'La Tana' })),
  // Guardia "una copia sola per conto": nei test lascia sempre passare.
  claimReceiptPrint: vi.fn(() => true),
}))
vi.mock('../../src/lib/toast.js', () => ({ toastError: vi.fn() }))

import PaymentScreen from '../../src/components/PaymentScreen.jsx'
import { toastError } from '../../src/lib/toast.js'
import {
  registerPayment,
  setOrderDiscount,
  setOrderLotteryCode,
  createInvoice,
} from '../../src/lib/api.js'
import { readerCheckout } from '../../src/lib/paymentsApi.js'
import { applyVoucherDiscount } from '../../src/lib/api.js'
import { printScontrino, printFattura, loadPrinterSettings } from '../../src/lib/printer.js'

let mockVouchers = []

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

beforeEach(() => {
  vi.clearAllMocks()
  mockVouchers = []
})

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
      autoServe: false,
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
      autoServe: false,
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
      autoServe: false,
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
      autoServe: false,
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
      autoServe: false,
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

  // Il motivo stava scritto sotto al tasto e occupava una riga a una
  // schermata che ne ha poche. Ora il tasto è spento e basta: il perché lo
  // dice se lo si tocca.
  // La gestione preparazione si può spegnere (Impostazioni): senza, non
  // esistono comande "da servire" e l'avviso era un allarme che non voleva
  // dire niente, a ogni singolo incasso.
  it('gestione preparazione SPENTA: niente avviso sulle comande da servire', () => {
    mount(baseOrder(), { ...noReader, workflow_enabled: false })
    expect(screen.queryByText(/Comande non ancora servite/)).toBeNull()
  })

  it('gestione preparazione ACCESA: l’avviso c’è, il conto si chiude servendo tutto', () => {
    mount(baseOrder({ comande: [{ id: 'c1', seq: 1, status: 'in_preparazione', items: [
      { drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 },
    ] }] }))
    expect(screen.getByText(/Comande non ancora servite/)).toBeInTheDocument()
  })

  // IL CONTO SI RISCUOTE SEMPRE, SI CHIUDE SOLO SE SERVITO. Ma al banco si
  // consegna e si incassa spesso nello stesso gesto: il locale può
  // accendere il tasto che fa le due cose insieme.
  const conComandaDaServire = () =>
    baseOrder({
      comande: [
        {
          id: 'c1',
          seq: 1,
          status: 'in_preparazione',
          items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 }],
        },
      ],
    })

  it('«Riscuoti e servi» c’è solo se il locale lo ha chiesto', () => {
    mount(conComandaDaServire())
    expect(screen.queryByRole('button', { name: /Riscuoti e servi/ })).toBeNull()
    cleanup()
    mount(conComandaDaServire(), { ...noReader, riscuoti_e_servi: true })
    expect(screen.getByRole('button', { name: /Riscuoti e servi/ })).toBeInTheDocument()
  })

  it('«Riscuoti e servi» incassa E serve; «Riscuotere» da solo no', async () => {
    const user = userEvent.setup()
    mount(conComandaDaServire(), { ...noReader, riscuoti_e_servi: true })
    await user.click(screen.getByRole('button', { name: /Riscuoti e servi/ }))
    expect(registerPayment).toHaveBeenCalledWith(
      'ord1',
      expect.objectContaining({ autoServe: true })
    )
    cleanup()
    vi.clearAllMocks()
    mount(conComandaDaServire(), { ...noReader, riscuoti_e_servi: true })
    await user.click(screen.getByRole('button', { name: /Riscuotere/ }))
    expect(registerPayment).toHaveBeenCalledWith(
      'ord1',
      expect.objectContaining({ autoServe: false })
    )
  })

  it('senza gli stati del servizio il tasto in più non serve', () => {
    // Lì incassare serve già tutto: due tasti direbbero la stessa cosa.
    mount(conComandaDaServire(), { ...noReader, workflow_enabled: false, riscuoti_e_servi: true })
    expect(screen.queryByRole('button', { name: /Riscuoti e servi/ })).toBeNull()
  })

  it('lettore NON configurato: SumUp spento, senza sottotitolo sul tasto', () => {
    mount(baseOrder())
    expect(screen.getByRole('button', { name: /Carta di Credito/ })).toBeInTheDocument()
    const sumup = screen.getByRole('button', { name: /SumUp/ })
    expect(sumup).toHaveClass('spento')
    expect(sumup).toHaveAttribute('aria-disabled', 'true')
    expect(sumup).not.toHaveTextContent(/Impostazioni/)
  })

  it('toccando SumUp spento si legge perché, e il metodo non cambia', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /SumUp/ }))
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/Impostazioni → Pagamenti/))
    // Resta selezionato il contante: un tasto spento non cambia l'incasso.
    expect(screen.getByRole('button', { name: /Contante/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('Buono come sconto: senza buoni l’opzione 🎟 è spenta nel modale sconto', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Sconto/ }))
    const modal = within(screen.getByRole('dialog', { name: 'Sconto' }))
    expect(modal.getByRole('button', { name: '🎟' })).toBeDisabled()
    // niente più metodo di pagamento "Buono VIP"
    expect(screen.queryByRole('button', { name: /Buono VIP/ })).not.toBeInTheDocument()
  })

  it('Buono come sconto: scelto il beneficiario, si applica come sconto dal saldo', async () => {
    mockVouchers = [{ id: 'v1', holder_name: 'Marco', balance: 10 }]
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Sconto/ }))
    const modal = within(screen.getByRole('dialog', { name: 'Sconto' }))
    await user.click(modal.getByRole('button', { name: '🎟' }))
    await user.selectOptions(modal.getByLabelText(/Buono di/), 'v1')
    // saldo 10 < dovuto 22 → si applicano 10 di sconto attingendo al buono
    expect(modal.getByText(/Dal buono: −10,00 €/)).toBeInTheDocument()
    await user.click(modal.getByRole('button', { name: /Applica/ }))
    expect(applyVoucherDiscount).toHaveBeenCalledWith('ord1', 'v1', 10)
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

  // Il tastierino dello sconto riusava la griglia del pagamento, che ha quattro
  // colonne per far posto agli operatori: le cifre andavano a capo dove capitava
  // (7 8 9 4 / 5 6 1 2 / 3 C 0 ←) e al banco non si trovava più niente.
  it('le cifre stanno in ordine da tastierino, su tre colonne', async () => {
    const user = userEvent.setup()
    const { container } = mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Sconto/ }))
    const pad = container.querySelector('.paypad-cifre')
    expect(pad).toBeTruthy()
    expect([...pad.querySelectorAll('.paypad-key')].map((b) => b.textContent)).toEqual([
      '7', '8', '9',
      '4', '5', '6',
      '1', '2', '3',
      'C', '0', '←',
    ])
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

// LO SCONTRINO DEVE DIRE COME SI È PAGATO.
// Segnalato dal locale: "il conteggio lo fa di carta, ma lo scontrino esce
// sempre contanti". La registrazione va in background, quindi al momento della
// stampa l'ordine non sa ancora com'è stato pagato: la stampa ripiegava sul
// contante, che è una dichiarazione falsa e non un default.
describe('scontrino: il metodo di pagamento', () => {
  // Lo scontrino a fine incasso esce solo con l'auto-stampa accesa.
  beforeEach(() => {
    loadPrinterSettings.mockReturnValue({
      ivaRate: 10,
      businessName: 'La Tana',
      autoPrintScontrino: true,
    })
  })

  it('con la carta lo scontrino esce con la carta', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Carta di Credito/ }))
    await user.click(screen.getByRole('button', { name: /Riscuotere/ }))
    await waitFor(() => expect(printScontrino).toHaveBeenCalled())
    const stampato = printScontrino.mock.calls.at(-1)[0]
    expect(stampato.payment_method).toBe('carta')
    expect(stampato.payments.at(-1).method).toBe('carta')
  })

  it('coi contanti resta contanti', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Contante/ }))
    await user.click(screen.getByRole('button', { name: /Riscuotere/ }))
    await waitFor(() => expect(printScontrino).toHaveBeenCalled())
    const stampato = printScontrino.mock.calls.at(-1)[0]
    expect(stampato.payment_method).toBe('banco')
  })
})

// ── Due righe dello stesso prodotto ──────────────────────────────────
// Difetto visto in produzione: con «Negroni, Coca Cola, Negroni», premere
// «+» sul primo Negroni alzava anche il secondo. La selezione era per
// PRODOTTO e le due righe condividevano il contatore: si incassava una
// quantità che nessuno aveva scelto.
describe('due righe uguali si muovono una per volta', () => {
  const dueNegroni = () =>
    baseOrder({
      total: 19,
      comande: [],
      order_items: [
        { drink_id: 'negroni', name: 'Negroni', unit_price: 8, qty: 1 },
        { drink_id: 'coca', name: 'Coca Cola', unit_price: 3, qty: 1 },
        { drink_id: 'negroni', name: 'Negroni', unit_price: 8, qty: 1, custom: true },
      ],
    })

  it('togliendo il primo Negroni, il secondo resta in pagamento', async () => {
    const user = userEvent.setup()
    mount(dueNegroni())
    // Si apre con tutto selezionato: 8 + 3 + 8.
    expect(payAmount()).toHaveTextContent('19,00')
    const togli = screen.getAllByRole('button', { name: /Togli Negroni dal pagamento/ })
    expect(togli).toHaveLength(2)
    await user.click(togli[0])
    // Se si muovessero insieme resterebbero solo 3,00 €.
    expect(payAmount()).toHaveTextContent('11,00')
  })

  it('e si incassa solo la riga scelta', async () => {
    const user = userEvent.setup()
    mount(dueNegroni())
    const togli = screen.getAllByRole('button', { name: /Togli Negroni dal pagamento/ })
    await user.click(togli[0])
    await user.click(screen.getByRole('button', { name: /Riscuotere/ }))
    const [, dati] = registerPayment.mock.calls.at(-1)
    expect(dati.amount).toBe(11)
    // Un solo Negroni nel dettaglio dell'incasso.
    const negroni = dati.items.filter((i) => i.drink_id === 'negroni')
    expect(negroni).toHaveLength(1)
    expect(negroni[0].qty).toBe(1)
  })
})

// IL CASO DEL VIDEO (#45): due Negroni «liberi/modificati» (la ✨), ognuno
// 1×, e in mezzo una Coca. Righe che NON si accorpano mai — quindi niente
// tasto «Separa uguali», e prima premendo + su uno si muovevano tutti e due.
describe('due prodotti liberi uguali, come nel conto #45', () => {
  const comeNelVideo = () =>
    baseOrder({
      total: 15,
      comande: [],
      order_items: [
        { drink_id: 'negroni', name: 'NEGRONI', unit_price: 6, qty: 1, custom: true },
        { drink_id: 'coca', name: 'COCA ZERO VETRO', unit_price: 3, qty: 1, custom: true },
        { drink_id: 'negroni', name: 'NEGRONI', unit_price: 6, qty: 1, custom: true },
      ],
    })

  it('il tasto «Separa uguali» non c’è: non c’è niente da separare', () => {
    mount(comeNelVideo())
    expect(screen.queryByRole('button', { name: /Separa uguali/ })).toBeNull()
    // Tre righe distinte, ognuna col suo contatore.
    expect(screen.getAllByRole('button', { name: /Paga NEGRONI/ })).toHaveLength(2)
  })

  it('il + su un NEGRONI muove solo quello', async () => {
    const user = userEvent.setup()
    mount(comeNelVideo())
    // Si parte da tutto selezionato: si toglie tutto e si riprende un solo
    // Negroni, come nel video (0/1 su tutte le righe).
    for (const b of screen.getAllByRole('button', { name: /Togli .* dal pagamento/ })) {
      await user.click(b)
    }
    expect(payAmount()).toHaveTextContent('0,00')
    await user.click(screen.getAllByRole('button', { name: /Paga NEGRONI/ })[0])
    // Se si muovessero insieme sarebbero 12,00 €.
    expect(payAmount()).toHaveTextContent('6,00')
  })

  // Prodotti liberi veri: senza nemmeno un id di catalogo.
  it('anche due voci libere senza prodotto restano indipendenti', async () => {
    const user = userEvent.setup()
    mount(
      baseOrder({
        total: 10,
        comande: [],
        order_items: [
          { drink_id: null, name: 'Extra', unit_price: 5, qty: 1, custom: true },
          { drink_id: null, name: 'Extra', unit_price: 5, qty: 1, custom: true },
        ],
      })
    )
    expect(payAmount()).toHaveTextContent('10,00')
    await user.click(screen.getAllByRole('button', { name: /Togli Extra dal pagamento/ })[0])
    expect(payAmount()).toHaveTextContent('5,00')
  })
})

// «Separa uguali» mostra le unità come le altre righe: nome, prezzo e il
// contatore −/+. Prima erano caselline da spuntare, e nella stessa colonna
// convivevano due modi diversi di dire la stessa cosa.
describe('vista separata: righe come tutte le altre', () => {
  it('separando due Mojito si vedono due righe col contatore, non caselle', async () => {
    const user = userEvent.setup()
    mount(baseOrder()) // Mojito 2× + Gin Tonic
    await user.click(screen.getByRole('button', { name: /Separa uguali/ }))
    // Due unità di Mojito, ognuna col suo −/+ e il suo 1/1.
    expect(screen.getAllByRole('button', { name: /Togli Mojito dal pagamento/ })).toHaveLength(2)
    expect(screen.getAllByText('1/1').length).toBeGreaterThanOrEqual(3)
    expect(screen.queryByText(/☑/)).toBeNull()
  })

  it('togliendo una sola unità si incassa solo l’altra', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Separa uguali/ }))
    // La seconda unità di Mojito esce dal pagamento: 22 − 7 = 15.
    await user.click(screen.getAllByRole('button', { name: /Togli Mojito dal pagamento/ })[1])
    expect(payAmount()).toHaveTextContent('15,00')
  })
})

// DUE MODI DI INCASSARE, E VANNO DISTINTI. Scegliere le righe compone il
// totale e copre esattamente quelle; battere un importo a mano è un
// ACCONTO, che resta sul conto e non copre niente in particolare. Il
// meccanismo c'era, ma le righe col −/+ sembravano un riepilogo: chi non lo
// sapeva batteva l'importo a mano e poi non capiva cosa fosse stato pagato.
describe('righe scelte o importo a mano', () => {
  it('scegliendo le righe il totale si compone, e si vede da dove viene', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    // Si toglie una unità di Mojito dalla selezione (parte tutto scelto):
    // il totale cala di 7 e l'etichetta dice che sono righe.
    await user.click(screen.getByRole('button', { name: /Togli Mojito dal pagamento/ }))
    expect(await screen.findByText(/RIGHE SCELTE/)).toBeInTheDocument()
    expect(payAmount()).toHaveTextContent('15,00')
  })

  it('un importo a mano si chiama col suo nome, e dice che resta sul conto', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: '1' }))
    await user.click(screen.getByRole('button', { name: '0' }))
    await user.click(screen.getByRole('button', { name: '0' }))
    await user.click(screen.getByRole('button', { name: '0' }))
    expect(screen.getByText('IMPORTO A MANO')).toBeInTheDocument()
    expect(screen.getByText(/Acconto: resta sul conto/)).toBeInTheDocument()
  })
})

// SEPARANDO LE UGUALI SI TOGLIE UNA UNITÀ ALLA VOLTA. Il «−» scriveva la
// nuova quantità come «tutte quelle prima di questa»: premuto sulla PRIMA
// di tre le spegneva tutte e tre insieme, e chi stava dividendo il conto si
// ritrovava da capo.
describe('separa uguali: una unità alla volta', () => {
  it('togliendo la prima, le altre restano scelte', async () => {
    const user = userEvent.setup()
    // Due Mojito sulla stessa riga: separandoli diventano due unità.
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Separa uguali/ }))
    const meno = screen.getAllByRole('button', { name: /Togli Mojito dal pagamento/ })
    expect(meno).toHaveLength(2)
    await user.click(meno[0])
    // Una sola unità è uscita dal pagamento: il totale cala di 7, non di 14.
    expect(payAmount()).toHaveTextContent('15,00')
  })

  it('e si rimette dentro una alla volta', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Separa uguali/ }))
    await user.click(screen.getAllByRole('button', { name: /Togli Mojito dal pagamento/ })[0])
    // Le unità sono identiche: quella rimessa dentro è la prima libera.
    const piu = screen
      .getAllByRole('button', { name: /Paga Mojito/ })
      .find((b) => !b.disabled)
    await user.click(piu)
    expect(payAmount()).toHaveTextContent('22,00')
  })
})
