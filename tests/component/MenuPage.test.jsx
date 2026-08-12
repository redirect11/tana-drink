// @vitest-environment happy-dom
'use strict'

// IL MENÙ È UNO SOLO. C'è stata una seconda schermata, riservata allo staff:
// catalogo a due colonne con la ricerca, nata per gli ordini battuti a mano.
// Quelli si battono al POS, e chi apriva il menù dal gestionale si trovava
// una pagina diversa da quella che stava mostrando al tavolo. Ora chi lavora
// vede lo stesso menù del cliente — e ci può ordinare, se le impostazioni lo
// consentono.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'

let mockSettings = {}
let ruoloClaim = 'bartender'

vi.mock('../../src/lib/api.js', () => ({
  subscribeServiceStats: vi.fn(() => () => {}),
  subscribeSettings: vi.fn((cb) => {
    cb({ service_mode: 'tavolo', menu_only: false, ...mockSettings })
    return () => {}
  }),
  subscribeOrder: vi.fn(() => () => {}),
  subscribeReadyOrders: vi.fn(() => () => {}),
  subscribeOpenGroups: vi.fn(() => () => {}),
  subscribeRecentGroups: vi.fn(() => () => {}),
  createOrder: vi.fn(() => Promise.resolve({ id: 'o1' })),
  DEFAULT_SETTINGS: { service_mode: 'tavolo' },
}))

vi.mock('../../src/lib/menuCache.js', () => ({
  useMenu: () => ({
    loading: false,
    cats: [
      { id: 'c1', name: 'Cocktail', sort_order: 1 },
      { id: 'c2', name: 'Birre', sort_order: 2 },
    ],
    drinks: [
      { id: 'd1', name: 'Mojito', price: 7, category_id: 'c1', available: true },
      { id: 'd2', name: 'Negroni', price: 8, category_id: 'c1', available: true },
      { id: 'd3', name: 'Ichnusa', price: 4, category_id: 'c2', available: true },
    ],
  }),
}))

vi.mock('../../src/lib/firebaseClient.js', () => ({
  isFirebaseConfigured: true,
  auth: {},
  db: {},
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb(
      ruoloClaim
        ? {
            email: 'anna@tana.it',
            displayName: 'Anna',
            getIdTokenResult: () => Promise.resolve({ claims: { role: ruoloClaim } }),
          }
        : null
    )
    return () => {}
  },
}))

vi.mock('../../src/lib/customerAuth.js', () => ({
  useCustomer: () => ({ user: null, profile: null }),
}))

vi.mock('../../src/lib/push.js', () => ({ getPushToken: vi.fn(() => Promise.resolve(null)) }))
vi.mock('../../src/lib/notify.js', () => ({ ensureNotificationPermission: vi.fn() }))
vi.mock('../../src/components/StaffDrawer.jsx', () => ({ default: () => null }))

import MenuPage from '../../src/pages/MenuPage.jsx'

function mostra(percorso = '/menu') {
  return render(
    <MemoryRouter initialEntries={[percorso]}>
      <MenuPage />
    </MemoryRouter>
  )
}

// I prodotti come li vede chi guarda: le card del menù cliente.
const voci = () =>
  [...document.querySelectorAll('.menu-item h3')].map((e) => e.textContent)

beforeEach(() => {
  mockSettings = {}
  ruoloClaim = 'bartender'
  localStorage.clear()
  // Al primo accesso il menù mostra il benvenuto a tutta pagina.
  localStorage.setItem('tana_welcome_v1', '1')
})

describe('il menù è uno solo, quello del cliente', () => {
  it('allo staff arriva lo stesso menù, non più il catalogo a due colonne', async () => {
    mostra()
    // Il segno che si è dello staff c'è (l'ordine viene marcato col nome),
    // ma la pagina sotto è la stessa del cliente.
    await screen.findByText(/Inserimento ordine da/)
    expect(voci()).toEqual(['Mojito', 'Negroni', 'Ichnusa'])
    expect(document.querySelector('.staff-menu')).toBeNull()
    expect(document.querySelector('.staff-cats')).toBeNull()
    expect(screen.queryByPlaceholderText(/Cerca drink/)).toBeNull()
  })

  it('lo stesso menù per il cliente', async () => {
    ruoloClaim = null
    mostra()
    await screen.findByText('Mojito')
    expect(voci()).toEqual(['Mojito', 'Negroni', 'Ichnusa'])
    expect(document.querySelector('.staff-menu')).toBeNull()
  })

  it('chi lavora può ordinare da qui: il prodotto entra nel carrello', async () => {
    const user = userEvent.setup()
    mostra()
    await screen.findByText(/Inserimento ordine da/)
    const aggiungi = screen.getAllByRole('button', { name: /Aggiungi/ })
    await user.click(aggiungi[0])
    expect(screen.getByText(/Rivedi ordine/)).toBeInTheDocument()
  })

  it('a «solo menù» il cliente guarda e basta: niente tasti per aggiungere', async () => {
    ruoloClaim = null
    mockSettings = { menu_only: true }
    mostra()
    await screen.findByText('Mojito')
    expect(screen.queryByRole('button', { name: /Aggiungi/ })).toBeNull()
    expect(screen.getByText(/Rivolgersi allo staff per ordinare/)).toBeInTheDocument()
  })
})
