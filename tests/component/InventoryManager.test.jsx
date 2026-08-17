// @vitest-environment happy-dom
'use strict'

// IL MAGAZZINO A SCHERMO. Quello che si legge sulle card e nella scheda di
// un prodotto: i numeri scritti come si leggono e le unità di misura che si
// possono scegliere. I calcoli stanno in tests/unit/inventory.test.js; qui
// si controlla che arrivino davanti a chi lavora nella forma giusta.

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/lib/api.js', () => {
  // Dichiarati QUI dentro: vi.mock viene issato in cima al file e non
  // vedrebbe una costante definita fuori.
  const items = [
    // Il Campari del 17 agosto: contato a pezzi, bottiglia da 1 L, e una
    // giacenza uscita da una moltiplicazione di ricetta.
    {
      id: 'campari',
      name: 'Campari',
      unit: 'pz',
      package_size: 1000,
      content_unit: 'ml',
      stock: 7.49000000000001,
      cost: 12,
      vat: 22,
    },
  ]
  return {
    fetchInventoryItems: vi.fn(() => Promise.resolve(items)),
    createInventoryItem: vi.fn((x) => Promise.resolve({ id: 'nuovo', ...x })),
    updateInventoryItem: vi.fn(() => Promise.resolve({})),
    deleteInventoryItem: vi.fn(() => Promise.resolve()),
    loadStock: vi.fn(() => Promise.resolve({})),
    receiveBottles: vi.fn(() => Promise.resolve({})),
    adjustStock: vi.fn(() => Promise.resolve({})),
    fetchStockMovements: vi.fn(() => Promise.resolve([])),
    fetchInventoryCategories: vi.fn(() => Promise.resolve([])),
    createInventoryCategory: vi.fn(() => Promise.resolve({})),
    updateInventoryCategory: vi.fn(() => Promise.resolve({})),
    deleteInventoryCategory: vi.fn(() => Promise.resolve()),
    fetchMacroCategories: vi.fn(() => Promise.resolve([])),
    createMacroCategory: vi.fn(() => Promise.resolve({})),
    updateMacroCategory: vi.fn(() => Promise.resolve({})),
    deleteMacroCategory: vi.fn(() => Promise.resolve()),
    fetchSuppliers: vi.fn(() => Promise.resolve([])),
    createSupplier: vi.fn(() => Promise.resolve({})),
    updateSupplier: vi.fn(() => Promise.resolve({})),
    deleteSupplier: vi.fn(() => Promise.resolve()),
    subscribeSettings: (cb) => {
      cb({ price_markup: 3, purchase_vat: 22 })
      return () => {}
    },
    DEFAULT_SETTINGS: { price_markup: 3, purchase_vat: 22 },
  }
})
// Le altre sezioni del magazzino (conta, ordini, scadenzario) hanno una vita
// loro e parlano con Firestore: qui non c'entrano.
vi.mock('../../src/components/StockCountPanel.jsx', () => ({ default: () => <div>CONTA</div> }))
vi.mock('../../src/components/PurchaseOrdersPanel.jsx', () => ({ default: () => <div>ORDINI</div> }))
vi.mock('../../src/components/SupplierInvoicesPanel.jsx', () => ({
  default: () => <div>SCADENZARIO</div>,
}))

import InventoryManager from '../../src/components/InventoryManager.jsx'
import { createInventoryItem } from '../../src/lib/api.js'

// Apre la vista a CARD (il default è la lista) e aspetta il prodotto.
async function apriCard(user) {
  await screen.findByText('Campari')
  await user.click(screen.getByRole('button', { name: '▦ Card' }))
}

describe('la card del magazzino', () => {
  it('sotto i pezzi c’è il CONTENUTO, non gli stessi pezzi un’altra volta', async () => {
    const user = userEvent.setup()
    render(<InventoryManager />)
    await apriCard(user)
    // Numero grande: quanti pezzi ci sono. Sotto: quanto prodotto c'è
    // dentro, che è quello che serve a chi sta versando.
    expect(screen.getByText('7,49 pz')).toBeInTheDocument()
    expect(screen.getByText('749 cl')).toBeInTheDocument()
  })

  it('e non compare mai «7.49000000001»', async () => {
    const user = userEvent.setup()
    render(<InventoryManager />)
    await apriCard(user)
    // Il numero grezzo del calcolo, col punto e la coda di decimali, non
    // deve arrivare a schermo da nessuna parte.
    expect(document.body.textContent).not.toMatch(/7\.49/)
    expect(document.body.textContent).not.toMatch(/\d\.\d{4}/)
  })
})

// IL DETTAGLIO DI UNA CARD DEVE STARE DENTRO LA CARD.
//
// Aprendo un prodotto nella vista a Card il pannello dei dettagli sbordava e
// il testo si incolonnava a fisarmonica: «0 pz · 0 piene · 1 pz = 100 cl» a
// capo quattro volte, e costo, IVA e prezzo consigliato accavallati. La
// coppia etichetta/valore usa la griglia a due colonne della vista a Lista,
// dove c'è tutta la larghezza dello schermo; in una card larga 175px la
// colonna del valore resta larga un dito.
//
// Il layout non si prova in jsdom (le larghezze non esistono): quello che si
// prova qui è che la struttura colpita dalla regola sia davvero quella che
// finisce a schermo, e che la regola nel foglio di stile ci sia.
describe('il dettaglio della card non sborda', () => {
  const css = readFileSync('src/index.css', 'utf8')

  it('la scheda aperta di una card è dentro la card', async () => {
    const user = userEvent.setup()
    render(<InventoryManager />)
    await apriCard(user)
    await user.click(screen.getByRole('button', { name: '⋯ Azioni' }))
    expect(
      document.querySelector('.grid-card .grid-card-actions .inv-info .inv-info-row')
    ).not.toBeNull()
  })

  it('dentro una card etichetta e valore si incolonnano', () => {
    expect(css).toMatch(
      /\.grid-card\s+\.grid-card-actions\s+\.inv-info\s+\.inv-info-row\s*\{[^}]*grid-template-columns:\s*1fr/
    )
  })

  it('nella lista, dove lo spazio c’è, restano due colonne', () => {
    // La vista a Lista occupa tutta la larghezza: là la coppia
    // etichetta/valore su una riga sola si legge meglio, e resta com'era.
    expect(css).toMatch(/\.inv-info \.inv-info-row \{[^}]*grid-template-columns: 96px 1fr/)
  })
})

// LA MANODOPERA È UN ARTICOLO IN UNITÀ GENERICHE.
// «Tempo di Lavorazione» si crea come voce di magazzino per mettere il lavoro
// a listino: ha un costo per unità e niente altro. Prima si potevano scegliere
// solo litri, centilitri, millilitri, grammi, milligrammi o pezzi, e si
// finiva a contare il tempo in grammi.
describe('il form del prodotto: unità generiche', () => {
  async function nuovoProdotto(user) {
    await screen.findByText('Campari')
    await user.click(screen.getByRole('button', { name: '+ Nuovo prodotto' }))
  }

  it('fra le unità di misura c’è il generico', async () => {
    const user = userEvent.setup()
    render(<InventoryManager />)
    await nuovoProdotto(user)
    const misura = screen.getByLabelText('Unità di misura')
    expect([...misura.options].map((o) => o.value)).toContain('U')
  })

  it('scelto il generico non si chiede un contenuto che non c’è', async () => {
    const user = userEvent.setup()
    render(<InventoryManager />)
    await nuovoProdotto(user)
    await user.selectOptions(screen.getByLabelText('Unità di misura'), 'U')
    // Niente confezione, niente contenuto del pezzo, niente soglia di
    // avviso: non è una scorta, non finisce e non si riordina.
    expect(screen.queryByLabelText(/Contenuto per confezione/)).toBeNull()
    expect(screen.queryByLabelText('Contenuto di un pezzo')).toBeNull()
    expect(screen.queryByLabelText(/Soglia di avviso/)).toBeNull()
    // Il costo però è il cuore della voce, e si legge per unità.
    expect(screen.getByLabelText(/Costo €\/U/)).toBeInTheDocument()
  })

  it('e si salva come articolo in U, senza giacenza', async () => {
    const user = userEvent.setup()
    render(<InventoryManager />)
    await nuovoProdotto(user)
    await user.selectOptions(screen.getByLabelText('Unità di misura'), 'U')
    await user.type(screen.getByLabelText('Nome *'), 'Tempo di Lavorazione')
    await user.type(screen.getByLabelText(/Costo €\/U/), '0.5')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(createInventoryItem).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Tempo di Lavorazione',
        unit: 'U',
        display_unit: 'U',
        package_size: null,
        stock: 0,
        low_threshold: 0,
      })
    )
  })
})
