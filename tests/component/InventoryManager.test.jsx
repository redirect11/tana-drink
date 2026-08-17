// @vitest-environment happy-dom
'use strict'

// IL MAGAZZINO, come lo si guarda davvero. Due requisiti erano implementati
// ma scoperti: la schermata a sezioni con ricerca, tendine e valore
// (REQ-MAG-010) e il conteggio a pezzi con la virgola nato dall'hotfix
// «3 bott.» (REQ-MAG-011) — tre bottiglie di cui una quasi vuota contavano
// come tre, e per sapere se bastavano per la serata si apriva il dettaglio.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { useEffect, useState } from 'react'

// I pannelli pesanti hanno i loro giri (conta, ordini, scadenzario): qui
// basta sapere che la sezione giusta monta il pannello giusto.
vi.mock('../../src/components/StockCountPanel.jsx', () => ({
  default: () => <div>PANNELLO CONTA</div>,
}))
vi.mock('../../src/components/PurchaseOrdersPanel.jsx', () => ({
  default: () => <div>PANNELLO ORDINI</div>,
}))
vi.mock('../../src/components/SupplierInvoicesPanel.jsx', () => ({
  default: () => <div>PANNELLO SCADENZARIO</div>,
}))
vi.mock('../../src/lib/paginaPiena.js', () => ({ usePaginaPiena: () => {} }))
vi.mock('../../src/lib/toast.js', () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastSync: vi.fn(),
}))

// Il magazzino di prova: quattro prodotti che coprono i casi che contano.
// Le giacenze sono in unità BASE (ml), come da REQ-MAG-001.
const ITEMS = [
  {
    id: 'i1',
    name: 'Gin Mare',
    unit: 'ml',
    package_size: 1000, // bottiglia da 100 cl…
    stock: 500, // …piena a metà → 0,5 pz
    category_id: 'c1',
    supplier_id: 's1',
    cost: 20,
    vat: 22,
    low_threshold: 0,
    status: 'linea',
  },
  {
    id: 'i2',
    name: 'Rum Diplomatico',
    unit: 'ml',
    package_size: 700,
    stock: 1750, // 2 piene + mezza → 2,5 pz
    category_id: 'c1',
    supplier_id: 's2',
    cost: 30,
    vat: 22,
    status: 'premium',
  },
  {
    id: 'i3',
    name: 'Vodka Vecchia',
    unit: 'ml',
    package_size: 700,
    stock: 0, // esaurita → 0 pz
    category_id: 'c1',
    status: 'out',
  },
  {
    id: 'i4',
    name: 'Ichnusa',
    unit: 'pz', // già contata a pezzi: il numero è il suo
    content_unit: 'ml',
    package_size: 330,
    stock: 12,
    category_id: 'c2',
    supplier_id: 's1',
    status: 'assortimento',
  },
]
const CATS = [
  { id: 'c1', name: 'Distillati', sort_order: 0 },
  { id: 'c2', name: 'Birre', sort_order: 1 },
]
const SUPS = [
  { id: 's1', name: 'NOVA' },
  { id: 's2', name: 'ENOFEL' },
]

vi.mock('../../src/lib/api.js', () => ({
  fetchInventoryItems: vi.fn(async () => ITEMS),
  fetchInventoryCategories: vi.fn(async () => CATS),
  fetchSuppliers: vi.fn(async () => SUPS),
  fetchStockMovements: vi.fn(async () => []),
  fetchMacroCategories: vi.fn(async () => []),
  createInventoryItem: vi.fn(),
  updateInventoryItem: vi.fn(),
  deleteInventoryItem: vi.fn(),
  loadStock: vi.fn(),
  receiveBottles: vi.fn(),
  adjustStock: vi.fn(),
  createInventoryCategory: vi.fn(),
  updateInventoryCategory: vi.fn(),
  deleteInventoryCategory: vi.fn(),
  createMacroCategory: vi.fn(),
  updateMacroCategory: vi.fn(),
  deleteMacroCategory: vi.fn(),
  createSupplier: vi.fn(),
  updateSupplier: vi.fn(),
  deleteSupplier: vi.fn(),
  subscribeSettings: vi.fn((cb) => {
    cb({ price_markup: 3, purchase_vat: 22 })
    return () => {}
  }),
  DEFAULT_SETTINGS: { price_markup: 3, purchase_vat: 22 },
}))

import InventoryManager from '../../src/components/InventoryManager.jsx'
import { subscribeSottosezioni } from '../../src/lib/sottosezioni.js'

// Le sezioni stanno nel menu a scomparsa, sotto la pagina aperta: qui si
// rifà quel pezzetto di menu (come nel test delle Impostazioni), così la
// prova resta «scelgo una sezione, si apre il suo pannello».
function BarraSezioni() {
  const [sotto, setSotto] = useState({ voci: [], attiva: null, scegli: null })
  useEffect(() => subscribeSottosezioni(setSotto), [])
  return (
    <div>
      {(sotto.voci || []).map((v) => (
        <button key={v.id} onClick={() => sotto.scegli?.(v.id)}>
          {v.icona} {v.label}
        </button>
      ))}
    </div>
  )
}

const mostra = () =>
  render(
    <>
      <InventoryManager />
      <BarraSezioni />
    </>
  )

// La lista è pronta quando c'è il primo prodotto.
const aspettaLista = () => screen.findByText('Gin Mare')

beforeEach(() => vi.clearAllMocks())

describe('la schermata del magazzino (REQ-MAG-010)', () => {
  it('le sezioni stanno nella barra: otto voci, e ognuna apre il suo pannello', async () => {
    const user = userEvent.setup()
    mostra()
    await aspettaLista()
    for (const voce of [
      'Prodotti',
      'Conta',
      'Ordini',
      'Scadenzario',
      'Categorie',
      'Macro-categorie',
      'Fornitori',
      'Movimenti',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(voce) })).toBeInTheDocument()
    }
    await user.click(screen.getByRole('button', { name: /Conta/ }))
    expect(screen.getByText('PANNELLO CONTA')).toBeInTheDocument()
    expect(screen.queryByText('Gin Mare')).toBeNull()
  })

  it('sopra la lista: ricerca, due tendine chiuse, il valore che si legge e non si tocca', async () => {
    mostra()
    await aspettaLista()
    expect(screen.getByPlaceholderText(/Cerca prodotto/)).toBeInTheDocument()
    // Le tendine sono CHIUSE: il tasto dice cosa è scelto, le voci no.
    expect(screen.getByRole('button', { name: /⚗️ Filtra/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /🏭 Fornitore/ })).toBeInTheDocument()
    expect(screen.queryByText('In esaurimento')).toBeNull()
    // Il valore di magazzino è un numero da leggere, non un filtro.
    const valore = screen.getByText('Valore magazzino')
    expect(valore.closest('button')).toBeNull()
    // Card/lista sono due icone; si parte a LISTA.
    expect(screen.getByRole('button', { name: 'A lista' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '+ Nuovo prodotto' })).toBeInTheDocument()
  })

  it('la ricerca restringe la lista, e a vuoto lo dice', async () => {
    const user = userEvent.setup()
    mostra()
    await aspettaLista()
    await user.type(screen.getByPlaceholderText(/Cerca prodotto/), 'gin')
    expect(screen.getByText('Gin Mare')).toBeInTheDocument()
    expect(screen.queryByText('Ichnusa')).toBeNull()
    await user.clear(screen.getByPlaceholderText(/Cerca prodotto/))
    await user.type(screen.getByPlaceholderText(/Cerca prodotto/), 'zzz')
    expect(screen.getByText('Nessun prodotto corrisponde ai filtri.')).toBeInTheDocument()
  })

  it('il filtro di scorta: «Esauriti» lascia solo chi è a zero, e si toglie con un tasto', async () => {
    const user = userEvent.setup()
    mostra()
    await aspettaLista()
    await user.click(screen.getByRole('button', { name: /⚗️ Filtra/ }))
    await user.click(screen.getByRole('button', { name: /Esauriti/ }))
    expect(screen.getByText('Vodka Vecchia')).toBeInTheDocument()
    expect(screen.queryByText('Gin Mare')).toBeNull()
    await user.click(screen.getByRole('button', { name: /Togli i filtri/ }))
    expect(screen.getByText('Gin Mare')).toBeInTheDocument()
  })

  it('l’assortimento filtra a più valori insieme (linea + premium)', async () => {
    // REQ-MAG-007 visto dalla schermata: la domanda vera è quasi sempre
    // combinata («linea e premium, senza gli out»).
    const user = userEvent.setup()
    mostra()
    await aspettaLista()
    await user.click(screen.getByRole('button', { name: /⚗️ Filtra/ }))
    await user.click(screen.getByRole('button', { name: /In linea/ }))
    await user.click(screen.getByRole('button', { name: /Premium/ }))
    expect(screen.getByText('Gin Mare')).toBeInTheDocument()
    expect(screen.getByText('Rum Diplomatico')).toBeInTheDocument()
    expect(screen.queryByText('Ichnusa')).toBeNull()
    expect(screen.queryByText('Vodka Vecchia')).toBeNull()
  })

  it('la tendina del fornitore restringe ai suoi prodotti e si richiude', async () => {
    const user = userEvent.setup()
    mostra()
    await aspettaLista()
    await user.click(screen.getByRole('button', { name: /🏭 Fornitore/ }))
    await user.click(screen.getByRole('button', { name: 'NOVA' }))
    expect(screen.getByText('Gin Mare')).toBeInTheDocument()
    expect(screen.getByText('Ichnusa')).toBeInTheDocument()
    expect(screen.queryByText('Rum Diplomatico')).toBeNull()
    // Scelto il fornitore, il tasto lo dice senza doversi riaprire.
    expect(screen.getByRole('button', { name: /🏭 NOVA/ })).toBeInTheDocument()
  })

  it('«+ Nuovo prodotto» apre il modulo con Salva e Annulla', async () => {
    const user = userEvent.setup()
    mostra()
    await aspettaLista()
    await user.click(screen.getByRole('button', { name: '+ Nuovo prodotto' }))
    expect(screen.getByRole('button', { name: 'Salva' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeInTheDocument()
  })
})

describe('le scorte parlano a pezzi (REQ-MAG-011)', () => {
  it('la colonna dice i pezzi con la virgola: 0,5 · 2,5 · 0 · 12', async () => {
    mostra()
    await aspettaLista()
    // Mezza bottiglia da 100 cl → 0,5 pz («3 bott.» diceva quante se ne
    // toccano, non quanto prodotto c'è dentro).
    expect(screen.getByText(/0,5 pz/)).toBeInTheDocument()
    // Due piene da 70 cl più mezza → 2,5 pz.
    expect(screen.getByText(/2,5 pz/)).toBeInTheDocument()
    // Esaurita: lo dice il numero, 0 pz.
    expect(screen.getByText(/^0 pz/)).toBeInTheDocument()
    // Già contata a pezzi (le bibite): il numero è il suo.
    expect(screen.getByText(/12 pz/)).toBeInTheDocument()
  })

  it('in riga nessuna didascalia di stato; le bottiglie restano nel dettaglio', async () => {
    const user = userEvent.setup()
    mostra()
    await aspettaLista()
    // «piena / aperta 46 cl / esaurito» accanto ai pezzi era una didascalia:
    // lo stato è già nel numero.
    expect(screen.queryByText(/aperta/)).toBeNull()
    // Il dettaglio invece le conta, per chi va a guardare lo scaffale.
    await user.click(screen.getByRole('button', { name: /Gin Mare/ }))
    expect(screen.getByText('Pezzi')).toBeInTheDocument()
    expect(screen.getByText(/1 aperta \(50 cl\)/)).toBeInTheDocument()
    // E il contenuto resta nella sua unità parlata (qui 1 L): un pezzo è
    // la bottiglia, dentro non ci sono pezzi.
    expect(screen.getAllByText(/1 pz =/).length).toBeGreaterThan(0)
  })

  it('l’assortimento si legge dai segni: OUT in chiaro, la coroncina sui premium', async () => {
    mostra()
    await aspettaLista()
    const vodka = screen.getByText('Vodka Vecchia').closest('.inv-row')
    expect(within(vodka).getByText('OUT')).toBeInTheDocument()
    const rum = screen.getByText('Rum Diplomatico').closest('.inv-row')
    expect(within(rum).getByTitle('Premium')).toBeInTheDocument()
  })
})
