// @vitest-environment happy-dom
'use strict'

// L'ORDINE MODIFICATO DAL BANCO, IN CODA (REQ-CLI-009).
//
// Il banco ha cambiato prezzo o ingredienti di un ordine arrivato dal
// telefono, e il cliente deve accettare. Finché non risponde il conto si
// riconosce in coda (coi minuti che restano) e non va avanti: il drink si
// prepara quando lui ha detto sì. Scaduto il tempo, lo annulla la coda —
// che al banco è sempre aperta — come annullato dal cliente, senza il nome
// di chi aveva la coda davanti.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'

vi.mock('react-router-dom', async (orig) => {
  const vera = await orig()
  return { ...vera, useNavigate: () => vi.fn() }
})

let impostazioni = {}
let ordini = []

vi.mock('../../src/lib/firebaseClient.js', () => ({
  isFirebaseConfigured: true,
  auth: { currentUser: { uid: 'u1', email: 'capo@bar.it', displayName: 'Capo' } },
  db: {},
}))
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb({
      uid: 'u1',
      email: 'capo@bar.it',
      displayName: 'Capo',
      getIdTokenResult: async () => ({ claims: { role: 'admin' } }),
    })
    return () => {}
  },
}))

vi.mock('../../src/lib/api.js', () => ({
  // La coda dice «ci sono» e guarda chi c'è (legenda con le presenze):
  // qui non serve a niente, ma senza queste due la pagina non si monta.
  segnalaPresenza: () => {},
  subscribePresenze: () => () => {},
  DEFAULT_SETTINGS: {},
  settingsIniziali: () => ({ ...impostazioni }),
  subscribeSettings: (cb) => {
    cb({ ...impostazioni })
    return () => {}
  },
  subscribeActiveOrders: (cb) => {
    cb(ordini)
    return () => {}
  },
  subscribeOpenCashSession: (cb) => {
    cb({ id: 'cassa-1', status: 'open', opened_at: '2026-08-18T18:00:00.000Z' })
    return () => {}
  },
  subscribeMyCalls: (_uid, cb) => {
    cb([])
    return () => {}
  },
  ackStaffCall: vi.fn(() => Promise.resolve()),
  updateOrderStatus: vi.fn(() => Promise.resolve()),
  advanceComanda: vi.fn(() => Promise.resolve()),
  markOrderPaid: vi.fn(() => Promise.resolve()),
  cancelOrder: vi.fn(() => Promise.resolve()),
  restoreOrder: vi.fn(() => Promise.resolve()),
  createOrder: vi.fn(() => Promise.resolve({})),
  saveStaffToken: vi.fn(() => Promise.resolve()),
  rimuoviStaffToken: vi.fn(() => Promise.resolve()),
  clockOut: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../src/lib/push.js', () => ({ getPushToken: vi.fn(async () => null) }))
vi.mock('../../src/lib/toast.js', () => ({ showToast: vi.fn(), toastSuccess: vi.fn(), toastError: vi.fn() }))
vi.mock('../../src/lib/notify.js', () => ({
  ensureNotificationPermission: vi.fn(async () => false),
  notify: vi.fn(),
}))
vi.mock('../../src/lib/beep.js', () => ({ beep: vi.fn(), installAudioUnlock: vi.fn() }))
vi.mock('../../src/lib/printer.js', () => ({
  printComanda: vi.fn(async () => {}),
  printScontrino: vi.fn(async () => {}),
  loadPrinterSettings: vi.fn(() => ({})),
  claimReceiptPrint: vi.fn(() => false),
}))
vi.mock('../../src/lib/paymentsApi.js', () => ({
  readerCheckout: vi.fn(async () => ({})),
  readerTerminate: vi.fn(async () => {}),
}))
vi.mock('../../src/lib/staffApi.js', () => ({ preloadStaff: vi.fn() }))
vi.mock('../../src/lib/pendingOrders.js', () => ({
  subscribePending: (cb) => {
    cb({ pending: [], banners: [] })
    return () => {}
  },
  dismissPending: vi.fn(),
  dismissBanner: vi.fn(),
}))

// Il resto del gestionale non è in prova qui: montarlo vorrebbe dire
// montare mezza app di finzioni.
vi.mock('../../src/components/MenuManager.jsx', () => ({ default: () => <div>menu</div> }))
vi.mock('../../src/components/PrinterSetup.jsx', () => ({ default: () => <div>stampante</div> }))
vi.mock('../../src/components/InventoryManager.jsx', () => ({ default: () => <div>inventario</div> }))
vi.mock('../../src/components/SettingsTab.jsx', () => ({ default: () => <div>impostazioni</div> }))
vi.mock('../../src/components/StatsTab.jsx', () => ({ default: () => <div>statistiche</div> }))
vi.mock('../../src/components/StaffHoursTab.jsx', () => ({ default: () => <div>ore</div> }))
vi.mock('../../src/components/UtentiTab.jsx', () => ({ default: () => <div>utenti</div> }))
vi.mock('../../src/components/VipTab.jsx', () => ({ default: () => <div>vip</div> }))
vi.mock('../../src/components/StaffCallList.jsx', () => ({ default: () => <div>chiamate</div> }))
vi.mock('../../src/components/CassaTab.jsx', () => ({ default: () => <div>cassa</div> }))
vi.mock('../../src/components/InvoicesTab.jsx', () => ({ default: () => <div>fatture</div> }))
vi.mock('../../src/components/DevTools.jsx', () => ({ default: () => <div>dev</div> }))
vi.mock('../../src/components/StaffDrawer.jsx', () => ({ default: () => <div>menu laterale</div> }))
vi.mock('../../src/components/GroupsPanel.jsx', () => ({ default: () => <div>gruppi</div> }))
vi.mock('../../src/components/GroupView.jsx', () => ({ default: () => <div>gruppo</div> }))
vi.mock('../../src/components/ApriCassaBox.jsx', () => ({ default: () => <div>apri cassa</div> }))
vi.mock('../../src/components/ChiudiCassaBox.jsx', () => ({ default: () => <div>chiudi cassa</div> }))
vi.mock('../../src/components/PallinoStampante.jsx', () => ({ default: () => <div>pallino</div> }))
vi.mock('../../src/components/StatusBell.jsx', () => ({ default: () => <div>campanella</div> }))

import BartenderPage from '../../src/pages/BartenderPage.jsx'
import { cancelOrder, updateOrderStatus } from '../../src/lib/api.js'
import { showToast } from '../../src/lib/toast.js'

const fra = (min) => new Date(Date.now() + min * 60000).toISOString()

// Un ordine dal telefono che il banco ha appena cambiato: il cliente ha
// ancora qualche minuto per rispondere.
const inAttesa = (scade = fra(6)) => ({
  id: 'o50',
  daily_number: 50,
  status: 'aperto',
  workflow_status: 'ricevuto',
  payment_status: 'non_richiesto',
  created_at: fra(-5),
  order_date: '2026-11-13',
  cash_session_id: 'cassa-1',
  total: 10,
  order_items: [{ id: 'i1', name: 'Gin Tonic', qty: 1, unit_price: 10, note: 'Gin: Mare' }],
  comande: [{ id: 'c1', seq: 1, status: 'ricevuto', created_at: fra(-5), items: [] }],
  placed_by: null,
  attesa_cliente: { dal: fra(-4), scade, totale_prima: 8 },
})

const apri = () =>
  render(
    <MemoryRouter>
      <BartenderPage />
    </MemoryRouter>
  )

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  ordini = [inAttesa()]
  impostazioni = {
    queue_view: 'lista',
    queue_search: 'filtra',
    workflow_enabled: true,
    groups_enabled: false,
    business_day_cutoff_hour: 6,
  }
})

describe('il conto che aspetta il cliente, in coda', () => {
  it('si riconosce, coi minuti che restano', async () => {
    apri()
    expect(await screen.findByText(/In attesa del cliente · 6 min/)).toBeInTheDocument()
  })

  it('non avanza: il drink si prepara quando il cliente ha accettato', async () => {
    const user = userEvent.setup()
    apri()
    await screen.findByText(/In attesa del cliente/)
    await user.click(screen.getByRole('button', { name: /Segna come/ }))
    expect(updateOrderStatus).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith('Il cliente deve ancora accettare le modifiche.', { kind: 'error' })
  })

  it('a tempo scaduto la coda lo annulla, a nome del cliente e senza firma', async () => {
    ordini = [inAttesa(fra(-1))]
    apri()
    await waitFor(() =>
      expect(cancelOrder).toHaveBeenCalledWith('o50', { by: 'cliente', kind: 'attesa_scaduta', persona: null })
    )
    // Una volta sola, anche se la coda si ridisegna.
    expect(cancelOrder).toHaveBeenCalledTimes(1)
  })

  it('prima del tempo non lo annulla nessuno', async () => {
    apri()
    await screen.findByText(/In attesa del cliente/)
    expect(cancelOrder).not.toHaveBeenCalled()
  })
})
