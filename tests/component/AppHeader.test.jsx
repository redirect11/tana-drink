// @vitest-environment happy-dom
'use strict'

// LA BARRA IN CIMA, UGUALE OVUNQUE.
//
// Prima cambiava forma a ogni schermata: il ☰ c'era solo nel gestionale e
// nel menù, e a destra si alternavano tre cose diverse — il chip col nome,
// "🍸 Ciao, nome" con l'Esci accanto, "🫱 Torna al servizio". Passando
// dalla coda al profilo la barra diventava un'altra e il menu spariva:
// per tornare indietro restava il tasto del browser.
//
// E il TEMA seguiva l'indirizzo, non chi guardava. Bastava un percorso
// dimenticato nell'elenco — il profilo staff, "i miei ordini", l'accesso —
// perché a chi sta lavorando arrivassero i colori pensati per il cliente,
// in mezzo alla serata. Ora segue il ruolo.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'

// Chi è collegato: lo decide ogni test prima di montare.
let ruoloClaim = null
let clienteLoggato = null

vi.mock('../../src/lib/firebaseClient.js', () => ({
  isFirebaseConfigured: true,
  auth: { currentUser: null },
  db: {},
}))
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb(
      ruoloClaim
        ? {
            uid: 'u1',
            email: 'capo@bar.it',
            displayName: 'Capo Bar',
            getIdTokenResult: async () => ({ claims: { role: ruoloClaim } }),
          }
        : null
    )
    return () => {}
  },
}))
vi.mock('../../src/lib/customerAuth.js', () => ({
  useCustomer: () => ({ user: clienteLoggato, profile: null }),
  useHasOrders: () => false,
  logoutCustomer: vi.fn(),
}))

// Due temi ben diversi, così si vede subito quale è arrivato. (Dentro la
// fabbrica di vi.mock, che finisce in cima al file, vanno riscritti: da lì
// non si vedono le costanti.)
const TEMA_STAFF = { preset: 'notte-blu', custom: null }
const TEMA_CLIENTE = { preset: 'crema', custom: null }
vi.mock('../../src/lib/api.js', () => ({
  DEFAULT_SETTINGS: {},
  subscribeSettings: (cb) => {
    cb({
      customer_accounts_enabled: true,
      theme_staff: { preset: 'notte-blu', custom: null },
      theme_client: { preset: 'crema', custom: null },
      groups_enabled: false,
      groups_in_drawer: false,
    })
    return () => {}
  },
  subscribeOpenGroups: (cb) => {
    cb([])
    return () => {}
  },
  createManualGroup: vi.fn(),
  clockIn: vi.fn(async () => {}),
  subscribePrinterConfig: () => () => {},
}))

vi.mock('../../src/lib/printer.js', () => ({ savePrinterSettings: vi.fn() }))
vi.mock('../../src/lib/appVersion.js', () => ({ subscribeUpdateAvailable: () => () => {} }))
vi.mock('../../src/lib/cookieConsent.js', () => ({ openCookiePreferences: vi.fn() }))
vi.mock('../../src/dev/devActions.js', () => ({ envLabel: '', devToolsEnabled: false }))
vi.mock('../../src/lib/logout.js', () => ({ logoutStaff: vi.fn() }))
vi.mock('../../src/components/StatusBell.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/VersionBadge.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/ZoomControl.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/Toasts.jsx', () => ({ default: () => null }))

// Le pagine non c'entrano: qui si guarda solo la barra. (Le fabbriche di
// vi.mock finiscono in cima al file: niente scorciatoie condivise.)
vi.mock('../../src/pages/LandingPage.jsx', () => ({ default: () => <div>PAGINA HOME</div> }))
vi.mock('../../src/pages/MenuPage.jsx', () => ({ default: () => <div>PAGINA MENU</div> }))
vi.mock('../../src/pages/OrderStatusPage.jsx', () => ({ default: () => <div>PAGINA ORDINE</div> }))
vi.mock('../../src/pages/MyOrdersPage.jsx', () => ({ default: () => <div>PAGINA MIEI ORDINI</div> }))
vi.mock('../../src/pages/BartenderPage.jsx', () => ({ default: () => <div>PAGINA CODA</div> }))
vi.mock('../../src/pages/StaffProfilePage.jsx', () => ({
  default: () => <div>PAGINA PROFILO STAFF</div>,
}))
vi.mock('../../src/pages/PosPage.jsx', () => ({ default: () => <div>PAGINA POS</div> }))
vi.mock('../../src/pages/AccountPages.jsx', () => ({
  AccediPage: () => <div>PAGINA ACCEDI</div>,
  RegistratiPage: () => <div>PAGINA REGISTRATI</div>,
  ProfiloPage: () => <div>PAGINA PROFILO</div>,
}))

import App from '../../src/App.jsx'
import { THEME_PRESETS } from '../../src/lib/themes.js'

function apri(percorso) {
  return render(
    <MemoryRouter initialEntries={[percorso]}>
      <App />
    </MemoryRouter>
  )
}

const burger = () => document.querySelector('.topbar-burger')
const accento = () => document.documentElement.style.getPropertyValue('--accent')

beforeEach(() => {
  ruoloClaim = null
  clienteLoggato = null
  document.documentElement.removeAttribute('style')
})

describe('la barra in cima è la stessa su tutte le schermate', () => {
  it('logo, nome e ☰ ci sono anche fuori dal gestionale', async () => {
    ruoloClaim = 'admin'
    apri('/profilo-staff')
    await waitFor(() => expect(burger()).not.toBeNull())
    expect(screen.getByText('La Tana del Coniglio')).toBeInTheDocument()
    // A destra una cosa sola: chi è collegato, che apre il suo profilo.
    const io = document.querySelector('.topbar-io')
    expect(io).toHaveAttribute('href', '/profilo-staff')
    expect(io).toHaveTextContent('Capo Bar')
    // Le vecchie varianti sono voci del menu laterale, non della barra.
    expect(screen.queryByText(/Ciao, Capo Bar/)).toBeNull()
    expect(screen.queryByText('Torna al servizio')).toBeNull()
  })

  it('la stessa barra nel menù usato per gli ordini manuali', async () => {
    ruoloClaim = 'bartender'
    apri('/menu')
    await waitFor(() => expect(document.querySelector('.topbar-io')).not.toBeNull())
    expect(burger()).not.toBeNull()
    expect(screen.getByText('La Tana del Coniglio')).toBeInTheDocument()
  })

  it('niente ☰ mentre si compone un conto: da lì si esce con «← Ordini»', async () => {
    ruoloClaim = 'bartender'
    apri('/pos')
    await screen.findByText('PAGINA POS')
    expect(burger()).toBeNull()
  })

  it('niente ☰ nemmeno modificando un ordine, se a guardarlo è lo staff', async () => {
    ruoloClaim = 'bartender'
    apri('/ordine/abc')
    await screen.findByText('PAGINA ORDINE')
    expect(burger()).toBeNull()
  })

  it('lo stesso ordine, visto dal cliente, il ☰ ce l’ha', async () => {
    apri('/ordine/abc')
    await screen.findByText('PAGINA ORDINE')
    expect(burger()).not.toBeNull()
  })
})

describe('il menu laterale risponde anche al cliente', () => {
  // Il menu, e non la barra: "Accedi" sta in tutti e due, e cercarlo in
  // pagina ne troverebbe due.
  const menu = () => within(document.querySelector('.bar-sidebar'))

  it('il suo menu: menù, i propri ordini, accesso — niente gestionale', async () => {
    apri('/ordini')
    await waitFor(() => expect(burger()).not.toBeNull())
    expect(menu().getByText('Menù')).toBeInTheDocument()
    expect(menu().getByText('I miei ordini')).toBeInTheDocument()
    expect(menu().getByText('Accedi')).toBeInTheDocument()
    expect(menu().getByText('Registrati')).toBeInTheDocument()
    // Le porte chiuse non si mostrano: le impostazioni non sono cosa sua.
    expect(screen.queryByText('Impostazioni')).toBeNull()
    expect(screen.queryByText('Utenti e ruoli')).toBeNull()
  })

  it('collegato, trova il proprio profilo e l’uscita', async () => {
    clienteLoggato = { uid: 'c1', email: 'anna@tana.it', displayName: 'Anna Rossi' }
    apri('/ordini')
    await waitFor(() => expect(burger()).not.toBeNull())
    expect(menu().getByText('Il mio profilo')).toBeInTheDocument()
    expect(menu().getByText('Esci')).toBeInTheDocument()
    expect(menu().queryByText('Registrati')).toBeNull()
  })
})

describe('il tema segue chi guarda, non l’indirizzo', () => {
  it('a chi lavora il gestionale, anche sul proprio profilo', async () => {
    ruoloClaim = 'admin'
    apri('/profilo-staff')
    await waitFor(() => expect(accento()).toBe(THEME_PRESETS[TEMA_STAFF.preset].vars['--accent']))
  })

  it('e anche su «i miei ordini» e sull’accesso, che prima sfuggivano', async () => {
    ruoloClaim = 'staff'
    apri('/ordini')
    await waitFor(() => expect(accento()).toBe(THEME_PRESETS[TEMA_STAFF.preset].vars['--accent']))
  })

  it('al cliente il suo, sempre', async () => {
    apri('/menu')
    await waitFor(() => expect(accento()).toBe(THEME_PRESETS[TEMA_CLIENTE.preset].vars['--accent']))
  })

  it('l’anteprima «vista cliente» mostra i colori del cliente: è il suo mestiere', async () => {
    ruoloClaim = 'admin'
    apri('/menu?vista=cliente')
    await waitFor(() => expect(accento()).toBe(THEME_PRESETS[TEMA_CLIENTE.preset].vars['--accent']))
  })
})
