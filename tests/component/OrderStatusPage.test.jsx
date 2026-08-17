// @vitest-environment happy-dom
'use strict'

// CHI APRE UN ORDINE, COSA VEDE.
//
// Difetto vero: introdotto il ruolo admin, chi entrava in un ordine si
// trovava la schermata del CLIENTE (stato, stepper) invece del POS, perché
// il controllo era rimasto `viewerRole === 'bartender'`. Al banco vuol dire
// non poter più aggiungere un drink al conto.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'

const ORDINE = {
  id: 'o1',
  daily_number: 7,
  status: 'aperto',
  workflow_status: 'ricevuto',
  customer_name: 'Luigi',
  items: [{ drink_id: 'd1', name: 'Negroni', qty: 1, price: 8 }],
  // Come lo restituisce mapOrder: le righe normalizzate stanno in
  // order_items, ed è quello che la vista cliente somma.
  order_items: [{ drink_id: 'd1', name: 'Negroni', qty: 1, unit_price: 8 }],
  comande: [{ id: 'c1', seq: 1, status: 'ricevuto', items: [] }],
  total: 8,
  payments: [],
  // Ordine battuto al banco: è il caso in cui allo staff si offre il QR da
  // far scansionare al cliente.
  placed_by: { name: 'banco', email: 'banco@tana.local', role: 'admin' },
}

// Il ruolo di chi guarda, deciso dal singolo test.
let ruoloCorrente = null
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (a, cb) => {
    cb({
      uid: 'u1',
      email: 'capo@bar.it',
      getIdTokenResult: () => Promise.resolve({ claims: { role: ruoloCorrente } }),
    })
    return () => {}
  },
}))
vi.mock('../../src/lib/firebaseClient.js', () => ({
  auth: { currentUser: { uid: 'u1', email: 'capo@bar.it' } },
  db: {},
  functions: {},
}))
vi.mock('../../src/lib/api.js', async () => {
  const vero = await vi.importActual('../../src/lib/orderStatus.js')
  void vero
  return {
    DEFAULT_SETTINGS: { pickup_mode: 'bancone', groups_enabled: false },
    settingsIniziali: () => ({ pickup_mode: 'bancone', groups_enabled: false }),
    fetchOrder: vi.fn(() => Promise.resolve(ORDINE)),
    subscribeOrder: vi.fn((id, cb) => {
      cb(ORDINE)
      return () => {}
    }),
    subscribeSettings: vi.fn((cb) => {
      cb({ pickup_mode: 'bancone', groups_enabled: false, ...impostazioniCorrenti })
      return () => {}
    }),
    subscribeServiceStats: vi.fn((cb) => {
      cb({})
      return () => {}
    }),
    subscribeQueue: vi.fn((cb) => {
      cb([])
      return () => {}
    }),
    updateOrderItems: vi.fn(),
    updateOrderPushToken: vi.fn(),
    updateOrderStatus: vi.fn(),
    markOrderPaid: vi.fn(),
    cancelOrder: vi.fn(),
  }
})
vi.mock('../../src/lib/push.js', () => ({ getPushToken: vi.fn(() => Promise.resolve(null)) }))
vi.mock('../../src/lib/notify.js', () => ({
  ensureNotificationPermission: vi.fn(() => Promise.resolve(false)),
  notify: vi.fn(),
}))
vi.mock('../../src/lib/toast.js', () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  showToast: vi.fn(),
}))
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(() => Promise.resolve('data:,')) } }))
// Il POS vero è un componente enorme: qui interessa solo SE viene scelto.
vi.mock('../../src/components/OrderPosDetail.jsx', () => ({
  default: () => <div data-testid="pos">POS</div>,
}))

import OrderStatusPage from '../../src/pages/OrderStatusPage.jsx'
import { updateOrderItems } from '../../src/lib/api.js'
import { toastSuccess, toastError } from '../../src/lib/toast.js'

let impostazioniCorrenti = {}

const apri = () =>
  render(
    <MemoryRouter initialEntries={['/ordine/o1']}>
      <OrderStatusPage />
    </MemoryRouter>
  )

beforeEach(() => {
  vi.clearAllMocks()
  impostazioniCorrenti = {}
})

describe('dettaglio ordine: a ciascuno la sua schermata', () => {
  it("l'admin lavora sull'ordine (POS), non lo guarda soltanto", async () => {
    ruoloCorrente = 'admin'
    apri()
    await waitFor(() => expect(screen.getByTestId('pos')).toBeInTheDocument())
  })

  it('il bartender: come prima, POS', async () => {
    ruoloCorrente = 'bartender'
    apri()
    await waitFor(() => expect(screen.getByTestId('pos')).toBeInTheDocument())
  })

  it('lo staff di sala vede lo stato, non la cassa', async () => {
    ruoloCorrente = 'staff'
    apri()
    await waitFor(() => expect(screen.queryByTestId('pos')).toBeNull())
  })

  it('il cliente vede lo stato', async () => {
    ruoloCorrente = undefined
    apri()
    await waitFor(() => expect(screen.queryByTestId('pos')).toBeNull())
  })
})

// IL QR SERVE SE C'È QUALCOSA DA SEGUIRE. Il cliente lo scansiona per vedere
// a che punto è il suo drink: senza gli stati del servizio non c'è nessun
// punto da vedere — la pagina dice solo cosa ha ordinato — e offrirlo è
// promettere una cosa che non succede.
describe('il QR per il cliente', () => {
  it('con gli stati del servizio, la sala lo può mostrare', async () => {
    ruoloCorrente = 'staff'
    impostazioniCorrenti = { workflow_enabled: true }
    apri()
    expect(await screen.findByRole('button', { name: /Mostra QR/ })).toBeInTheDocument()
  })

  it('senza stati del servizio non compare: non ci sarebbe niente da seguire', async () => {
    ruoloCorrente = 'staff'
    impostazioniCorrenti = { workflow_enabled: false }
    apri()
    await waitFor(() => expect(screen.queryByRole('button', { name: /Mostra QR/ })).toBeNull())
  })
})

// SALVARE DEVE DIRE COM'È ANDATA. Il tasto tornava «Salva modifiche» e
// basta — identico a prima di premerlo — e chi aveva cambiato una quantità
// restava lì a chiedersi se fosse andata. E premendolo senza aver toccato
// niente si finiva nella finestra dell'ANNULLO: si chiede di salvare e ti
// viene chiesto se buttare il conto.
describe('salvare le modifiche a un ordine', () => {
  // È il CLIENTE che salva le quantità da qui: la sala ha «Modifica
  // ordine», che apre la schermata del conto (vedi sotto).
  it('salvando si conferma', async () => {
    const user = userEvent.setup()
    ruoloCorrente = undefined
    apri()
    await user.click(await screen.findByRole('button', { name: /Salva modifiche/ }))
    await waitFor(() => expect(updateOrderItems).toHaveBeenCalled())
    expect(toastSuccess).toHaveBeenCalledWith('Modifiche salvate')
  })

  it('e se il server rifiuta lo dice dove si vede, non solo in fondo', async () => {
    const user = userEvent.setup()
    ruoloCorrente = undefined
    updateOrderItems.mockRejectedValueOnce(new Error('Ordine già in preparazione'))
    apri()
    await user.click(await screen.findByRole('button', { name: /Salva modifiche/ }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringContaining('non salvate'))
    )
  })
})

// MODIFICARE VUOL DIRE POTER AGGIUNGERE. Nel dettaglio si cambiavano solo
// le quantità di quello che c'era già: chi ha preso l'ordine e si sente
// dire «aggiungi anche una birra» doveva battere un secondo conto.
describe('la sala modifica l’ordine', () => {
  it('«Modifica ordine» apre la schermata del conto, quella con la griglia', async () => {
    const user = userEvent.setup()
    ruoloCorrente = 'staff'
    apri()
    await user.click(await screen.findByRole('button', { name: /Modifica ordine/ }))
    expect(await screen.findByTestId('pos')).toBeInTheDocument()
  })

  it('e «Salva modifiche» resta: le quantità si correggono anche da qui', async () => {
    ruoloCorrente = 'staff'
    apri()
    expect(await screen.findByRole('button', { name: /Salva modifiche/ })).toBeInTheDocument()
  })

  it('e il «Pagamento» apre la stessa schermata, già sul pagamento', async () => {
    const user = userEvent.setup()
    ruoloCorrente = 'staff'
    apri()
    await user.click(await screen.findByRole('button', { name: /Pagamento/ }))
    expect(await screen.findByTestId('pos')).toBeInTheDocument()
  })

  it('al cliente la griglia non si offre: modifica le quantità e basta', async () => {
    ruoloCorrente = undefined
    apri()
    expect(await screen.findByRole('button', { name: /Salva modifiche/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Modifica ordine/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /💳 Pagamento/ })).toBeNull()
  })
})
