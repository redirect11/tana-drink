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
      cb({ pickup_mode: 'bancone', groups_enabled: false })
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
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(() => Promise.resolve('data:,')) } }))
// Il POS vero è un componente enorme: qui interessa solo SE viene scelto.
vi.mock('../../src/components/OrderPosDetail.jsx', () => ({
  default: () => <div data-testid="pos">POS</div>,
}))

import OrderStatusPage from '../../src/pages/OrderStatusPage.jsx'

const apri = () =>
  render(
    <MemoryRouter initialEntries={['/ordine/o1']}>
      <OrderStatusPage />
    </MemoryRouter>
  )

beforeEach(() => vi.clearAllMocks())

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
