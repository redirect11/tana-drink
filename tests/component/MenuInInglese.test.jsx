// @vitest-environment happy-dom
'use strict'

// IL MENÙ DEL GESTIONALE IN INGLESE (REQ-UI-039). Daniele, 17/11/2026:
// «chiunque può scegliere la lingua nel gestionale». La gestione del
// listino è la parte del gestionale con più testi: la griglia dei
// prodotti con le loro azioni, la scheda del drink coi suoi aiuti, le
// categorie, la marginalità, gli Special, lo switch prodotto e l'editor del
// menù dei clienti. Qui si apre ognuna con la lingua inglese e si chiede
// cosa è rimasto in italiano (tests/helpers/nienteItaliano.js): un `tr`
// dimenticato si vede qui, non dal gestore che sta ritoccando i prezzi.
//
// I nomi di drink, categorie e ingredienti sono dati e restano come sono:
// per questo quelli finti non hanno parole italiane («Negroni», «Spritz»,
// «Gin»), che il controllo troverebbe dove non c'è niente da correggere.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within, act, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { italianoRimasto } from '../helpers/nienteItaliano.js'

const filo = vi.hoisted(() => ({ carta: { sezioni: [], voci: [] } }))

const DRINKS = [
  {
    id: 'negroni',
    name: 'Negroni',
    price: 8,
    description: 'Bitter, gin, vermouth',
    available: true,
    speciale: true,
    category_id: 'c1',
    recipe_items: [
      { inventory_item_id: 'gin', name: 'Gin', qty: 30, unit: 'ml' },
      { inventory_item_id: 'bitter', name: 'Bitter', qty: 30, unit: 'ml' },
    ],
  },
  {
    id: 'spritz',
    name: 'Spritz',
    price: 6,
    description: '',
    available: false,
    category_id: 'c1',
    recipe_items: [{ inventory_item_id: 'bitter', name: 'Bitter', qty: 60, unit: 'ml' }],
  },
  // Senza ingredienti valorizzati: la marginalità lo segna «costo incompleto».
  { id: 'cola', name: 'Cola', price: 3, available: true, category_id: 'c2', recipe_items: [{ inventory_item_id: 'cola-pz', name: 'Cola', qty: 1, unit: 'pz' }] },
]
const CATEGORIE = [
  { id: 'c1', name: 'Cocktail', sort_order: 0 },
  { id: 'c2', name: 'Soft', sort_order: 1 },
]
const MAGAZZINO = [
  { id: 'gin', name: 'Gin', unit: 'pz', package_size: 700, content_unit: 'ml', qty: 4, cost: 21, vat: 22 },
  { id: 'bitter', name: 'Bitter', unit: 'pz', package_size: 1000, content_unit: 'ml', qty: 1, min_qty: 2, cost: 14, vat: 22 },
  { id: 'tonic', name: 'Tonic', unit: 'pz', package_size: 1000, content_unit: 'ml', qty: 2, cost: 2, vat: 22 },
  { id: 'cola-pz', name: 'Cola', unit: 'pz', qty: 0 },
]

vi.mock('../../src/lib/api.js', () => ({
  fetchDrinks: vi.fn(() => Promise.resolve(DRINKS)),
  updateDrink: vi.fn(() => Promise.resolve()),
  deleteDrink: vi.fn(() => Promise.resolve()),
  subscribeCarta: vi.fn((onChange) => {
    onChange(filo.carta)
    return () => {}
  }),
  creaSezioneCarta: vi.fn((s) => ({ id: 'nuova', ...s })),
  prepopolaStruttura: vi.fn((c) => c),
  eliminaStruttura: vi.fn(),
  riordinaSezioniCarta: vi.fn(),
  riordinaVociCarta: vi.fn(),
  spostaVociCarta: vi.fn(),
  aggiornaSezioneCarta: vi.fn(),
  eliminaSezioneCarta: vi.fn(),
  creaVoceCarta: vi.fn((v) => ({ id: 'voce-nuova', ...v })),
  aggiornaVoceCarta: vi.fn(),
  eliminaVoceCarta: vi.fn(),
  subscribeCategories: vi.fn((onChange) => {
    onChange(CATEGORIE)
    return () => {}
  }),
  createCategory: vi.fn(() => Promise.resolve({ id: 'c2', name: 'Tiki' })),
  updateCategory: vi.fn(() => Promise.resolve()),
  deleteCategory: vi.fn(() => Promise.resolve()),
  fetchInventoryItems: vi.fn(() => Promise.resolve(MAGAZZINO)),
  fetchInventoryCategories: vi.fn(() => Promise.resolve([])),
  subscribePosPrefs: vi.fn(() => () => {}),
  savePosColors: vi.fn(() => Promise.resolve()),
  subscribeSettings: vi.fn((cb) => {
    cb({ price_markup: 4, special_attivo: true })
    return () => {}
  }),
  updateSettings: vi.fn(() => Promise.resolve()),
  switchProdotto: vi.fn(() => Promise.resolve({ ricette: 2, voci: 0 })),
  DEFAULT_SETTINGS: { price_markup: 4 },
  settingsIniziali: () => ({ price_markup: 4, sale_vat: 10 }),
}))
vi.mock('../../src/lib/storage.js', () => ({ deleteDrinkImageByUrl: vi.fn(() => Promise.resolve()) }))
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,QR') } }))
vi.mock('../../src/lib/saveDrink.js', () => ({ saveDrinkFromForm: vi.fn(() => Promise.resolve()) }))
// L'AI della scheda (REQ-AI-003): la proposta c'è, e i suoi testi pure.
const chiamata = vi.fn()
vi.mock('../../src/porte/funzioni.js', () => ({ chiamaFunzione: (_nome, dati) => chiamata(dati) }))
vi.mock('../../src/lib/limiti.js', async (originale) => ({
  ...(await originale()),
  senzaFunctions: () => false,
  aiNelPiano: () => true,
}))

import MenuManager from '../../src/components/MenuManager.jsx'
import RitaglioFoto from '../../src/components/RitaglioFoto.jsx'
import DrinkForm from '../../src/components/DrinkForm.jsx'
import { AiutiCampi } from '../../src/lib/aiutiCampi.js'
import { subscribeSottosezioni } from '../../src/lib/sottosezioni.js'
import { _azzeraStatoAI } from '../../src/lib/statoAI.js'
import { impostaLingua } from '../../src/lib/lingua.js'

beforeEach(() => {
  localStorage.clear()
  filo.carta = { sezioni: [], voci: [] }
  _azzeraStatoAI()
  chiamata.mockReset()
  chiamata.mockImplementation(async (dati) =>
    dati.tipo === 'credito'
      ? { ok: true, tipo: 'credito', credito_eur: 5, tetto_mensile_eur: 20, speso_mese_eur: 0, attivo: true, motivo: null }
      : { ok: true, tipo: 'descrizione', risultato: { descrizione: 'Gin, bitter, vermouth.', da_verificare: ['vermouth'] }, costo_eur: 0.01, credito_eur: 4.99 }
  )
  impostaLingua('en')
})
// Prima si smonta, poi si torna all'italiano: le schermate che ascoltano la
// lingua (useLingua) si ridisegnerebbero fuori da act.
afterEach(() => {
  cleanup()
  impostaLingua('it')
})

// Gli aiuti sotto i campi accesi: sono testi anche loro.
const monta = () =>
  render(
    <AiutiCampi.Provider value={true}>
      <MenuManager />
    </AiutiCampi.Provider>
  )

// Le sottosezioni stanno nel menu laterale (lib/sottosezioni.js): qui si
// sceglie come farebbe il menu.
async function vaiA(id) {
  const viste = []
  const stop = subscribeSottosezioni((s) => viste.push(s))
  const ultima = () => viste[viste.length - 1]
  await waitFor(() => expect(ultima()?.voci?.some((v) => v.id === id)).toBe(true))
  // Le etichette del menu laterale sono testi dell'area anche loro.
  expect(italianoRimasto(Object.assign(document.createElement('div'), { textContent: ultima().voci.map((v) => v.label).join('\n') }))).toEqual([])
  await act(async () => ultima().scegli(id))
  stop()
}

describe('il menù del gestionale in inglese (REQ-UI-039)', () => {
  it('la griglia dei prodotti, con le azioni aperte e lo switch prodotto: niente italiano a schermo', async () => {
    const user = userEvent.setup()
    const { container } = monta()
    const card = (await screen.findByText('Negroni')).closest('.menu-card')
    expect(screen.getByRole('button', { name: /Add product/ })).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: /Actions/ }))
    await user.click(within(card).getByRole('button', { name: 'Colour of Negroni' }))

    await user.click(screen.getByRole('button', { name: /Product switch/ }))
    await user.selectOptions(screen.getByLabelText('Outgoing product'), 'bitter')
    await user.selectOptions(screen.getByLabelText('Incoming product'), 'gin')
    expect(screen.getByRole('button', { name: 'Replace in 2 recipes' })).toBeInTheDocument()

    expect(italianoRimasto(container)).toEqual([])
  })

  it('la scheda di un drink, con prezzo consigliato, costi di riga e proposta dell’AI: niente italiano', async () => {
    const user = userEvent.setup()
    const { container } = monta()
    const card = (await screen.findByText('Negroni')).closest('.menu-card')
    await user.click(within(card).getByRole('button', { name: /Actions/ }))
    await user.click(within(card).getByRole('button', { name: /Edit/ }))

    expect(await screen.findByRole('heading', { name: 'Edit product' })).toBeInTheDocument()
    expect(screen.getByText('Actual cost (ingredients)')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /Suggest a description with AI/ }))
    expect(await screen.findByText('Gin, bitter, vermouth.')).toBeInTheDocument()
    // Una riga di ricetta senza dose: l'errore del salvataggio è un testo anche lui.
    await user.click(screen.getByRole('button', { name: /Ingredient/ }))
    await user.selectOptions(screen.getAllByRole('combobox').at(-2), 'tonic')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/The recipe has no quantity for «Tonic»/)).toBeInTheDocument()

    expect(italianoRimasto(container)).toEqual([])
  })

  it('il ritaglio della foto: niente italiano', () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:prova'), revokeObjectURL: vi.fn() })
    const { container } = render(
      <RitaglioFoto file={new File(['x'], 'negroni.png', { type: 'image/png' })} onConferma={() => {}} onAnnulla={() => {}} />
    )
    expect(screen.getByRole('dialog', { name: 'Crop the photo' })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
    vi.unstubAllGlobals()
  })

  // Il disegno del drink (illustrazioneDrink.js): bicchieri, colori e
  // decorazioni hanno il nome nel title e nell'aria-label, ed è un testo.
  it('il disegno del drink: bicchieri, colori e decorazioni in inglese', async () => {
    const { container } = render(
      <DrinkForm
        initial={{ ...DRINKS[0], illustrazione: { bicchiere: 'coppa', colore: 'rosa', decorazione: 'nessuna' } }}
        categories={CATEGORIE}
        inventory={MAGAZZINO}
        disegniConsentiti
        onCancel={() => {}}
        onSave={() => {}}
      />
    )
    // La scheda finisce di caricare (credito dell'AI) prima di guardarla.
    await act(async () => {})
    expect(screen.getByRole('button', { name: 'Coupe' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Light blue' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '«Drink me» tag' })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('categorie, marginalità e Special: niente italiano', async () => {
    const { container } = monta()
    await screen.findByText('Negroni')

    await vaiA('categorie')
    expect(await screen.findByPlaceholderText('New category')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])

    await vaiA('margini')
    expect(await screen.findByText('Margins')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])

    await vaiA('special')
    expect(await screen.findByRole('heading', { name: /Specials menu$/ })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('il menù dei clienti, prima della personalizzazione: niente italiano', async () => {
    const { container } = monta()
    await screen.findByText('Negroni')
    await vaiA('carta')
    expect(await screen.findByRole('button', { name: 'Prefill with the till items' })).toBeInTheDocument()
    // Il nome della sezione dei prodotti senza categoria è quello che
    // l'app scriverà davvero (lib/strutturaMenu.js, NON_CATEGORIZZATI): un
    // DATO, che i clienti leggono in italiano, e la spiegazione lo cita
    // com'è. Tradotto è solo dove fa da etichetta (la tendina dei prodotti).
    expect(italianoRimasto(container).filter((t) => !t.includes('Non categorizzati'))).toEqual([])
  })

  it('il menù dei clienti personalizzato, con una sezione e una voce aperte: niente italiano', async () => {
    const user = userEvent.setup()
    filo.carta = {
      sezioni: [
        { id: 's-sig', nome: 'Signature', ordine: 0, vista: 'dettagliata', nascosta: false },
        { id: 's-soft', nome: 'Soft', ordine: 1, vista: 'snella', nascosta: true, gruppo: 'Drinks' },
      ],
      voci: [
        { id: 'v-negroni', sezione_id: 's-sig', drink_id: 'negroni', nome: 'Negroni Sbagliato', descrizione: 'Bubbles', ordine: 0 },
        { id: 'v-orfana', sezione_id: 's-sig', drink_id: null, nome: 'Daiquiri', ordine: 1 },
        { id: 'v-spritz', sezione_id: 's-soft', drink_id: 'spritz', ordine: 0 },
      ],
    }
    const { container } = monta()
    await screen.findByText('Negroni')
    await vaiA('carta')

    const sezione = await screen.findByRole('region', { name: 'Section Signature' })
    await user.click(within(sezione).getByRole('button', { name: 'Expand section Signature' }))
    await user.click(within(sezione).getByRole('button', { name: 'Expand Negroni Sbagliato' }))
    await user.click(within(sezione).getByRole('checkbox', { name: 'Select Negroni Sbagliato' }))
    expect(screen.getByRole('group', { name: 'Selected items' })).toHaveTextContent('1 item selected')
    // Le proposte degli ingredienti mentre si scrive.
    await user.type(within(sezione).getAllByRole('textbox', { name: 'Add an ingredient' })[0], 'Gi')
    const proposte = screen.getByRole('listbox', { name: 'Suggestions' })
    // Il gruppo di ogni proposta (etichetteIngredienti.js, GRUPPI_SUGGERIMENTO).
    expect(within(proposte).getAllByText(/^(from the recipe|inventory)$/).length).toBeGreaterThan(0)
    // La vista della sezione (strutturaMenu.js, VISTE_SEZIONE).
    expect(within(sezione).getByRole('option', { name: 'Compact' })).toBeInTheDocument()

    expect(italianoRimasto(container)).toEqual([])

    // Le conferme dei gesti grossi.
    await user.click(screen.getByRole('button', { name: 'Group by category' }))
    expect(await screen.findByText('Group by category?')).toBeInTheDocument()
    expect(italianoRimasto(container.ownerDocument.body)).toEqual([])
  })
})
