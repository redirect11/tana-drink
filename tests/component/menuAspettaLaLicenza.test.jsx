// @vitest-environment happy-dom
'use strict'

// IL MENÙ DEI CLIENTI NON DICE «NON È ATTIVO» PRIMA DI SAPERLO (BUG-142).
// Visto l'11/11/2026 registrando il caricamento del menù del test da un
// browser senza memoria: per circa un secondo la pagina diceva «Il menù
// digitale non è attivo — Questa funzione non fa parte del piano di questo
// locale», e poi compariva il menù. L'app parte con le impostazioni di base,
// che non hanno una licenza: «non lo so ancora» veniva letto come «non
// incluso». Un cliente al tavolo, col telefono appena connesso, leggeva che
// il menù non c'è. Ora, finché la licenza non è arrivata, si aspetta.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'
import { LICENZA_TANA } from '../helpers/licenza.js'
import { licenzaNota, STATI_LICENZA } from '../../src/lib/licenza.js'

// Le impostazioni arrivano quando lo decide il test: è l'istante prima che
// conta.
let arrivano = null

vi.mock('../../src/lib/firebaseClient.js', () => ({
  isFirebaseConfigured: true,
  auth: { currentUser: null },
  db: {},
}))
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb(null)
    return () => {}
  },
}))
vi.mock('../../src/lib/customerAuth.js', () => ({
  useCustomer: () => ({ user: null, profile: null }),
  useHasOrders: () => false,
  logoutCustomer: vi.fn(),
}))
vi.mock('../../src/lib/api.js', () => ({
  presentaAllaRegia: vi.fn(() => Promise.resolve({ ok: false, status: 0, errore: null })),
  DEFAULT_SETTINGS: {},
  settingsIniziali: () => ({}),
  subscribeSettings: (cb) => {
    arrivano = cb
    return () => {}
  },
  subscribeOpenGroups: (cb) => {
    cb([])
    return () => {}
  },
  createManualGroup: vi.fn(),
  clockIn: vi.fn(async () => {}),
  subscribeDrinks: () => () => {},
  subscribeCategories: () => () => {},
  subscribePrinterConfig: () => () => {},
}))
vi.mock('../../src/lib/printer.js', () => ({
  savePrinterSettings: vi.fn(),
  impostaUtenteStampante: vi.fn(),
}))
vi.mock('../../src/lib/appVersion.js', () => ({ subscribeUpdateAvailable: () => () => {} }))
vi.mock('../../src/lib/cookieConsent.js', () => ({ openCookiePreferences: vi.fn() }))
vi.mock('../../src/dev/devActions.js', () => ({ envLabel: '', devToolsEnabled: false }))
vi.mock('../../src/lib/logout.js', () => ({ logoutStaff: vi.fn() }))
vi.mock('../../src/components/StatusBell.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/VersionBadge.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/ZoomControl.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/Toasts.jsx', () => ({ default: () => null }))
vi.mock('../../src/pages/LandingPage.jsx', () => ({ default: () => <div>PAGINA HOME</div> }))
vi.mock('../../src/pages/MenuPage.jsx', () => ({ default: () => <div>PAGINA MENU</div> }))
vi.mock('../../src/pages/OrderStatusPage.jsx', () => ({ default: () => null }))
vi.mock('../../src/pages/MyOrdersPage.jsx', () => ({ default: () => null }))
vi.mock('../../src/pages/BartenderPage.jsx', () => ({ default: () => null }))
vi.mock('../../src/pages/StaffProfilePage.jsx', () => ({ default: () => null }))
vi.mock('../../src/pages/PosPage.jsx', () => ({ default: () => null }))
vi.mock('../../src/pages/AccountPages.jsx', () => ({
  AccediPage: () => null,
  RegistratiPage: () => null,
  ProfiloPage: () => null,
}))

import App from '../../src/App.jsx'

// L'app al montaggio fa ancora un giro per conto suo (chi è collegato, le
// pagine caricate a parte): lo si lascia finire, così quello che si guarda
// è la schermata ferma e non un istante a metà.
async function apri(percorso) {
  render(
    <MemoryRouter initialEntries={[percorso]}>
      <App />
    </MemoryRouter>
  )
  await act(async () => {})
}

const nonAttivo = () => screen.queryByRole('heading', { name: 'Il menù digitale non è attivo' })

beforeEach(() => {
  arrivano = null
  localStorage.clear()
})

describe('la licenza si sa già?', () => {
  it('senza licenza nelle impostazioni non si sa; con una licenza, anche non attivata, sì', () => {
    expect(licenzaNota({})).toBe(false)
    expect(licenzaNota(null)).toBe(false)
    expect(licenzaNota({ licenza: LICENZA_TANA })).toBe(true)
    expect(licenzaNota({ licenza: { stato: STATI_LICENZA.NON_ATTIVATA } })).toBe(true)
  })
})

describe.each(['/menu', '/menu/special'])('%s, alla prima apertura', (percorso) => {
  it('finché la licenza non è arrivata aspetta, e non dice che il menù manca', async () => {
    await apri(percorso)
    expect(nonAttivo()).toBeNull()
    expect(screen.getByText('Carico il menù…')).toBeInTheDocument()
  })

  it('arrivata la licenza col menù digitale, il menù', async () => {
    await apri(percorso)
    act(() => arrivano({ licenza: LICENZA_TANA }))
    expect(screen.getByText('PAGINA MENU')).toBeInTheDocument()
    expect(nonAttivo()).toBeNull()
    expect(screen.queryByText('Carico il menù…')).toBeNull()
  })

  // La pagina della funzione non inclusa resta, ma solo quando la licenza
  // dice davvero di no (REQ-LIC-002).
  it('arrivata una licenza senza il menù digitale, lo dice', async () => {
    await apri(percorso)
    act(() => arrivano({ licenza: { moduli: {} } }))
    expect(nonAttivo()).toBeInTheDocument()
    expect(screen.queryByText('Carico il menù…')).toBeNull()
  })
})
