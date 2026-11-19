// @vitest-environment happy-dom
'use strict'

// IL CONTO IN INGLESE (REQ-UI-039). Daniele, 17/11/2026: «chiunque può
// scegliere la lingua nel gestionale». Il conto è la schermata più usata,
// e la più piena di testi: righe, tasti del piede, testata, finestre dei
// dati e delle comande, la griglia dei prodotti accanto. Qui si apre con la
// lingua inglese e si chiede cosa è rimasto in italiano (vedi
// tests/helpers/nienteItaliano.js): un `tr` dimenticato si vede subito,
// senza aspettare che lo noti qualcuno al banco con il locale pieno.
//
// I dati finti non hanno parole italiane («Negroni», «Spritz», «Mario»):
// il controllo cerca proprio quelle, e un nome di prodotto le farebbe
// trovare dove non c'è niente da correggere.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'
import { CON_LICENZA } from '../helpers/licenza.js'
import { italianoRimasto } from '../helpers/nienteItaliano.js'

vi.mock('../../src/lib/api.js', () => ({
  subscribeOpenCashSession: (cb) => {
    cb({ id: 'cassa-test', status: 'open' })
    return () => {}
  },
  advanceComanda: vi.fn(() => Promise.resolve()),
  addComanda: vi.fn(() => Promise.resolve({ comande: [] })),
  chiudiCreazione: vi.fn(),
  bartenderUpdateComanda: vi.fn(() => Promise.resolve()),
  updateOrderInfo: vi.fn(() => Promise.resolve()),
  cancelOrder: vi.fn(() => Promise.resolve()),
  restoreOrder: vi.fn(() => Promise.resolve()),
  fetchInventoryItems: vi.fn(() => Promise.resolve([])),
  createOrder: vi.fn(() => Promise.resolve({ id: 'ord-nuovo' })),
  subscribeOrder: vi.fn(() => () => {}),
  subscribeOpenGroups: vi.fn(() => () => {}),
  fetchRecentDrinkIds: vi.fn(() => Promise.resolve([])),
  subscribePosPrefs: vi.fn(() => () => {}),
  savePosOrder: vi.fn(() => Promise.resolve()),
  savePosFavorites: vi.fn(() => Promise.resolve()),
  savePosColors: vi.fn(() => Promise.resolve()),
  DEFAULT_SETTINGS: {},
  settingsIniziali: () => ({}),
  peekNextDailyNumber: vi.fn(() => Promise.resolve(12)),
  setOrderServiceMode: vi.fn(() => Promise.resolve({})),
  preparazioneParziale: vi.fn(() => Promise.resolve()),
  subscribeSettings: vi.fn((cb) => {
    // Coperto acceso: il piede mostra subtotale e supplementi, che sono
    // testi da tradurre anche loro.
    cb({ ...CON_LICENZA, coperto_enabled: true })
    return () => {}
  }),
}))
vi.mock('../../src/lib/firebaseClient.js', () => ({ auth: { currentUser: { uid: 'u1' } } }))
let consegnaRuolo = null
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((a, cb) => {
    consegnaRuolo = cb({
      uid: 'u1',
      email: 'mario@tana.local',
      displayName: 'Mario',
      getIdTokenResult: () => Promise.resolve({ claims: { role: 'bartender' } }),
    })
    return () => {}
  }),
}))
vi.mock('../../src/lib/menuCache.js', () => ({
  useMenu: () => ({
    drinks: [
      { id: 'negroni', name: 'Negroni', price: 8, available: true, category_id: 'cat1' },
      { id: 'spritz', name: 'Spritz', price: 7, available: true, category_id: 'cat1' },
    ],
    cats: [{ id: 'cat1', name: 'Cocktails', sort_order: 0 }],
    loading: false,
  }),
}))
vi.mock('../../src/lib/printer.js', async (originale) => ({
  ...(await originale()),
  printComanda: vi.fn(() => Promise.resolve()),
  printComande: vi.fn(() => Promise.resolve(2)),
  printComandaUnita: vi.fn(() => Promise.resolve()),
  releaseReceiptPrint: vi.fn(),
}))
// Il riquadro del costo e la riga del costo sono di un'altra area (il
// menù): qui si guarda il prodotto libero, non loro.
vi.mock('../../src/components/PriceSuggestion.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/CostoRiga.jsx', () => ({ default: () => null }))

import OrderPosDetail from '../../src/components/OrderPosDetail.jsx'
import SchedaDrink from '../../src/components/SchedaDrink.jsx'
import PreparazioneParziale from '../../src/components/PreparazioneParziale.jsx'
import CustomDrinkForm from '../../src/components/CustomDrinkForm.jsx'
import ZoomControl from '../../src/components/ZoomControl.jsx'
import { impostaLingua } from '../../src/lib/lingua.js'
import { fetchInventoryItems } from '../../src/lib/api.js'

const conto = () => ({
  id: 'ord1',
  daily_number: 12,
  serial: 345,
  status: 'aperto',
  workflow_status: 'ricevuto',
  payment_status: 'non_richiesto',
  customer_name: 'Mario',
  table_label: '3',
  note: null,
  service_mode: 'tavolo',
  coperto_amount: 2,
  service_charge_amount: 0,
  tip_amount: 0,
  created_at: '2026-07-11T21:00:00.000Z',
  placed_by: { name: 'Mario', email: 'mario@tana.local', role: 'bartender' },
  comande: [
    {
      id: 'c1',
      seq: 1,
      status: 'ricevuto',
      status_times: {},
      created_at: '2026-07-11T21:00:00.000Z',
      items: [
        { drink_id: 'negroni', name: 'Negroni', unit_price: 8, qty: 2 },
        { drink_id: 'spritz', name: 'Spritz', unit_price: 7, qty: 1 },
      ],
    },
  ],
})

async function monta(order) {
  const utils = render(
    <MemoryRouter>
      <OrderPosDetail order={order} />
    </MemoryRouter>
  )
  await waitFor(() => expect(consegnaRuolo).not.toBeNull())
  return utils
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  consegnaRuolo = null
  impostaLingua('en')
})

afterEach(() => {
  impostaLingua('it')
})

describe('il conto in inglese (REQ-UI-039)', () => {
  it('un conto con le sue righe e la griglia dei prodotti: niente italiano a schermo', async () => {
    await monta(conto())
    expect(screen.getByRole('button', { name: /Bill details/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tickets \(1\)/ })).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('Cover charge')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decrease Negroni' })).toBeInTheDocument()
    // La griglia accanto al conto: categorie, ricerca, tile.
    expect(screen.getByPlaceholderText(/Search product/)).toBeInTheDocument()
    expect(screen.getByTitle('All')).toBeInTheDocument()
    expect(italianoRimasto(document.body)).toEqual([])
  })

  it('i dati del conto e la scelta fra servizio e ritiro', async () => {
    const user = userEvent.setup()
    await monta(conto())
    await user.click(screen.getByRole('button', { name: /Bill details/ }))
    const finestra = screen.getByRole('dialog', { name: 'Bill details' })
    expect(within(finestra).getByText('How it is served')).toBeInTheDocument()
    expect(within(finestra).getByRole('button', { name: /Table service/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(finestra).getByRole('button', { name: /Pick-up/ })).toBeInTheDocument()
    expect(italianoRimasto(document.body)).toEqual([])
  })

  it('la finestra delle comande', async () => {
    const user = userEvent.setup()
    await monta(conto())
    await user.click(screen.getByRole('button', { name: /Tickets \(1\)/ }))
    expect(screen.getByText(/TICKET 1/)).toBeInTheDocument()
    expect(italianoRimasto(document.body)).toEqual([])
  })

  it('il conto nuovo, ancora vuoto', async () => {
    await monta(null)
    expect(screen.getByText('Tap the products to add them to the order.')).toBeInTheDocument()
    expect(italianoRimasto(document.body)).toEqual([])
  })
})

describe('i pezzi del conto in inglese (REQ-UI-039)', () => {
  it('la scheda del drink', () => {
    const { container } = render(
      <SchedaDrink
        drink={{
          name: 'Negroni',
          price: 8,
          recipe_items: [{ name: 'Gin', qty: 30, unit: 'ml' }],
          recipe: 'Stir, strain.',
        }}
        onClose={() => {}}
      />
    )
    expect(screen.getByText('Ingredients')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('la preparazione parziale', () => {
    const { container } = render(
      <PreparazioneParziale
        comanda={{ items: [{ drink_id: 'negroni', name: 'Negroni', qty: 3 }] }}
        onAnnulla={() => {}}
        onConferma={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: 'Prepare these' })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('il prodotto libero, nuovo e da ritoccare', async () => {
    // Con un articolo in magazzino compare anche il tasto degli ingredienti:
    // aspettarlo è aspettare che la lettura del magazzino sia atterrata.
    fetchInventoryItems.mockResolvedValue([{ id: 'inv-gin', name: 'Gin', unit: 'ml' }])
    const { container, unmount } = render(<CustomDrinkForm onCancel={() => {}} onAdd={() => {}} />)
    expect(await screen.findByText(/Ingredients \(stock deduction\)/)).toBeInTheDocument()
    expect(screen.getByText('Custom item')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
    unmount()
    const ritocco = render(
      <CustomDrinkForm
        initial={{ name: 'Negroni', price: 8, recipe_items: [] }}
        warnNoRecipe
        onCancel={() => {}}
        onAdd={() => {}}
        onSaveAsNew={() => {}}
      />
    )
    expect(screen.getByText('Edit product')).toBeInTheDocument()
    await waitFor(() => expect(fetchInventoryItems).toHaveBeenCalledTimes(2))
    await act(() => Promise.resolve())
    expect(italianoRimasto(ritocco.container)).toEqual([])
  })

  it('lo zoom', () => {
    const { container } = render(<ZoomControl inline />)
    expect(screen.getByRole('group', { name: 'Page zoom' })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })
})
