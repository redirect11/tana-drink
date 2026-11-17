// @vitest-environment happy-dom
'use strict'

// LA CASSA IN INGLESE NON HA ITALIANO A SCHERMO (REQ-UI-039).
//
// Daniele, 17/11/2026: la lingua del gestionale la sceglie chi ci lavora,
// qualunque ruolo. La schermata di pagamento, l'apertura e la chiusura della
// cassa sono quelle che si usano col locale pieno: con la lingua inglese
// non deve restarci una parola d'italiano — né un testo passato da `tr` che
// non trova la sua traduzione, né uno che `tr` non l'ha mai visto.
//
// Si aprono le schermate così come le vede chi incassa, con i casi che
// mostrano più testo (conto in parte pagato, resto in contanti, sconto,
// impagato, cassa bloccata da un conto aperto), e si chiede a
// `italianoRimasto` cosa è rimasto. I dati finti non hanno parole italiane:
// «Negroni», «Spritz», «Mario».
//
// Lo scontrino e la chiusura su carta restano in italiano apposta: sono
// documenti fiscali, e qui non si stampano.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { CON_LICENZA } from '../helpers/licenza.js'
import { italianoRimasto } from '../helpers/nienteItaliano.js'

const SESSIONE = {
  id: 'sessione-1',
  status: 'open',
  opened_at: '2026-08-27T17:00:00.000Z',
  fondo_cassa: 50,
}
let sessione = SESSIONE
// Chi ascolta la sessione: lo stato della cassa nel pagamento è condiviso a
// livello di modulo (lib/cashSession.js) e si iscrive una volta sola, quindi
// per chiudere la cassa a metà file glielo si dice da qui.
const ascoltiCassa = new Set()

const PAGATO = {
  id: 'c1',
  status: 'chiuso',
  payment_status: 'pagato',
  payment_method: 'banco',
  total: 30,
  coperti: 2,
  closed_in_session: SESSIONE.id,
  paid_at: '2026-08-27T20:00:00.000Z',
  created_at: '2026-08-27T19:50:00.000Z',
  comande: [],
}
const APERTO = {
  id: 'c3',
  status: 'aperto',
  payment_status: 'non_richiesto',
  total: 18,
  created_at: '2026-08-27T22:00:00.000Z',
  comande: [],
}
let conti = [PAGATO]

vi.mock('../../src/lib/api.js', () => ({
  DEFAULT_SETTINGS: { business_day_cutoff_hour: 5 },
  settingsIniziali: () => ({}),
  subscribeSettings: (cb) => {
    cb({ business_day_cutoff_hour: 5 })
    return () => {}
  },
  subscribeOpenCashSession: (cb) => {
    ascoltiCassa.add(cb)
    cb(sessione)
    return () => ascoltiCassa.delete(cb)
  },
  subscribeActiveOrders: (cb) => {
    cb(conti)
    return () => {}
  },
  openCashSession: vi.fn(() => Promise.resolve()),
  closeCashSession: vi.fn(),
  registerPayment: vi.fn(() => Promise.resolve({ closed: false })),
  markOrderPaid: vi.fn(() => Promise.resolve()),
  setOrderDiscount: vi.fn(() => Promise.resolve()),
  setOrderLotteryCode: vi.fn(() => Promise.resolve()),
  createInvoice: vi.fn(() => Promise.resolve({})),
  markInvoiceSent: vi.fn(() => Promise.resolve()),
  subscribeVouchers: (cb) => {
    cb([])
    return () => {}
  },
  applyVoucherDiscount: vi.fn(() => Promise.resolve({})),
  segnaScontrinoStampato: vi.fn(),
  chiudiImpagato: vi.fn(() => Promise.resolve({})),
}))
vi.mock('../../src/lib/paymentsApi.js', () => ({ readerCheckout: vi.fn(() => Promise.resolve({})) }))
vi.mock('../../src/lib/printer.js', () => ({
  printScontrino: vi.fn(() => Promise.resolve()),
  printScontrinoAcconto: vi.fn(() => Promise.resolve()),
  printFattura: vi.fn(() => Promise.resolve()),
  printChiusuraCassa: vi.fn(() => Promise.resolve()),
  loadPrinterSettings: () => ({ businessName: 'Bar' }),
  scontrinoAutomatico: () => false,
  aliquotaScontrino: () => 10,
  claimReceiptPrint: () => true,
  reclaimReceiptPrint: () => true,
  releaseReceiptPrint: vi.fn(),
  scontrinoGiaUscito: () => false,
  datiFiscaliDelLocale: () => ({}),
}))
vi.mock('../../src/lib/toast.js', () => ({ showToast: vi.fn(), toastError: vi.fn(), toastSuccess: vi.fn() }))
vi.mock('../../src/lib/staffApi.js', () => ({
  staffFromCache: () => [],
  listStaff: vi.fn(async () => []),
}))
vi.mock('../../src/lib/firebaseClient.js', () => ({
  isFirebaseConfigured: true,
  auth: { currentUser: { email: 'mario@bar.test', uid: 'u1' } },
  db: {},
}))

const { default: PaymentScreen } = await import('../../src/components/PaymentScreen.jsx')
const { default: CashFlow } = await import('../../src/components/CashFlow.jsx')
const { default: ApriCassaBox } = await import('../../src/components/ApriCassaBox.jsx')
const { default: ChiudiCassaBox } = await import('../../src/components/ChiudiCassaBox.jsx')
const { impostaLingua } = await import('../../src/lib/lingua.js')

// Un conto in parte già pagato con un acconto, due Negroni da separare e
// uno Spritz, a un tavolo: è la testata e la colonna con più parole.
const conto = (over = {}) => ({
  id: 'ord1',
  daily_number: 4,
  status: 'aperto',
  payment_status: 'non_richiesto',
  table_label: '4',
  customer_name: 'Mario',
  total: 22,
  discount: null,
  discount_amount: 0,
  payments: [{ amount: 5, method: 'banco', at: '2026-08-27T20:00:00.000Z' }],
  comande: [
    {
      id: 'c1',
      seq: 1,
      status: 'in_preparazione',
      items: [
        { drink_id: 'negroni', name: 'Negroni', unit_price: 7, qty: 2 },
        { drink_id: 'spritz', name: 'Spritz', unit_price: 8, qty: 1 },
      ],
    },
  ],
  ...over,
})

// Il locale con tutti i tasti accesi: resto in contanti, «senza stampa»,
// «riscuoti e servi», e la preparazione seguita.
const IMPOSTAZIONI = {
  ...CON_LICENZA,
  payments_reader_enabled: false,
  sumup_reader_id: null,
  resto_contanti: true,
  riscuoti_senza_stampa: true,
  riscuoti_e_servi: true,
}

const paga = (order = conto()) =>
  render(<PaymentScreen order={order} settings={IMPOSTAZIONI} onClose={vi.fn()} onBeforePay={vi.fn()} />)

beforeEach(() => {
  localStorage.clear()
  sessione = SESSIONE
  conti = [PAGATO]
  impostaLingua('en')
})

afterEach(() => {
  cleanup()
  ascoltiCassa.forEach((cb) => cb(SESSIONE))
  impostaLingua('it')
})

describe('la schermata di pagamento in inglese', () => {
  it('il conto, il tastierino e i metodi', async () => {
    const { container } = paga()
    expect(await screen.findByRole('dialog', { name: 'Payment' })).toBeInTheDocument()
    expect(screen.getByText('ALREADY PAID')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('un importo battuto a mano: acconto e resto', async () => {
    const user = userEvent.setup()
    const { container } = paga()
    // 50,00 € battuti su un dovuto di 17,00 €: c'è il resto.
    for (const c of ['5', '0', '0', '0']) await user.click(screen.getByRole('button', { name: c }))
    expect(screen.getByText('MANUAL AMOUNT')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
    // 3,00 €: meno del dovuto, è un acconto.
    await user.click(screen.getByRole('button', { name: 'C' }))
    for (const c of ['3', '0', '0']) await user.click(screen.getByRole('button', { name: c }))
    expect(screen.getByText(/^Deposit:/)).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('nessuna riga scelta', async () => {
    const user = userEvent.setup()
    const { container } = paga()
    await user.click(screen.getByRole('button', { name: 'Deselect all' }))
    expect(screen.getByText('NO LINES SELECTED')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('la finestra dello sconto', async () => {
    const user = userEvent.setup()
    paga()
    await user.click(screen.getByRole('button', { name: /Discount/ }))
    const finestra = screen.getByRole('dialog', { name: 'Discount' })
    expect(italianoRimasto(finestra)).toEqual([])
  })

  it('la finestra dell’impagato', async () => {
    const user = userEvent.setup()
    paga()
    await user.click(screen.getByRole('button', { name: /Unpaid/ }))
    const finestra = screen.getByRole('dialog', { name: 'Close unpaid' })
    expect(italianoRimasto(finestra)).toEqual([])
  })

  it('la finestra del codice lotteria', async () => {
    const user = userEvent.setup()
    paga()
    await user.click(screen.getByRole('button', { name: /Lottery code/ }))
    expect(italianoRimasto(screen.getByRole('dialog', { name: 'Lottery code' }))).toEqual([])
  })

  it('a cassa chiusa si legge il motivo', async () => {
    const { container } = paga()
    act(() => ascoltiCassa.forEach((cb) => cb(null)))
    expect(await screen.findByText(/Till closed/)).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('il conto già pagato', async () => {
    const { container } = paga(conto({ payment_status: 'pagato', payments: [] }))
    expect(await screen.findByText('Bill paid and closed.')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })
})

describe('aprire e chiudere la cassa in inglese', () => {
  it('il riquadro «apri la cassa»', async () => {
    const { container } = render(<ApriCassaBox cutoffHour={5} by={{ uid: 'u1' }} onClose={vi.fn()} />)
    // L'elenco dello staff arriva in sottofondo: si aspetta che sia arrivato.
    await act(async () => {})
    expect(screen.getByRole('button', { name: 'Open till' })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('il riquadro «chiudi la cassa», con la differenza sul contante', async () => {
    const user = userEvent.setup()
    const { container } = render(<ChiudiCassaBox by={{ email: 'mario@bar.test' }} onClose={vi.fn()} />)
    expect(await screen.findByRole('button', { name: 'Close till' })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
    await user.type(screen.getByLabelText(/Cash counted/), '90')
    expect(await screen.findByText(/more than expected/)).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('il riquadro «chiudi la cassa» bloccato da un conto aperto', async () => {
    conti = [PAGATO, APERTO]
    const { container } = render(<ChiudiCassaBox by={{ email: 'mario@bar.test' }} onClose={vi.fn()} />)
    expect(await screen.findByText(/Unpaid bills/)).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('il flusso di cassa, con la serata aperta e un conto da incassare', async () => {
    conti = [PAGATO, APERTO]
    const { container } = render(<CashFlow />)
    expect(await screen.findByText('Till open')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('il flusso di cassa a cassa chiusa', async () => {
    sessione = null
    const { container } = render(<CashFlow />)
    expect(await screen.findByText('Till closed')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })
})
