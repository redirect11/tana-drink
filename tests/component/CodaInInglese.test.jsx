// @vitest-environment happy-dom
'use strict'

// LA CODA IN INGLESE (REQ-UI-039). Daniele, 17/11/2026: la lingua del
// gestionale la sceglie chiunque, sul suo profilo — e la prima schermata
// che chi lavora vede, ogni sera, è la coda ordini. Qui la si apre in
// inglese, con qualche conto, insieme al menu laterale e al dialogo di
// annullo, e si chiede cosa è rimasto in italiano.
//
// Le prove della coda in italiano (CodaCorsie, UnaMemoriaLocale…) restano
// quelle di sempre: l'italiano è la lingua di partenza, e i loro testi non
// sono cambiati. Questa prova guarda solo l'altra lingua.
//
// I DATI FINTI NON HANNO PAROLE ITALIANE («Negroni», «Mario», numeri): il
// controllo cerca proprio quelle, e un nome di prodotto italiano lo farebbe
// scattare per un dato, non per un testo dimenticato.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'
import { italianoRimasto } from '../helpers/nienteItaliano.js'

let impostazioni = {}
let ordini = []

vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => vi.fn() }))
vi.mock('../../src/lib/firebaseClient.js', () => ({
  isFirebaseConfigured: true,
  auth: { currentUser: { uid: 'u1', email: 'mario@bar.it', displayName: 'Mario' } },
  db: {},
}))
let ruolo = 'admin'
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb({
      uid: 'u1',
      email: 'mario@bar.it',
      displayName: 'Mario',
      getIdTokenResult: async () => ({ claims: { role: ruolo } }),
    })
    return () => {}
  },
}))
vi.mock('../../src/lib/api.js', () => ({
  segnalaPresenza: vi.fn(),
  subscribePresenze: (cb) => {
    cb([])
    return () => {}
  },
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
    cb({ id: 'cassa-1', status: 'open', opened_at: '2026-08-16T18:00:00.000Z' })
    return () => {}
  },
  subscribeOpenGroups: (cb) => {
    cb([])
    return () => {}
  },
  createManualGroup: vi.fn(),
  chiamaIlBancone: vi.fn(),
  subscribeMieChiamateAlBancone: (_uid, cb) => {
    cb([])
    return () => {}
  },
  updateOrderStatus: vi.fn(() => Promise.resolve()),
  advanceComanda: vi.fn(() => Promise.resolve()),
  markOrderPaid: vi.fn(() => Promise.resolve()),
  cancelOrder: vi.fn(() => Promise.resolve()),
  restoreOrder: vi.fn(() => Promise.resolve()),
  segnaComandaStampata: vi.fn(),
  segnaScontrinoStampato: vi.fn(),
  setOrderColore: vi.fn(),
  saveStaffToken: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../src/lib/push.js', () => ({ getPushToken: vi.fn(async () => null) }))
vi.mock('../../src/lib/notify.js', () => ({
  ensureNotificationPermission: vi.fn(async () => false),
  notify: vi.fn(),
}))
vi.mock('../../src/lib/beep.js', () => ({ beep: vi.fn(), installAudioUnlock: vi.fn() }))
vi.mock('../../src/lib/printer.js', async (originale) => ({
  printComanda: vi.fn(async () => {}),
  printScontrino: vi.fn(async () => {}),
  loadPrinterSettings: vi.fn(() => ({})),
  scontrinoAutomatico: (await originale()).scontrinoAutomatico,
  reclaimReceiptPrint: vi.fn(() => false),
  releaseReceiptPrint: vi.fn(),
  scontrinoGiaUscito: vi.fn(() => false),
  salaStampaDaSe: () => true,
  preparaStampante: async () => ({ ok: true }),
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
vi.mock('../../src/lib/logout.js', () => ({ logoutStaff: vi.fn() }))
vi.mock('../../src/dev/devActions.js', () => ({ devToolsEnabled: false }))

// Le altre sezioni del gestionale non sono di questa prova: hanno la loro.
vi.mock('../../src/components/MenuManager.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/PrinterSetup.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/InventoryManager.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/SettingsTab.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/StatsTab.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/StaffHoursTab.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/UtentiTab.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/VipTab.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/CassaTab.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/InvoicesTab.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/DevTools.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/ApriCassaBox.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/ChiudiCassaBox.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/StaffCallList.jsx', () => ({ default: () => null }))
// Il menu laterale ha il suo caso qui sotto, montato da solo: dentro la
// pagina porterebbe con sé le voci di tutte le sezioni.
vi.mock('../../src/components/StaffDrawer.jsx', async (orig) => {
  const Vero = (await orig()).default
  return { default: (props) => (globalThis.__drawerVero ? <Vero {...props} /> : null) }
})

import BartenderPage from '../../src/pages/BartenderPage.jsx'
import CancelOrderDialog from '../../src/components/CancelOrderDialog.jsx'
import { impostaLingua } from '../../src/lib/lingua.js'

const ORA = '2026-08-16T21:00:00.000Z'
const conto = (patch) => ({
  status: 'aperto',
  payment_status: 'non_richiesto',
  created_at: ORA,
  order_date: '2026-08-16',
  cash_session_id: 'cassa-1',
  comande: [
    { id: `c-${patch.id}`, seq: 1, status: patch.workflow_status, created_at: ORA, items: patch.order_items },
  ],
  placed_by: { email: 'mario@bar.it', name: 'Mario', role: 'bartender' },
  ...patch,
})

const CODA = [
  conto({
    id: 'o41',
    daily_number: 41,
    workflow_status: 'in_preparazione',
    customer_name: 'Mario',
    total: 18,
    order_items: [{ id: 'i1', name: 'Negroni', qty: 2, unit_price: 9 }],
  }),
  conto({
    id: 'o42',
    daily_number: 42,
    workflow_status: 'in_preparazione',
    payment_status: 'parziale',
    payments: [{ amount: 5, method: 'contanti', at: ORA }],
    total: 9,
    order_items: [{ id: 'i2', name: 'Spritz', qty: 1, unit_price: 9 }],
  }),
]

function montaCoda() {
  return render(
    <MemoryRouter>
      <BartenderPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
  globalThis.__drawerVero = false
  ruolo = 'admin'
  ordini = CODA
  impostazioni = {
    queue_view: 'griglia',
    queue_search: 'filtra',
    workflow_enabled: true,
    groups_enabled: false,
    business_day_cutoff_hour: 6,
  }
  impostaLingua('en')
})

afterEach(() => impostaLingua('it'))

// QUELLO CHE RESTA IN ITALIANO NON È DI QUESTE SCHERMATE: sono testi scritti
// in src/lib (la voce della cassa in testata, lib/coda.js `voceCassa`; le
// voci del menu laterale, lib/sezioni.js) o in un componente di un'altra
// parte (VersionBadge). Si traducono là, segnandoli con `daTradurre`. La
// lista è ESATTA apposta: un testo nuovo dimenticato qui la fa diventare
// rossa, e quando la lib sarà tradotta diventa rossa lo stesso — ed è il
// segnale per svuotarla e tornare a `toEqual([])`.
const DALLA_CASSA_IN_LIB = [
  'dal dizionario: «Chiudi»', // «Chiudi cassa»
  'parola italiana: «Chiudi 2 conti e 2 comande»', // il perché, nel title
  'parola italiana: «Chiudi 2 conti e 2 comande»', // e scritto sotto il tasto
]
const DAL_MENU_IN_LIB = [
  'dal dizionario: «Stampa»', // la voce «Stampante» di lib/sezioni.js
  'parola italiana: «Versione pubblicata · build test\nTocca per copiare»', // VersionBadge
]

describe('la coda ordini in inglese (REQ-UI-039)', () => {
  it('la lavagna a griglia, coi suoi conti, parla inglese', async () => {
    const { container } = montaCoda()
    expect(await screen.findByText('In service')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New order' })).toBeInTheDocument()
    expect(screen.getByText('Deposit')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual(DALLA_CASSA_IN_LIB)
  })

  it('anche le azioni di una card, aperte col ⋯', async () => {
    const utente = userEvent.setup()
    const { container } = montaCoda()
    await screen.findByText('In service')
    const card = document.getElementById('ordine-o41')
    await utente.click(within(card).getByRole('button', { name: /Actions/ }))
    expect(within(card).getByRole('button', { name: /Cancel preparation/ })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: /Bill colour/ })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual(DALLA_CASSA_IN_LIB)
  })

  // Le corsie del banco: una card per comanda, col tasto grande e quello
  // del conto. I titoli delle colonne vengono da lib/coda.js e si traducono
  // là (in testa a questa prova): qui si guarda il resto della card.
  it('le corsie del banco', async () => {
    impostazioni = { ...impostazioni, queue_view: 'corsie', bartender_view: 'corsie' }
    ruolo = 'bartender'
    const { container } = montaCoda()
    await screen.findByText('In service')
    expect(screen.getAllByRole('button', { name: 'Ready' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /Bill/ }).length).toBeGreaterThan(0)
    expect(screen.getByText('In preparation')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual(DALLA_CASSA_IN_LIB)
  })

  it('il menu laterale', async () => {
    globalThis.__drawerVero = true
    ruolo = 'staff'
    const { container } = montaCoda()
    await screen.findByText('In service')
    expect(screen.getByText('Log out')).toBeInTheDocument()
    expect(screen.getByText('Call the bar')).toBeInTheDocument()
    expect(italianoRimasto(container.querySelector('.bar-sidebar'))).toEqual(DAL_MENU_IN_LIB)
  })

  it('il dialogo di annullo: le frasi per il cliente restano in italiano, e lo dicono', () => {
    const { container } = render(
      <CancelOrderDialog
        order={{ daily_number: 41, service_mode: 'tavolo' }}
        kind="preparazione"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.getByRole('heading', { name: /Cancel the preparation of #41\?/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
    // Arrivano al cliente così come sono: chi lavora deve vedere cosa
    // leggerà lui, e il controllo le salta perché portano lang="it".
    for (const frase of container.querySelectorAll('.mode-option')) expect(frase).toHaveAttribute('lang', 'it')
    expect(italianoRimasto(container)).toEqual([])
  })
})
