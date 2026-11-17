// @vitest-environment happy-dom
'use strict'

// IL MAGAZZINO E LA COMANDA IN INGLESE (REQ-UI-039). Daniele, 17/11/2026: la
// lingua del gestionale la sceglie chiunque, sul suo profilo. Il magazzino è
// la parte che il gestore usa di più fuori dal servizio — schede prodotto,
// carichi, inventario, listini — e la comanda è la schermata del bartender
// col ticket in mano. Qui le si apre in inglese e si chiede cosa è rimasto
// in italiano: la lista, una riga aperta coi suoi moduli, la scheda, le
// sezioni, l'inventario in corso, lo storico, i movimenti di un prodotto, la
// comanda al banco.
//
// Le prove in italiano (InventoryManager, StockCountPanel, ComandaDetail…)
// restano quelle di sempre: l'italiano è la lingua di partenza, e i loro
// testi non sono cambiati. Questa guarda solo l'altra lingua.
//
// I DATI FINTI NON HANNO PAROLE ITALIANE («Campari», «Negroni», «Mario»,
// numeri): il controllo cerca proprio quelle, e un nome di prodotto
// italiano lo farebbe scattare per un dato, non per un testo dimenticato.
// Per la stessa ragione i prodotti sono «in assortimento» e «premium»: i
// titoli di «in linea» e «fuori assortimento» e le spiegazioni del filtro
// stanno nelle tabelle di src/lib (inventory.js, assortimento.js), che si
// traducono a parte.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'
import { italianoRimasto } from '../helpers/nienteItaliano.js'
import { impostaLingua } from '../../src/lib/lingua.js'

vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => vi.fn() }))
vi.mock('../../src/lib/firebaseClient.js', () => ({
  auth: { currentUser: { uid: 'u1', email: 'mario@bar.it' } },
  db: {},
}))
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb({ uid: 'u1', getIdTokenResult: async () => ({ claims: { role: 'bartender' } }) })
    return () => {}
  },
}))
vi.mock('../../src/lib/paginaPiena.js', () => ({ usePaginaPiena: () => {} }))
vi.mock('../../src/lib/toast.js', () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastSync: vi.fn(),
  showToast: vi.fn(),
}))
vi.mock('../../src/lib/printer.js', () => ({ printComanda: vi.fn(async () => {}) }))
vi.mock('../../src/lib/cashSession.js', () => ({
  useCashSession: () => ({ session: null, open: false, loading: false }),
}))

const ADESSO = Date.now()
const giorniFa = (n) => new Date(ADESSO - n * 86400000).toISOString()

const ITEMS = [
  {
    id: 'i1',
    name: 'Campari',
    unit: 'pz',
    package_size: 1000,
    content_unit: 'ml',
    stock: 2.5,
    category_id: 'c1',
    cost: 15,
    vat: 22,
    low_threshold: 1,
    status: 'assortimento',
  },
  {
    id: 'i2',
    name: 'Hendricks',
    unit: 'pz',
    package_size: 700,
    content_unit: 'ml',
    stock: 0,
    category_id: 'c1',
    cost: 30,
    vat: 22,
    status: 'premium',
  },
  { id: 'i3', name: 'Tonic', unit: 'pz', stock: 24, category_id: null, status: 'assortimento' },
]
const CATS = [{ id: 'c1', name: 'Spirits', sort_order: 0 }]
const SUPS = [{ id: 's1', name: 'NOVA', email: 'nova@example.com' }]
const MACRO = [{ id: 'm1', name: 'Bitters', sort_order: 0, pesi_prodotti: { i1: 100 }, pesi_voci: {} }]

// L'inventario in corso da due settimane, con una riga contata e una no.
const INVENTARIO = {
  id: 'inv1',
  status: 'open',
  started_at: giorniFa(14),
  lines: [
    { item_id: 'i1', name: 'Campari', unit: 'pz', package_size: 1000, cost: 15, vat: 22, dep: 3 },
    { item_id: 'i3', name: 'Tonic', unit: 'pz', cost: 1, vat: 22, dep: 30 },
  ],
  rimanenze: { i1: 2 },
}
const CHIUSO = {
  id: 'v1',
  status: 'closed',
  started_at: '2026-06-07T00:00:00.000Z',
  closed_at: '2026-06-21T00:00:00.000Z',
  totals: { counted: 1, cons_value: 15, rim_value: 5 },
  lines: [
    { item_id: 'i1', name: 'Campari', unit: 'pz', dep: 3, acq: 1, rim: 2, atteso: 2, cons: 2, cons_value: 30, rim_value: 30 },
    { item_id: 'i3', name: 'Tonic', unit: 'pz', dep: 30, acq: 0, rim: null, atteso: 24, cons: 6, cons_value: 6, rim_value: 24 },
  ],
}

// Le vendite, e il venduto su Tiller per il mese per mese. I nomi dei tipi di
// movimento (carico, consegna, rettifica) stanno in lib/movimentiProdotto.js,
// fra le tabelle di src/lib che si traducono a parte.
const MOVIMENTI = [
  { id: 'm2', item_id: 'i1', reason: 'ordine', type: 'unload', qty: 1, unit: 'pz', created_at: giorniFa(2) },
]

let ordine = null
vi.mock('../../src/lib/api.js', () => ({
  fetchInventoryItems: vi.fn(async () => ITEMS),
  fetchInventoryCategories: vi.fn(async () => CATS),
  fetchSuppliers: vi.fn(async () => SUPS),
  fetchSupplierPrices: vi.fn(async () => [{ supplier_id: 's1', item_id: 'i1', price: 15 }]),
  fetchCategories: vi.fn(async () => []),
  salvaRigaListino: vi.fn(async () => ({})),
  fetchStockMovements: vi.fn(async () => [
    { id: 'x1', item_name: 'Campari', reason: 'NOVA', type: 'load', qty: 6, unit: 'pz' },
  ]),
  fetchMovimentiProdotto: vi.fn(async () => MOVIMENTI),
  fetchVendutoStoricoProdotto: vi.fn(async () => ({ [new Date(ADESSO).toISOString().slice(0, 10)]: 3 })),
  fetchMacroCategories: vi.fn(async () => MACRO),
  fetchDrinks: vi.fn(async () => [{ id: 'd1', name: 'Negroni' }]),
  impostaPesoMacro: vi.fn(),
  createInventoryItem: vi.fn(),
  updateInventoryItem: vi.fn(),
  deleteInventoryItem: vi.fn(),
  loadStock: vi.fn(),
  resoAlFornitore: vi.fn(),
  adjustStock: vi.fn(),
  travasaMagazzinoAPezzi: vi.fn(),
  togliProdottoDagliOrdini: vi.fn(),
  createInventoryCategory: vi.fn(),
  updateInventoryCategory: vi.fn(),
  deleteInventoryCategory: vi.fn(),
  createMacroCategory: vi.fn(),
  updateMacroCategory: vi.fn(),
  deleteMacroCategory: vi.fn(),
  createSupplier: vi.fn(),
  updateSupplier: vi.fn(),
  deleteSupplier: vi.fn(),
  subscribeOpenCashSession: (cb) => {
    cb(null)
    return () => {}
  },
  subscribeActiveOrders: (cb) => {
    cb([])
    return () => {}
  },
  subscribeDrinks: (_opts, cb) => {
    cb([{ id: 'd1', name: 'Negroni', recipe_items: [{ inventory_item_id: 'i1', qty: 3, unit: 'cl' }] }])
    return () => {}
  },
  subscribeSettings: (cb) => {
    cb({ workflow_enabled: true, service_mode: 'entrambi' })
    return () => {}
  },
  settingsIniziali: () => ({ workflow_enabled: true, service_mode: 'entrambi' }),
  DEFAULT_SETTINGS: { price_markup: 3, purchase_vat: 22 },
  // L'inventario
  getOpenStockCount: vi.fn(async () => INVENTARIO),
  startStockCount: vi.fn(),
  salvaRimanenza: vi.fn(),
  closeStockCount: vi.fn(),
  fetchStockMovementsSince: vi.fn(async () => []),
  fetchStockCounts: vi.fn(async () => [CHIUSO]),
  // La comanda
  subscribeOrder: (_id, cb) => {
    cb(ordine)
    return () => {}
  },
  advanceComanda: vi.fn(() => Promise.resolve()),
  preparazioneParziale: vi.fn(() => Promise.resolve()),
  setOrderServiceMode: vi.fn(() => Promise.resolve({})),
}))

import InventoryManager from '../../src/components/InventoryManager.jsx'
import StockCountPanel from '../../src/components/StockCountPanel.jsx'
import StoricoInventari from '../../src/components/StoricoInventari.jsx'
import ComandaPage from '../../src/pages/ComandaPage.jsx'
import { subscribeSottosezioni } from '../../src/lib/sottosezioni.js'

// Le sezioni stanno nel menu in alto, fuori da questo componente: qui se ne
// rifà il pezzetto, come in InventoryManager.test.jsx, con le etichette che
// la pagina manda — che devono arrivare già tradotte.
function BarraSezioni() {
  const [sotto, setSotto] = useState({ voci: [], scegli: null })
  useEffect(() => subscribeSottosezioni(setSotto), [])
  return (
    <nav>
      {(sotto.voci || []).map((v) => (
        <button key={v.id} onClick={() => sotto.scegli?.(v.id)}>
          {v.label}
        </button>
      ))}
    </nav>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  impostaLingua('en')
})
afterEach(() => impostaLingua('it'))

describe('il magazzino in inglese (REQ-UI-039)', () => {
  it('la lista, una riga aperta, il carico, il contenuto reale e la scheda', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <>
        <InventoryManager />
        <BarraSezioni />
      </>
    )
    await screen.findByText('Campari')
    expect(screen.getByRole('button', { name: '+ New product' })).toBeInTheDocument()
    expect(screen.getByText('Inventory value')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])

    // La riga aperta: giacenza, costi, azioni.
    const riga = screen.getByText('Campari').closest('.inv-row')
    await user.click(within(riga).getByRole('button', { name: /Campari/ }))
    expect(within(riga).getByText('Pieces')).toBeInTheDocument()
    expect(within(riga).getByRole('button', { name: /In 1 menu recipe/ })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])

    // Il carico, a colli, e il reso.
    await user.click(within(riga).getByRole('button', { name: /Goods in/ }))
    await user.click(within(riga).getByRole('checkbox'))
    expect(within(riga).getByText('Pieces in a case')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
    await user.click(within(riga).getByRole('button', { name: /Return to supplier/ }))
    expect(within(riga).getByRole('button', { name: 'Confirm return' })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
    await user.click(within(riga).getByRole('button', { name: 'Cancel' }))

    // Il contenuto reale.
    await user.click(within(riga).getByRole('button', { name: 'Actual content' }))
    expect(within(riga).getByRole('button', { name: 'Save content' })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
    await user.click(within(riga).getByRole('button', { name: 'Cancel' }))

    // La vista a card.
    await user.click(screen.getByRole('button', { name: 'Cards' }))
    expect(italianoRimasto(container)).toEqual([])
    await user.click(screen.getByRole('button', { name: 'List' }))

    // La scheda del prodotto, col suo aiuto.
    await user.click(within(screen.getByText('Campari').closest('.inv-row')).getByRole('button', { name: /Edit/ }))
    expect(await screen.findByRole('heading', { name: 'Edit product' })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
    await user.click(screen.getByRole('button', { name: 'How to fill in this record' }))
    expect(screen.getByRole('dialog', { name: 'How to fill in this record' })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('i movimenti di un prodotto, con il venduto mese per mese', async () => {
    const user = userEvent.setup()
    const { container } = render(<InventoryManager />)
    await screen.findByText('Campari')
    const riga = screen.getByText('Campari').closest('.inv-row')
    await user.click(within(riga).getByRole('button', { name: /Campari/ }))
    await user.click(within(riga).getByRole('button', { name: /Stock movements/ }))
    const finestra = await screen.findByRole('dialog', { name: 'Stock movements of Campari' })
    await user.click(within(finestra).getByRole('button', { name: 'All' }))
    expect(await within(finestra).findByText('Sold month by month')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('le sezioni: categorie, macro-categorie, movimenti', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <>
        <InventoryManager />
        <BarraSezioni />
      </>
    )
    await screen.findByText('Campari')
    await user.click(screen.getByRole('button', { name: 'Categories' }))
    expect(await screen.findByPlaceholderText('New category (e.g. Spirits)')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Macro-categories' }))
    await user.click(await screen.findByRole('button', { name: /Bitters/ }))
    expect(screen.getAllByText('Only without macro', { exact: false }).length).toBe(2)
    expect(italianoRimasto(container)).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Stock movements' }))
    expect(await screen.findByText(/Campari · NOVA/)).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('l’inventario in corso e lo storico degli inventari', async () => {
    const user = userEvent.setup()
    const inCorso = render(<StockCountPanel />)
    expect(await screen.findByText(/Stock count in progress since/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Close stock count/ })).toBeInTheDocument()
    expect(italianoRimasto(inCorso.container)).toEqual([])
    inCorso.unmount()

    const storico = render(<StoricoInventari />)
    expect(await screen.findByText('Closed stock counts')).toBeInTheDocument()
    expect(italianoRimasto(storico.container)).toEqual([])
    await user.click(screen.getByRole('button', { name: /from 07\/06\/2026 to 21\/06\/2026/ }))
    expect(screen.getByRole('button', { name: /All stock counts/ })).toBeInTheDocument()
    expect(italianoRimasto(storico.container)).toEqual([])
  })
})

describe('la comanda al banco in inglese (REQ-UI-039)', () => {
  it('testata, passi, righe e azioni', async () => {
    const ORA = '2026-08-18T21:00:00.000Z'
    ordine = {
      id: 'o41',
      daily_number: 41,
      status: 'aperto',
      payment_status: 'parziale',
      payments: [{ amount: 5, method: 'contanti' }],
      table_label: '4',
      customer_name: 'Mario',
      created_at: ORA,
      service_mode: 'tavolo',
      comande: [
        {
          id: 'c1',
          seq: 1,
          status: 'in_preparazione',
          created_at: ORA,
          status_times: { ricevuto: ORA, in_preparazione: ORA },
          items: [{ drink_id: 'negroni', name: 'Negroni', qty: 3, unit_price: 9 }],
        },
      ],
    }
    const { container } = render(
      <MemoryRouter initialEntries={['/ordine/o41/comanda/c1']}>
        <Routes>
          <Route path="/ordine/:id/comanda/:comandaId" element={<ComandaPage />} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('To prepare')).toBeInTheDocument()
    expect(screen.getByText('Ticket total')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Open bill #41/ })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })
})
