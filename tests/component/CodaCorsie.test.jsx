// @vitest-environment happy-dom
'use strict'

// LA CODA A CORSIE DI STATO (Impostazioni → Coda ordini → «Corsie di stato»).
//
// È la vista di chi sta dietro il banco: quattro colonne — da fare, al
// banco, al ritiro, da incassare — e un tasto per card che manda l'ordine
// al passo dopo. Le cose che si provano qui sono quelle che al banco
// costano un drink sbagliato:
//   · le colonne ci sono tutte e quattro, sempre, anche vuote: la
//     posizione di una colonna si impara a memoria e non deve ballare;
//   · il tasto fa la STESSA cosa della griglia — chiama updateOrderStatus,
//     non una scorciatoia sua — perché una vista è un modo di guardare,
//     non un secondo modo di lavorare;
//   · la ricerca filtra dentro le corsie, tutte insieme;
//   · con gli stati di servizio spenti i quattro passi non esistono, e le
//     corsie diventano le tre della griglia (in corso, chiusi, annullati).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'

// Dove si va toccando una card: la spia dice se si apre il conto giusto.
const navigateSpy = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const vera = await orig()
  return { ...vera, useNavigate: () => navigateSpy }
})

// Le impostazioni del locale: ogni test le prepara prima di montare.
let impostazioni = {}
// Gli ordini che il server manda alla coda.
let ordini = []
// I conti battuti al POS e non ancora arrivati dal server.
let inVolo = []

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
  updateOrderStatus: vi.fn(() => Promise.resolve()),
  markOrderPaid: vi.fn(() => Promise.resolve()),
  cancelOrder: vi.fn(() => Promise.resolve()),
  restoreOrder: vi.fn(() => Promise.resolve()),
  createOrder: vi.fn(() => Promise.resolve({})),
  saveStaffToken: vi.fn(() => Promise.resolve()),
  rimuoviStaffToken: vi.fn(() => Promise.resolve()),
  clockOut: vi.fn(() => Promise.resolve()),
}))

// Hardware e contorno: al banco ci sono, in un test no.
vi.mock('../../src/lib/push.js', () => ({ getPushToken: vi.fn(async () => null) }))
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
vi.mock('../../src/lib/sumupApi.js', () => ({
  syncSumUpProducts: vi.fn(async () => ({ synced: 0 })),
  isSumUpEnabled: false,
}))
vi.mock('../../src/lib/staffApi.js', () => ({ preloadStaff: vi.fn() }))
vi.mock('../../src/lib/pendingOrders.js', () => ({
  subscribePending: (cb) => {
    cb({ pending: inVolo, banners: [] })
    return () => {}
  },
  dismissPending: vi.fn(),
  dismissBanner: vi.fn(),
}))

// Il resto del gestionale non è in prova qui: sezioni, pannelli e menu
// laterale diventano segnaposto, altrimenti montare la coda vorrebbe dire
// montare mezza app (e mezza app di finzioni).
vi.mock('../../src/components/MenuManager.jsx', () => ({ default: () => <div>menu</div> }))
vi.mock('../../src/components/PrinterSetup.jsx', () => ({ default: () => <div>stampante</div> }))
vi.mock('../../src/components/InventoryManager.jsx', () => ({ default: () => <div>inventario</div> }))
vi.mock('../../src/components/SettingsTab.jsx', () => ({ default: () => <div>impostazioni</div> }))
vi.mock('../../src/components/StatsTab.jsx', () => ({ default: () => <div>statistiche</div> }))
vi.mock('../../src/components/StaffHoursTab.jsx', () => ({ default: () => <div>ore</div> }))
vi.mock('../../src/components/UtentiTab.jsx', () => ({ default: () => <div>utenti</div> }))
vi.mock('../../src/components/VipTab.jsx', () => ({ default: () => <div>vip</div> }))
vi.mock('../../src/components/ServiceQueue.jsx', () => ({ default: () => <div>servizio</div> }))
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
import { updateOrderStatus } from '../../src/lib/api.js'

const ORA = '2026-08-16T21:00:00.000Z'

// Un conto come arriva dalla coda: comande allineate allo stato, così le
// regole di chiusura (comande.js) rispondono come in produzione.
const conto = (patch) => ({
  daily_number: 1,
  status: 'aperto',
  payment_status: 'non_richiesto',
  created_at: ORA,
  order_date: '2026-08-16',
  cash_session_id: 'cassa-1',
  total: 10,
  order_items: [],
  comande: [{ id: `c-${patch.id}`, status: patch.workflow_status ?? 'ricevuto' }],
  placed_by: { email: 'marta@bar.it', name: 'Marta', role: 'bartender' },
  ...patch,
})

const CODA = [
  conto({
    id: 'o41',
    daily_number: 41,
    workflow_status: 'ricevuto',
    table_label: '4',
    total: 24,
    order_items: [
      { id: 'i1', name: 'Negroni', qty: 2, unit_price: 9 },
      { id: 'i2', name: 'Gin tonic', qty: 1, unit_price: 6 },
    ],
  }),
  conto({
    id: 'o42',
    daily_number: 42,
    workflow_status: 'ricevuto',
    service_mode: 'banco',
    note: 'Poco ghiaccio',
    total: 9,
    order_items: [{ id: 'i3', name: 'Espresso Martini', qty: 1, unit_price: 9 }],
  }),
  conto({
    id: 'o39',
    daily_number: 39,
    workflow_status: 'in_preparazione',
    customer_name: 'Ciro',
    total: 30,
    order_items: [{ id: 'i4', name: 'Old Fashioned', qty: 2, unit_price: 15 }],
  }),
  conto({ id: 'o37', daily_number: 37, workflow_status: 'pronto', total: 18 }),
  // pagato ma non ancora consegnato: resta al ritiro, col bollo «Pagato»
  conto({
    id: 'o36',
    daily_number: 36,
    workflow_status: 'pronto',
    payment_status: 'pagato',
    total: 40,
  }),
  conto({
    id: 'o33',
    daily_number: 33,
    workflow_status: 'ritirato',
    table_label: '9',
    total: 58,
    order_items: [{ id: 'i5', name: 'Spritz', qty: 6, unit_price: 9 }],
  }),
]

// La colonna che ha per testata quel titolo.
const corsia = (titolo) => document.querySelector(`.corsia-${titolo}`)?.closest('.corsia')

function montaCoda() {
  return render(
    <MemoryRouter>
      <BartenderPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  ordini = CODA
  inVolo = []
  impostazioni = {
    queue_view: 'corsie',
    queue_search: 'filtra',
    workflow_enabled: true,
    groups_enabled: false,
    business_day_cutoff_hour: 6,
  }
})

describe('la coda a corsie di stato', () => {
  it('mostra le quattro corsie, coi conti e i totali di ognuna', async () => {
    montaCoda()
    await screen.findByText('Da fare')
    for (const titolo of ['Da fare', 'Al banco', 'Al ritiro', 'Da incassare']) {
      expect(screen.getByText(titolo)).toBeInTheDocument()
    }

    // Da fare: i due appena arrivati, col totale della colonna
    const daFare = corsia('da-fare')
    expect(within(daFare).getByText('#41')).toBeInTheDocument()
    expect(within(daFare).getByText('#42')).toBeInTheDocument()
    expect(within(daFare).getByText('33,00 €')).toBeInTheDocument()

    // Al ritiro: il pronto e quello già pagato, che resta lì col bollo
    const alRitiro = corsia('al-ritiro')
    expect(within(alRitiro).getByText('#36')).toBeInTheDocument()
    expect(within(alRitiro).getByText('Pagato')).toBeInTheDocument()

    // Da incassare: il conto consegnato e non saldato, con la cifra grande
    const daIncassare = corsia('da-incassare')
    expect(within(daIncassare).getByText('#33')).toBeInTheDocument()
    expect(within(daIncassare).getByText('Tavolo 9 · 6 drink')).toBeInTheDocument()
    expect(daIncassare.querySelector('.corsia-cifra')).toHaveTextContent('58,00 €')
  })

  it('il tasto della card fa avanzare lo stato — la stessa azione della griglia', async () => {
    const utente = userEvent.setup()
    montaCoda()
    await screen.findByText('Da fare')

    const daFare = corsia('da-fare')
    await utente.click(within(daFare).getAllByRole('button', { name: 'Lo preparo io' })[0])
    expect(updateOrderStatus).toHaveBeenCalledWith('o41', 'in_preparazione')

    // e la card è già passata di corsia, senza aspettare il server: al
    // banco un gesto che non si vede subito è un gesto che si ripete.
    expect(within(corsia('al-banco')).getByText('#41')).toBeInTheDocument()

    // ogni corsia ha il verbo del suo passo
    expect(
      within(corsia('al-banco')).getAllByRole('button', { name: 'È pronto' })[0]
    ).toBeInTheDocument()
    expect(
      within(corsia('al-ritiro')).getAllByRole('button', { name: 'Consegnato' })[0]
    ).toBeInTheDocument()
    expect(
      within(corsia('da-incassare')).getByRole('button', { name: 'Incassa' })
    ).toBeInTheDocument()
  })

  it('toccando la card (non il tasto) si apre il conto', async () => {
    const utente = userEvent.setup()
    montaCoda()
    await screen.findByText('Da fare')

    await utente.click(within(corsia('da-fare')).getByText('#41'))
    expect(navigateSpy).toHaveBeenCalledWith('/ordine/o41')

    // «Incassa» invece porta dritto al pagamento del conto, che è il flusso
    // esistente: sconto, conto diviso, contanti, carta e lettore stanno lì.
    await utente.click(within(corsia('da-incassare')).getByRole('button', { name: 'Incassa' }))
    expect(navigateSpy).toHaveBeenCalledWith('/ordine/o33?pagamento=1')
  })

  it('la ricerca filtra dentro le corsie, tutte insieme', async () => {
    const utente = userEvent.setup()
    montaCoda()
    await screen.findByText('Da fare')

    await utente.type(screen.getByPlaceholderText(/Cerca numero/), '41')

    expect(screen.getByText('#41')).toBeInTheDocument()
    expect(screen.queryByText('#42')).not.toBeInTheDocument()
    expect(screen.queryByText('#33')).not.toBeInTheDocument()
    // le colonne restano tutte e quattro, anche svuotate: la loro
    // posizione si impara a memoria
    for (const titolo of ['Da fare', 'Al banco', 'Al ritiro', 'Da incassare']) {
      expect(screen.getByText(titolo)).toBeInTheDocument()
    }
  })

  it('un conto appena battuto si vede subito, prima ancora del server', async () => {
    // Altrimenti chi batte al POS torna in coda, non lo trova e lo ribatte.
    inVolo = [
      { tempId: 't1', state: 'sending', order: { table_label: '7', customer_name: 'Giulia' } },
    ]
    montaCoda()
    await screen.findByText('Da fare')

    const daFare = corsia('da-fare')
    expect(within(daFare).getByText('#…')).toBeInTheDocument()
    expect(within(daFare).getByText('Tavolo 7 · Giulia')).toBeInTheDocument()
  })

  it('senza stati di servizio le corsie diventano tre: in corso, chiusi, annullati', async () => {
    impostazioni = { ...impostazioni, workflow_enabled: false }
    montaCoda()
    await screen.findByText('In corso')

    for (const titolo of ['In corso', '💶 Chiusi', '✖️ Annullati']) {
      expect(screen.getByText(titolo)).toBeInTheDocument()
    }
    expect(screen.queryByText('Da fare')).not.toBeInTheDocument()
    // Niente avanzamenti: senza gli stati l'unica cosa da fare a un conto
    // in corso è incassarlo.
    expect(screen.queryByRole('button', { name: 'Lo preparo io' })).not.toBeInTheDocument()
    expect(
      within(corsia('attivi')).getAllByRole('button', { name: 'Incassa' })[0]
    ).toBeInTheDocument()
  })
})
