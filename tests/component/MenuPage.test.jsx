// @vitest-environment happy-dom
'use strict'

// Test di COMPONENTE del MENÙ visto dallo STAFF (/menu): la ricerca rapida,
// quella che serve a battere un ordine a mano mentre si ha un vassoio in
// mano. Due modi, come nel POS e nella coda: filtrare o accendere.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'

let mockSettings = {}

vi.mock('../../src/lib/api.js', () => ({
  subscribeServiceStats: vi.fn(() => () => {}),
  subscribeSettings: vi.fn((cb) => {
    cb({ service_mode: 'tavolo', ...mockSettings })
    return () => {}
  }),
  subscribeOrder: vi.fn(() => () => {}),
  subscribeReadyOrders: vi.fn(() => () => {}),
  subscribeOpenGroups: vi.fn(() => () => {}),
  subscribeRecentGroups: vi.fn(() => () => {}),
  createOrder: vi.fn(() => Promise.resolve({ id: 'o1' })),
  DEFAULT_SETTINGS: { service_mode: 'tavolo' },
}))

// Catalogo finto: due categorie, così si vede se la ricerca porta davvero
// nell'altra categoria invece di limitarsi a filtrare.
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
      { id: 'd4', name: 'Moretti', price: 4, category_id: 'c2', available: true },
    ],
  }),
}))

vi.mock('../../src/lib/firebaseClient.js', () => ({
  isFirebaseConfigured: true,
  auth: {},
  db: {},
}))

// Chi guarda è un bartender: è la vista a due colonne con la ricerca.
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb({
      email: 'anna@tana.it',
      displayName: 'Anna',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'bartender' } }),
    })
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

// La vista staff compare quando il ruolo è arrivato dal token (una promessa):
// si aspetta la ricerca, che è il primo segno che siamo nella vista giusta.
async function mostra() {
  const r = render(
    <MemoryRouter initialEntries={['/menu']}>
      <MenuPage />
    </MemoryRouter>
  )
  await screen.findByPlaceholderText(/Cerca drink/)
  return r
}

// I nomi dei prodotti, nell'ordine in cui stanno a schermo.
const nomi = () =>
  [...document.querySelectorAll('.staff-product-name')].map((e) => e.textContent)
const acceso = () => document.querySelector('.staff-product.prodotto-acceso .staff-product-name')

beforeEach(() => {
  mockSettings = {}
  localStorage.clear()
  // Al primo accesso il menù mostra il benvenuto a tutta pagina: qui
  // interessa la ricerca, quindi si finge di averlo già visto.
  localStorage.setItem('tana_welcome_v1', '1')
})

describe('menù staff: la ricerca FILTRA (impostazione di partenza)', () => {
  it('restano solo i prodotti che rispondono, le categorie spariscono', async () => {
    const user = userEvent.setup()
    await mostra()
    // Si parte dalla prima categoria: solo i cocktail.
    expect(nomi()).toEqual(['Mojito', 'Negroni'])
    await user.type(screen.getByPlaceholderText(/Cerca drink/), 'mo')
    expect(nomi()).toEqual(['Mojito', 'Moretti'])
    expect(document.querySelector('.staff-cats')).toBeNull()
    expect(acceso()).toBeNull()
  })
})

describe('menù staff: la ricerca ACCENDE e porta lì', () => {
  beforeEach(() => {
    mockSettings = { pos_search: 'evidenzia' }
  })

  it('la categoria del prodotto trovato si apre e il prodotto si illumina', async () => {
    const user = userEvent.setup()
    await mostra()
    expect(nomi()).toEqual(['Mojito', 'Negroni'])
    // "ichn" sta nell'altra categoria: la barra resta, ma ci si sposta lì.
    await user.type(screen.getByPlaceholderText(/Cerca drink/), 'ichn')
    expect(document.querySelector('.staff-cats')).not.toBeNull()
    expect(nomi()).toEqual(['Ichnusa', 'Moretti'])
    expect(acceso()).toHaveTextContent('Ichnusa')
  })

  it('si accende il PRIMO che risponde, e gli altri restano al loro posto', async () => {
    const user = userEvent.setup()
    await mostra()
    await user.type(screen.getByPlaceholderText(/Cerca drink/), 'mo')
    // Mojito viene prima di Moretti: è quello da accendere.
    expect(acceso()).toHaveTextContent('Mojito')
    expect(nomi()).toEqual(['Mojito', 'Negroni'])
  })

  it('battuto il prodotto la ricerca si azzera da sé, e resta la categoria giusta', async () => {
    const user = userEvent.setup()
    await mostra()
    await user.type(screen.getByPlaceholderText(/Cerca drink/), 'ichn')
    await user.click(screen.getAllByRole('button', { name: '+' })[0])
    expect(screen.getByPlaceholderText(/Cerca drink/)).toHaveValue('')
    expect(nomi()).toEqual(['Ichnusa', 'Moretti'])
  })

  it('niente da trovare: il catalogo resta intero e lo dice', async () => {
    const user = userEvent.setup()
    await mostra()
    await user.type(screen.getByPlaceholderText(/Cerca drink/), 'grappa')
    expect(nomi()).toEqual(['Mojito', 'Negroni'])
    expect(screen.getByText(/Nessun prodotto per «grappa»/)).toBeInTheDocument()
    expect(acceso()).toBeNull()
  })
})
