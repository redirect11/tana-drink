// @vitest-environment happy-dom
'use strict'

// IL MENÙ È UNO SOLO. C'è stata una seconda schermata, riservata allo staff:
// catalogo a due colonne con la ricerca, nata per gli ordini battuti a mano.
// Quelli si battono al POS, e chi apriva il menù dal gestionale si trovava
// una pagina diversa da quella che stava mostrando al tavolo. Ora chi lavora
// vede lo stesso menù del cliente — e ci può ordinare, se le impostazioni lo
// consentono. La RICERCA è tornata, ma dentro la stessa pagina e solo per lo
// staff: la sala prende l'ordine col cliente davanti e non può scorrere otto
// categorie; il cliente invece sfoglia la vetrina, senza barra.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from '../helpers/router.jsx'
import { Routes, Route, useLocation } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'
import { CON_LICENZA, LICENZA_TANA } from '../helpers/licenza.js'
import { segnapostoDrink } from '../../src/lib/speciali.js'

let mockSettings = {}
let ruoloClaim = 'bartender'

vi.mock('../../src/lib/api.js', () => ({
  subscribeServiceStats: vi.fn(() => () => {}),
  subscribeSettings: vi.fn((cb) => {
    cb({ service_mode: 'tavolo', menu_only: false, ...CON_LICENZA, ...mockSettings })
    return () => {}
  }),
  subscribeOrder: vi.fn((id, cb) => {
    cb(ordineRicordato)
    return () => {}
  }),
  subscribeReadyOrders: vi.fn(() => () => {}),
  subscribeOpenGroups: vi.fn(() => () => {}),
  subscribeRecentGroups: vi.fn(() => () => {}),
  createOrder: vi.fn(() => Promise.resolve({
    id: 'o1',
    daily_number: 7,
    order_items: [{ drink_id: 'd1', name: 'Mojito', qty: 1, unit_price: 7 }],
    comande: [{ id: 'c1', seq: 1, items: [{ drink_id: 'd1', name: 'Mojito', qty: 1, unit_price: 7 }] }],
  })),
  DEFAULT_SETTINGS: { service_mode: 'tavolo' },
  settingsIniziali: () => ({ service_mode: 'tavolo' }),
}))

const DRINKS = [
  { id: 'd1', name: 'Mojito', price: 7, category_id: 'c1', available: true },
  { id: 'd2', name: 'Negroni', price: 8, category_id: 'c1', available: true },
  { id: 'd3', name: 'Ichnusa', price: 4, category_id: 'c2', available: true },
]
let mockDrinks = DRINKS
// La struttura del menù dei clienti (REQ-MENU-025): vuota di suo, come per
// il locale che non la personalizza.
const CARTA_VUOTA = { sezioni: [], voci: [] }
let mockCarta = CARTA_VUOTA

vi.mock('../../src/lib/menuCache.js', () => ({
  useMenu: () => ({
    loading: false,
    cats: [
      { id: 'c1', name: 'Cocktail', sort_order: 1 },
      { id: 'c2', name: 'Birre', sort_order: 2 },
    ],
    drinks: mockDrinks,
  }),
  useStrutturaMenu: () => ({ carta: mockCarta, pronta: true }),
}))

// L'ordine che questo dispositivo si ricorda (il cliente lo ritrova in cima
// al menù; chi lavora no).
const ordineRicordato = {
  id: 'o-mio',
  daily_number: 7,
  workflow_status: 'ricevuto',
  total: 8,
  order_items: [{ drink_id: 'd1', name: 'Negroni', qty: 1, unit_price: 8 }],
}

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

// La stampa non si prova davvero (non c'è nessuna Epson qui): si guarda se
// l'ordine preso al tavolo chiede la sua comanda, e a chi.
let stampaSala = 'ip'
const stampata = vi.fn(() => Promise.resolve())
let mockComandaDa = 'tutti'
vi.mock('../../src/lib/printer.js', async (originale) => ({
  printComanda: (...a) => stampata(...a),
  salaStampaDaSe: () => stampaSala !== 'rimbalzo',
  // Da dove deve venire la comanda per uscire da sola (REQ-STAMPA-021):
  // la regola vera, sulle impostazioni del terminale.
  stampaDa: (await originale()).stampaDa,
  loadPrinterSettings: () => ({ autoPrintComandaDa: mockComandaDa }),
}))

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
  mockDrinks = DRINKS
  mockCarta = CARTA_VUOTA
  ruoloClaim = 'bartender'
  stampaSala = 'ip'
  stampata.mockClear()
  localStorage.clear()
  // Al primo accesso il menù mostra il benvenuto a tutta pagina.
  localStorage.setItem('drink_welcome_v1', '1')
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
  })

  it('lo staff ha la ricerca: filtra per nome e svuota le categorie mute', async () => {
    const user = userEvent.setup()
    mostra()
    await screen.findByText(/Inserimento ordine da/)
    await user.type(screen.getByPlaceholderText(/Cerca nel menù/), 'moj')
    expect(voci()).toEqual(['Mojito'])
    // La categoria rimasta senza voci sparisce con tutta la sua testata.
    expect(screen.queryByRole('heading', { name: 'Birre' })).toBeNull()
  })

  it('la ricerca a vuoto lo dice, senza lasciare la pagina muta', async () => {
    const user = userEvent.setup()
    mostra()
    await screen.findByText(/Inserimento ordine da/)
    await user.type(screen.getByPlaceholderText(/Cerca nel menù/), 'ramazzotti')
    expect(voci()).toEqual([])
    expect(screen.getByText(/Niente nel menù che risponda/)).toBeInTheDocument()
  })

  it('il cliente la barra di ricerca non ce l’ha: per lui resta la vetrina', async () => {
    ruoloClaim = null
    mostra()
    await screen.findByText('Mojito')
    expect(screen.queryByPlaceholderText(/Cerca nel menù/)).toBeNull()
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

  // IN CARTA CI VA QUELLO CHE SI BEVE.
  // La lista ingredienti sotto al drink stampa le righe della ricetta, e fra
  // quelle righe adesso c'è anche la manodopera, che è una voce di magazzino
  // in unità generiche (U) messa lì per far entrare il lavoro nel costo:
  // «Tempo di Lavorazione 3 U» non è roba da far leggere a chi ordina.
  it('la manodopera non si mostra al cliente', async () => {
    ruoloClaim = null
    mockSettings = { show_ingredient_quantities: true }
    mockDrinks = [
      {
        id: 'd4',
        name: 'Daiquiri',
        price: 8,
        category_id: 'c1',
        available: true,
        recipe_items: [
          { inventory_item_id: 'rum', name: 'Rum', unit: 'ml', qty: 50 },
          { inventory_item_id: 'lime', name: 'Lime', unit: 'pz', qty: 1 },
          { inventory_item_id: 'tempo', name: 'Tempo di Lavorazione', unit: 'U', qty: 3 },
        ],
      },
    ]
    mostra()
    await screen.findByText('Daiquiri')
    const ingredienti = document.querySelector('.ingredients').textContent
    expect(ingredienti).toContain('Rum')
    expect(ingredienti).toContain('Lime')
    expect(ingredienti).not.toContain('Tempo di Lavorazione')
    expect(ingredienti).not.toMatch(/\bU\b/)
  })

  // Le ricette vere del test, stampate com'erano, dicevano «Ghiaccio
  // Hoshizaki · Tempo di Lavorazione» e «Lime Succo Homemade 1kg - 50cl»
  // (REQ-MENU-019).
  it('dalla ricetta il cliente non legge ghiaccio, manodopera e formati di confezione', async () => {
    ruoloClaim = null
    mockSettings = {}
    mockDrinks = [
      {
        id: 'd6',
        name: 'Cuba Libre',
        price: 8,
        category_id: 'c1',
        available: true,
        recipe_items: [
          { inventory_item_id: 'rum', name: 'Matusalem 7 anni', unit: 'ml', qty: 50 },
          { inventory_item_id: 'lime', name: 'Lime Succo Homemade 1kg - 50cl', unit: 'ml', qty: 20 },
          { inventory_item_id: 'cola', name: 'Coca Cola Lattina', unit: 'pz', qty: 1 },
          { inventory_item_id: 'ghiaccio', name: 'Ghiaccio Hoshizaki', unit: 'g', qty: 320 },
          { inventory_item_id: 'tempo', name: 'Tempo di Lavorazione', unit: 'g', qty: 1.5 },
        ],
      },
    ]
    mostra()
    await screen.findByText('Cuba Libre')
    expect(document.querySelector('.ingredients')).toHaveTextContent(
      /^Matusalem 7 anni · Lime Succo Homemade · Coca Cola Lattina$/
    )
  })

  it('e un drink con un solo ingrediente vero non elenca niente', async () => {
    // La lista si mostra da due ingredienti in su: contano quelli che si
    // vedono, non le righe della ricetta.
    ruoloClaim = null
    mockSettings = { show_ingredient_quantities: true }
    mockDrinks = [
      {
        id: 'd5',
        name: 'Shot di Rum',
        price: 4,
        category_id: 'c1',
        available: true,
        recipe_items: [
          { inventory_item_id: 'rum', name: 'Rum', unit: 'ml', qty: 40 },
          { inventory_item_id: 'tempo', name: 'Tempo di Lavorazione', unit: 'U', qty: 1 },
        ],
      },
    ]
    mostra()
    await screen.findByText('Shot di Rum')
    expect(document.querySelector('.ingredients')).toBeNull()
  })

  it('a «solo menù» il cliente guarda e basta: niente tasti per aggiungere', async () => {
    ruoloClaim = null
    mockSettings = { menu_only: true }
    mostra()
    await screen.findByText('Mojito')
    expect(screen.queryByRole('button', { name: /Aggiungi/ })).toBeNull()
    expect(screen.getByText(/Rivolgersi allo staff per ordinare/)).toBeInTheDocument()
  })

  // REQ-LIC-002: un locale senza il modulo «ordini dal telefono» ha il menù
  // che si legge e basta, anche se non ha mai toccato «solo menù».
  it('senza il modulo degli ordini dal telefono il menù si legge e basta', async () => {
    ruoloClaim = null
    mockSettings = { menu_only: false, licenza: { moduli: { menu_tavoli: true, ordini_cliente: false } } }
    mostra()
    await screen.findByText('Mojito')
    expect(screen.queryByRole('button', { name: /Aggiungi/ })).toBeNull()
    // BUG-135: non è una sospensione, in quel locale dal telefono non si
    // ordina proprio.
    expect(screen.getByText(/per ordinare rivolgersi allo staff/)).toBeInTheDocument()
    expect(screen.queryByText(/momentaneamente sospese/)).toBeNull()
  })

  // BUG-135: il modulo è del cliente. Lo staff dal menù ordina sempre, e
  // senza il modulo perdeva il prodotto libero e la riga di chi inserisce.
  it('senza il modulo degli ordini dal telefono lo staff ordina come sempre', async () => {
    ruoloClaim = 'bartender'
    mockSettings = { menu_only: false, licenza: { moduli: { menu_tavoli: true, ordini_cliente: false } } }
    mostra()
    await screen.findByText(/Inserimento ordine da/)
    expect(screen.getAllByRole('button', { name: /Aggiungi/ }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Prodotto libero/ })).toBeInTheDocument()
    expect(screen.queryByText(/Rivolgersi allo staff/i)).toBeNull()
  })
})

// ── LA COMANDA DI CHI PRENDE L'ORDINE AL TAVOLO ──────────────────────
// Prima non usciva niente: si sperava che al banco qualcuno tenesse aperta
// la coda con la stampa automatica accesa. Se quella schermata non era
// aperta, l'ordine restava solo a schermo e al banco non lo sapeva nessuno.
describe('la comanda dell’ordine preso in sala', () => {
  // Il giro vero: prodotto nel carrello, riepilogo, nome del cliente
  // (senza non si conferma) e conferma.
  async function ordina(user) {
    await user.click(screen.getAllByRole('button', { name: /Aggiungi/ })[0])
    await user.click(screen.getByRole('button', { name: /Rivedi ordine/ }))
    await user.type(await screen.findByPlaceholderText('es. Mario'), 'Anna')
    await user.click(screen.getByRole('button', { name: /Conferma ordine/ }))
  }

  it('la stampa il telefono che ha preso l’ordine', async () => {
    const user = userEvent.setup()
    mostra()
    await screen.findByText(/Inserimento ordine da/)
    await ordina(user)
    expect(stampata).toHaveBeenCalledTimes(1)
    expect(stampata.mock.calls[0][0].id).toBe('o1')
  })

  it('col rimbalzo il telefono non stampa: esce al banco', async () => {
    stampaSala = 'rimbalzo'
    const user = userEvent.setup()
    mostra()
    await screen.findByText(/Inserimento ordine da/)
    await ordina(user)
    expect(stampata).not.toHaveBeenCalled()
  })

  it('l’ordine del cliente non stampa dal telefono del cliente', async () => {
    ruoloClaim = null
    const user = userEvent.setup()
    mostra()
    await screen.findByText('Mojito')
    await ordina(user)
    expect(stampata).not.toHaveBeenCalled()
  })
})

// NEL MENÙ GLI ORDINI NON CI STANNO, PER NESSUNO. Per chi lavora la coda è
// un'altra pagina, e vedersi in mezzo i propri ordini attivi mescolava due
// mestieri. Al cliente fino alla 1.10.35 restavano, in cima alle voci;
// l'utente, 11/11/2026: «gli ordini non dovrebbero apparire nel menù.
// Dovrebbero stare in una sezione a parte della vista cliente, tipo i tuoi
// ordini». Ora li ritrova in «I miei ordini» (mieiOrdini.test.jsx), dal
// tasto in cima alla pagina.
describe('nel menù gli ordini non ci stanno', () => {
  it('il cliente non trova il suo ordine fra le voci', async () => {
    localStorage.setItem('drink_my_orders_v1', JSON.stringify(['o-mio']))
    ruoloClaim = null
    mostra()
    expect(await screen.findByText('Mojito')).toBeInTheDocument()
    expect(screen.queryByText(/Ordine #7/)).toBeNull()
  })

  it('chi lavora nemmeno: gli ordini stanno in coda', async () => {
    localStorage.setItem('drink_my_orders_v1', JSON.stringify(['o-mio']))
    ruoloClaim = 'bartender'
    mostra()
    await waitFor(() => expect(screen.queryByText(/Ordine #7/)).toBeNull())
  })
})

// GLI SPECIAL DELLA CASA (REQ-MENU-018). L'utente, 29/10/2026: il QR ai
// tavoli apre il menù normale «dove in alto a tutto ci deve essere un
// carousel degli special drink che se cliccato ti porta al menu dei drink
// speciali»; il QR del menù a tavola apre la pagina con «solo gli special».
describe('gli special della casa', () => {
  const SPECIAL = {
    id: 's1',
    name: 'Tè dei matti',
    price: 9,
    category_id: 'c1',
    available: true,
    speciale: true,
    illustrazione: 'tazza-te',
    recipe_items: [],
  }
  const mostraSpeciali = (percorso = '/menu/special') =>
    render(
      <MemoryRouter initialEntries={[percorso]}>
        <MenuPage speciali />
      </MemoryRouter>
    )

  it('il cliente trova il carosello in cima, e un tocco porta agli Special sullo stesso tavolo', async () => {
    ruoloClaim = null
    mockSettings = { special_titolo: 'Special', special_sottotitolo: 'Alice nel Paese delle Meraviglie' }
    mockDrinks = [...DRINKS, SPECIAL]
    mostra('/menu?tavolo=5')
    const carosello = await screen.findByRole('region', { name: 'Special' })
    const tessera = within(carosello).getByRole('link', { name: /Tè dei matti/ })
    expect(tessera).toHaveAttribute('href', '/menu/special?tavolo=5#speciale-s1')
    expect(tessera.querySelector('img')).toHaveAttribute('src', '/illustrazioni/alice/tazza-te.svg')
    expect(within(carosello).getByRole('link', { name: /Vedi tutti/ })).toHaveAttribute('href', '/menu/special?tavolo=5')
    expect(within(carosello).getByText('Alice nel Paese delle Meraviglie')).toBeInTheDocument()
    // Il drink resta anche nella sua categoria.
    expect(screen.getAllByText('Tè dei matti').length).toBeGreaterThan(1)
  })

  // GLI INGREDIENTI (REQ-MENU-019). L'utente, 29/10/2026: «negli special
  // devono uscire anche gli ingredienti del drink, e anche nel menu».
  it('gli ingredienti scritti nella scheda si leggono nel carosello, nel menù e nel menù Special', async () => {
    ruoloClaim = null
    mockSettings = { special_titolo: 'Special' }
    const conIngredienti = { ...SPECIAL, ingredienti: 'Tè nero, gin, miele' }
    mockDrinks = [...DRINKS, conIngredienti]
    const { unmount } = mostra('/menu')
    const carosello = await screen.findByRole('region', { name: 'Special' })
    expect(within(carosello).getByText('Tè nero · gin · miele')).toBeInTheDocument()
    // E nella sua categoria, nel menù normale.
    const nelMenu = [...document.querySelectorAll('.menu-item .ingredients')].map((p) => p.textContent)
    expect(nelMenu).toContain('Tè nero · gin · miele')
    unmount()

    mostraSpeciali()
    await screen.findByText('Tè dei matti')
    expect(document.getElementById('speciale-s1').querySelector('.ingredients')).toHaveTextContent('Tè nero · gin · miele')
  })

  it('senza special il carosello non c’è', async () => {
    ruoloClaim = null
    mostra('/menu')
    await screen.findByText('Mojito')
    expect(screen.queryByRole('region', { name: /Special/ })).toBeNull()
  })

  it('chi lavora non vede il carosello', async () => {
    mockDrinks = [...DRINKS, SPECIAL]
    mostra('/menu')
    await screen.findByText('Mojito')
    expect(screen.queryByRole('region', { name: /Special/ })).toBeNull()
  })

  // L'utente, 06/11/2026: il menù Special «come per gli altri menù è
  // attivabile o meno»; spento, gli special sono una sezione del menù come
  // le altre.
  it('col menù Special spento il carosello non c’è, e il drink resta nella sua sezione', async () => {
    ruoloClaim = null
    mockSettings = { special_titolo: 'Special', special_attivo: false }
    mockDrinks = [...DRINKS, SPECIAL]
    mostra('/menu')
    await screen.findByText('Mojito')
    expect(screen.queryByRole('region', { name: 'Special' })).toBeNull()
    expect(screen.getAllByText('Tè dei matti')).toHaveLength(1)
  })

  // In «Carte» (REQ-MENU-029) gli Special sono il carosello di sempre, in
  // cima, coi disegni: nel mazzo il Jolly ripeteva la sezione Signature.
  it('nello stile «Carte» il carosello c’è, e nel mazzo il Jolly no', async () => {
    ruoloClaim = null
    mockSettings = { stile_menu: 'carte', special_titolo: 'Special' }
    mockDrinks = [...DRINKS, SPECIAL]
    mostra('/menu')
    const carosello = await screen.findByRole('region', { name: 'Special' })
    expect(within(carosello).getByRole('link', { name: /Tè dei matti/ })).toBeInTheDocument()
    const mazzo = screen.getByRole('navigation', { name: 'Le carte del menù' })
    expect(within(mazzo).queryByText('JOLLY')).toBeNull()
    expect(within(mazzo).getAllByRole('button').length).toBeGreaterThan(0)
  })

  // Sulle carte bianche il disegno va col tratto scuro: quello per il fondo
  // scuro della pagina, sul bianco, «si vede male, anzi poco».
  it('sulla pagina Special in «Carte» i disegni sono quelli per il fondo chiaro', async () => {
    ruoloClaim = null
    mockSettings = { stile_menu: 'carte', special_titolo: 'Special' }
    mockDrinks = [...DRINKS, SPECIAL]
    mostraSpeciali('/menu/special')
    await screen.findAllByText('Tè dei matti')
    expect(document.querySelector('.k-voce-img')).toHaveAttribute('src', '/illustrazioni/alice/tazza-te-chiaro.svg')
  })

  it('il menù Special mostra solo gli special, col titolo, e torna al menù sullo stesso tavolo', async () => {
    ruoloClaim = null
    mockSettings = { special_titolo: 'Special', special_sottotitolo: 'Alice nel Paese delle Meraviglie' }
    mockDrinks = [...DRINKS, SPECIAL]
    mostraSpeciali('/menu/special?tavolo=5')
    expect(await screen.findByRole('heading', { level: 2, name: 'Special' })).toBeInTheDocument()
    expect(screen.getByText('Tè dei matti')).toBeInTheDocument()
    expect(screen.queryByText('Mojito')).toBeNull()
    expect(screen.getByRole('link', { name: /Tutto il menù/ })).toHaveAttribute('href', '/menu?tavolo=5')
    const card = document.getElementById('speciale-s1')
    expect(card.querySelector('.speciale-img')).toHaveAttribute('src', '/illustrazioni/alice/tazza-te.svg')
    // In griglia, non una per riga (l'utente, 29/10/2026: «su due colonne»).
    expect(card.parentElement).toHaveClass('speciali-griglia')
  })
})

// IL DETTAGLIO DEL DRINK (REQ-MENU-020). L'utente, 30/10/2026: «su qualsiasi
// item di menu premo non si apre un dettaglio o almeno una modal con il
// dettaglio del drink con immagine, descrizione lunga e ingredienti».
describe('il dettaglio del drink', () => {
  const LUNGA =
    'Il basilico fresco rincorre il Bianconiglio: un drink verde, aromatico e dissetante, da bere prima che sia troppo tardi.'
  const BASILICO = {
    id: 's9',
    name: 'Basiliconiglio',
    price: 9,
    category_id: 'c1',
    available: true,
    speciale: true,
    description: LUNGA,
    ingredienti: 'Gin, basilico fresco, lime',
    illustrazione: { bicchiere: 'basso', colore: 'verde', decorazione: 'menta' },
  }

  it('toccando la card si apre, con descrizione intera e ingredienti, e si ordina da lì', async () => {
    const user = userEvent.setup()
    ruoloClaim = null
    mockDrinks = [...DRINKS, BASILICO]
    mostra('/menu')
    await screen.findByText('Mojito')
    const card = [...document.querySelectorAll('.menu-item')].find((c) => c.textContent.includes('Basiliconiglio'))
    await user.click(card.querySelector('.ingredients'))
    const dialogo = await screen.findByRole('dialog', { name: 'Basiliconiglio' })
    expect(within(dialogo).getByText(LUNGA)).toBeInTheDocument()
    expect(within(dialogo).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Gin', 'basilico fresco', 'lime'])
    await user.click(within(dialogo).getByRole('button', { name: 'Aggiungi' }))
    // Aggiunto: nel dettaglio compaiono le quantità, come nella card.
    expect(within(dialogo).getByRole('button', { name: 'Aumenta' })).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Chiudi' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('il nome è un tasto: si apre anche dalla tastiera', async () => {
    const user = userEvent.setup()
    ruoloClaim = null
    mostra('/menu')
    await user.click(await screen.findByRole('button', { name: 'Negroni' }))
    expect(screen.getByRole('dialog', { name: 'Negroni' })).toBeInTheDocument()
  })

  it('«Aggiungi» nella card aggiunge e basta, senza aprire il dettaglio', async () => {
    const user = userEvent.setup()
    ruoloClaim = null
    mostra('/menu')
    await screen.findByText('Mojito')
    await user.click(screen.getAllByRole('button', { name: /Aggiungi/ })[0])
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText(/Rivedi ordine/)).toBeInTheDocument()
  })

  it('a «solo menù» il dettaglio si guarda e basta', async () => {
    const user = userEvent.setup()
    ruoloClaim = null
    mockSettings = { menu_only: true }
    mostra('/menu')
    await user.click(await screen.findByRole('button', { name: 'Mojito' }))
    const dialogo = screen.getByRole('dialog', { name: 'Mojito' })
    expect(within(dialogo).queryByRole('button', { name: 'Aggiungi' })).toBeNull()
  })

  it('dal carosello, il menù Special si apre col dettaglio di quel drink', async () => {
    ruoloClaim = null
    mockDrinks = [...DRINKS, BASILICO]
    render(
      <MemoryRouter initialEntries={['/menu/special#speciale-s9']}>
        <MenuPage speciali />
      </MemoryRouter>
    )
    expect(await screen.findByRole('dialog', { name: 'Basiliconiglio' })).toBeInTheDocument()
  })
})


// IL BENVENUTO DELLA TANA È QUELLO DI SEMPRE (REQ-VENUE-002). Diventando un
// dato, il nome del locale nel benvenuto rischiava di diventare «Benvenuto
// da La Tana del Coniglio»: la frase col locale dentro la scrive il locale
// (venue_presso), e la build della Tana porta la sua.
describe('il benvenuto al primo accesso', () => {
  it('dice il locale con la sua preposizione', async () => {
    ruoloClaim = null
    localStorage.removeItem('drink_welcome_v1')
    mostra('/menu')
    expect(await screen.findByText('Benvenuto alla Tana del Coniglio')).toBeInTheDocument()
  })

  // Il ripiego «da <nome>» per chi non l'ha scritta è in venue.test.js.
  it('un locale che l’ha scritta nelle impostazioni dice la sua', async () => {
    ruoloClaim = null
    mockSettings = { venue_name: 'Bar Mario', venue_presso: 'al Bar Mario' }
    localStorage.removeItem('drink_welcome_v1')
    mostra('/menu')
    expect(await screen.findByText('Benvenuto al Bar Mario')).toBeInTheDocument()
  })
})

// LA FIRMA DEL PRODOTTO IN FONDO AL MENÙ DIGITALE (REQ-LIC-003,
// `limiti.marchio`): solo dove la licenza la chiede.
describe('la firma del prodotto', () => {
  it('col marchio nella licenza esce in fondo al menù', async () => {
    ruoloClaim = null
    mockSettings = { licenza: { piano: 'free', moduli: { menu_tavoli: true }, limiti: { marchio: true } } }
    mostra('/menu')
    await screen.findByText('Mojito')
    expect(screen.getByText('Creato con Lime - SmartOrders')).toBeInTheDocument()
  })

  it('senza limiti nella licenza non c’è', async () => {
    ruoloClaim = null
    mostra('/menu')
    await screen.findByText('Mojito')
    expect(screen.queryByText(/Creato con/)).toBeNull()
  })
})

// LO STILE «NOTTE» (REQ-MENU-021): la forma che il locale sceglie per i
// clienti. Chi lavora vede sempre il classico.
describe('lo stile «Notte»', () => {
  const SPECIALE = {
    id: 'n1',
    name: 'Basiliconiglio',
    price: 9,
    category_id: 'c1',
    available: true,
    speciale: true,
    description: 'Il basilico fresco rincorre il Bianconiglio.',
    illustrazione: { bicchiere: 'basso', colore: 'verde', decorazione: 'menta' },
  }

  it('il cliente vede il menù nello stile scelto; il personale no', async () => {
    ruoloClaim = null
    mockSettings = { stile_menu: 'notte' }
    const { container, unmount } = mostra('/menu')
    await screen.findByText('Mojito')
    expect(container.querySelector('.stile-notte')).not.toBeNull()
    unmount()

    ruoloClaim = 'bartender'
    const staff = mostra('/menu')
    await screen.findByText(/Inserimento ordine da/)
    expect(staff.container.querySelector('.stile-notte')).toBeNull()
  })

  it('senza scelta resta il classico', async () => {
    ruoloClaim = null
    const { container } = mostra('/menu')
    await screen.findByText('Mojito')
    expect(container.querySelector('.stile-notte')).toBeNull()
  })

  it('il menù Special scorre a scene, e dal carosello ci si porta sulla scena senza aprire il dettaglio', async () => {
    ruoloClaim = null
    mockSettings = { stile_menu: 'notte', special_titolo: 'Special' }
    mockDrinks = [...DRINKS, SPECIALE]
    const { container } = render(
      <MemoryRouter initialEntries={['/menu/special#speciale-n1']}>
        <MenuPage speciali />
      </MemoryRouter>
    )
    const scena = await waitFor(() => {
      const s = container.querySelector('.notte-scena')
      expect(s).not.toBeNull()
      return s
    })
    expect(scena).toHaveAttribute('id', 'speciale-n1')
    expect(container.querySelector('.speciali-griglia')).toBeNull()
    // Niente foto d'intestazione: l'apertura degli Special la sostituisce.
    expect(container.querySelector('.hero')).toBeNull()
    expect(within(scena).getByRole('button', { name: 'Aggiungi' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})


// IL DISEGNO DEL DRINK È PIÙ GRANDE DELLA FOTO (l'utente, 02/11/2026: «le
// immagini stilizzate dei drink dovrebbero essere più grandi»). Nella
// casella da 64 px della foto il disegno al tratto, ritagliato, si leggeva
// appena: ha una classe sua, che lo fa più grande e intero. La foto vera
// resta com'era.
describe('il disegno del drink nell’elenco', () => {
  it('il disegno ha la casella grande, la foto quella di sempre', async () => {
    mockDrinks = [
      { ...DRINKS[0], illustrazione: { bicchiere: 'basso', colore: 'verde', decorazione: 'menta' } },
      { ...DRINKS[1], image_url: 'https://foto.example/negroni.jpg' },
    ]
    mostra()
    expect(await screen.findByAltText('Mojito')).toHaveClass('drink-thumb', 'disegno')
    expect(screen.getByAltText('Negroni')).toHaveClass('drink-thumb')
    expect(screen.getByAltText('Negroni')).not.toHaveClass('disegno')
  })
})

// GLI STILI GRATIS SUL MENÙ (REQ-MENU-022): installato e scelto, il cliente
// lo vede; chi lavora lo prova sul proprio menù con `?stile=…`, solo per
// sé; un esclusivo che il locale non ha non si prova.
describe('gli stili gratis sul menù', () => {
  it('installato e scelto, il cliente lo vede', async () => {
    ruoloClaim = null
    mockSettings = { stili_installati: ['giornale'], stile_menu: 'giornale' }
    const { container } = mostra('/menu')
    await screen.findByText('Mojito')
    expect(container.querySelector('.stile-giornale')).not.toBeNull()
  })

  it('scelto ma non installato, no: resta il classico', async () => {
    ruoloClaim = null
    mockSettings = { stile_menu: 'giornale' }
    const { container } = mostra('/menu')
    await screen.findByText('Mojito')
    expect(container.querySelector('.stile-giornale')).toBeNull()
  })

  it('chi lavora prova uno stile sul proprio menù, e la riga in alto lo dice', async () => {
    ruoloClaim = 'bartender'
    const { container } = mostra('/menu?vista=cliente&stile=deco')
    await screen.findByText('Mojito')
    expect(container.querySelector('.stile-deco')).not.toBeNull()
    expect(screen.getByText(/Stai provando lo stile «Déco»/)).toBeInTheDocument()
  })

  it('un esclusivo che il locale non ha non si prova', async () => {
    ruoloClaim = 'bartender'
    mockSettings = { licenza: { moduli: {} } }
    const { container } = mostra('/menu?vista=cliente&stile=notte')
    await screen.findByText('Mojito')
    expect(container.querySelector('.stile-notte')).toBeNull()
  })
})

// LA VISTA CLIENTE SI GUARDA E BASTA (BUG-127). L'utente, 02/11/2026: «la
// vista cliente deve solo mostrare il menù come lo vede il cliente». Con
// «Aggiungi» e carrello, chi lavora mandava un ordine anonimo come un
// cliente qualunque; per ordinare c'è il menù dello staff.
describe('la vista cliente', () => {
  it('mostra il menù del cliente, senza «Aggiungi» né carrello', async () => {
    ruoloClaim = 'admin'
    mostra('/menu?vista=cliente')
    await screen.findByText('Mojito')
    expect(await screen.findByText(/Stai guardando il menù come lo vede il cliente\.$/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aggiungi' })).toBeNull()
  })

  it('il menù dello staff, invece, ordina', async () => {
    ruoloClaim = 'admin'
    mostra('/menu')
    await screen.findByText('Mojito')
    expect((await screen.findAllByRole('button', { name: 'Aggiungi' })).length).toBeGreaterThan(0)
  })
})

// IL TEMA IN PROVA (REQ-MENU-023): dal marketplace, chi lavora apre il
// proprio menù con lo stile di un tema (i colori li mette App), e la riga
// in alto dice quale.
describe('un tema del marketplace in prova sul menù', () => {
  it('porta il suo stile, e la riga in alto lo dice', async () => {
    ruoloClaim = 'bartender'
    const { container } = mostra('/menu?vista=cliente&tema=gazzetta')
    await screen.findByText('Mojito')
    expect(container.querySelector('.stile-giornale')).not.toBeNull()
    expect(screen.getByText(/Stai provando il tema «Gazzetta»/)).toBeInTheDocument()
  })
})

// LO STILE «GIORNALE» (REQ-MENU-024): una struttura sua, non le card del
// classico. Testata, sommario, prima pagina col primo Special, «In breve»,
// le sezioni; immagini a incisione; i gesti di sempre.
describe('lo stile «Giornale»', () => {
  const SPECIALI = [
    { id: 's1', name: 'Bianconiglio', price: 9, category_id: 'c1', available: true, speciale: true, description: 'Il primo', illustrazione: { bicchiere: 'coppa', colore: 'ambra', decorazione: 'agrume' } },
    { id: 's2', name: 'Cappellaio', price: 10, category_id: 'c1', available: true, speciale: true, description: 'Il secondo' },
  ]
  const mostraGiornale = () => {
    ruoloClaim = null
    mockDrinks = [...DRINKS, ...SPECIALI]
    mockSettings = { stili_installati: ['giornale'], stile_menu: 'giornale' }
    return mostra('/menu')
  }

  it('è una prima pagina: testata, sommario, apertura, in breve, sezioni; niente card', async () => {
    const { container } = mostraGiornale()
    await screen.findByRole('navigation', { name: 'Sommario' })
    expect(container.querySelector('.g-testata')).not.toBeNull()
    expect(screen.getByText('Edizione della sera')).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Sommario' })).getByRole('link', { name: 'Birre' })).toBeInTheDocument()
    const prima = screen.getByRole('region', { name: 'Prima pagina' })
    expect(within(prima).getByText('In prima pagina')).toBeInTheDocument()
    expect(within(prima).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Bianconiglio', 'Cappellaio'])
    expect(container.querySelector('.g-sezione')).not.toBeNull()
    expect(container.querySelector('.menu-item')).toBeNull()
    expect(container.querySelector('.hero')).toBeNull()
  })

  it('le immagini sono incisioni, non i disegni della Tana', async () => {
    const { container } = mostraGiornale()
    await screen.findByRole('navigation', { name: 'Sommario' })
    const img = container.querySelector('.g-apertura img')
    const svg = decodeURIComponent(img.getAttribute('src'))
    expect(svg).toContain('<rect x="14" y="14" width="372" height="372"')
    expect(svg).not.toContain('feTurbulence')
  })

  it('il sommario porta alla sezione e la segna', async () => {
    const utente = userEvent.setup()
    mostraGiornale()
    const sommario = await screen.findByRole('navigation', { name: 'Sommario' })
    const birre = within(sommario).getByRole('link', { name: 'Birre' })
    await utente.click(birre)
    expect(birre).toHaveAttribute('aria-current', 'true')
    expect(document.getElementById(birre.getAttribute('href').slice(1))).not.toBeNull()
  })

  it('i gesti di sempre: «Aggiungi», e il nome apre il dettaglio', async () => {
    const utente = userEvent.setup()
    mostraGiornale()
    await screen.findByRole('navigation', { name: 'Sommario' })
    const voce = screen.getByRole('button', { name: 'Mojito' }).closest('article')
    await utente.click(within(voce).getByRole('button', { name: 'Aggiungi' }))
    expect(within(voce).getByRole('button', { name: 'Aumenta' })).toBeInTheDocument()
    await utente.click(screen.getByRole('button', { name: 'Mojito' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  // Trovato nel giro di revisione della 1.10.8: nel menù Special il giornale
  // toglieva la testata classica, e con lei il tema della sera e la strada
  // per il menù completo. Chi arrivava dal QR degli Special restava chiuso lì.
  it('nel menù Special la testata porta il tema della sera e «← Tutto il menù»', async () => {
    ruoloClaim = null
    mockDrinks = [...DRINKS, ...SPECIALI]
    mockSettings = {
      stili_installati: ['giornale'],
      stile_menu: 'giornale',
      special_titolo: 'Special',
      special_sottotitolo: 'Alice nel paese delle meraviglie',
    }
    const { container } = render(
      <MemoryRouter initialEntries={['/menu/special']}>
        <MenuPage speciali />
      </MemoryRouter>
    )
    const testata = await waitFor(() => {
      const t = container.querySelector('.g-testata')
      expect(t).not.toBeNull()
      return t
    })
    expect(within(testata).getByText('Alice nel paese delle meraviglie')).toBeInTheDocument()
    expect(within(testata).getByRole('link', { name: '← Tutto il menù' })).toHaveAttribute('href', '/menu')
    expect(screen.queryByRole('navigation', { name: 'Sommario' })).toBeNull()
  })
})

// I DISEGNI DEI DRINK SONO DEL LOCALE CHE HA «NOTTE» (REQ-LIC-013). L'utente,
// 04/11/2026: «sono solo per lo stile Notte che abbiamo fatto in esclusiva
// per la Tana», ma «può riutilizzarli Flavio se cambia stile». Agli altri
// locali, al posto del disegno, «un bicchiere neutro»; le foto invece le
// carica chiunque e si vedono in ogni stile.
describe('i disegni dei drink sono della Tana', () => {
  const DISEGNATO = { ...DRINKS[0], illustrazione: { bicchiere: 'basso', colore: 'verde', decorazione: 'menta' } }
  const FOTOGRAFATO = { ...DRINKS[1], image_url: 'https://foto.example/negroni.jpg' }
  const ALTRO_LOCALE = { licenza: { ...LICENZA_TANA, temi: [] } }

  it('un altro locale vede il bicchiere neutro al posto del disegno, e la foto', async () => {
    ruoloClaim = null
    mockSettings = ALTRO_LOCALE
    mockDrinks = [DISEGNATO, FOTOGRAFATO, DRINKS[2]]
    mostra()
    const mojito = await screen.findByAltText('Mojito')
    expect(mojito).toHaveClass('drink-thumb', 'placeholder')
    expect(mojito).toHaveAttribute('src', segnapostoDrink())
    expect(screen.getByAltText('Negroni')).toHaveAttribute('src', 'https://foto.example/negroni.jpg')
  })

  it('la Tana li vede anche cambiando stile', async () => {
    ruoloClaim = null
    mockSettings = { stili_installati: ['lavagna'], stile_menu: 'lavagna' }
    mockDrinks = [DISEGNATO, FOTOGRAFATO]
    mostra()
    expect(await screen.findByAltText('Mojito')).toHaveClass('drink-thumb', 'disegno')
  })

  it('senza foto né disegno, il bicchiere neutro anche in Notte: niente più logo', async () => {
    ruoloClaim = null
    mockSettings = { stile_menu: 'notte' }
    mostra()
    const ichnusa = await screen.findByAltText('Ichnusa')
    expect(ichnusa).toHaveAttribute('src', segnapostoDrink())
    expect(ichnusa.getAttribute('src')).not.toMatch(/logo\.png/)
  })
})

// GLI SPECIAL SENZA SPECIAL NON SI RAGGIUNGONO (REQ-MENU-018). L'utente,
// 04/11/2026: senza drink speciali la sezione si nasconde e il menù Special
// «deve risultare vuoto e non raggiungibile al pubblico». Il QR stampato
// resta sui tavoli: chi lo inquadra va al menù, con lo stesso tavolo.
describe('il menù Special senza special', () => {
  function Dove() {
    const l = useLocation()
    return <p>SIAMO SU {l.pathname + l.search}</p>
  }
  const apri = (percorso) =>
    render(
      <MemoryRouter initialEntries={[percorso]}>
        <Routes>
          <Route path="/menu/special" element={<MenuPage speciali />} />
          <Route path="/menu" element={<Dove />} />
        </Routes>
      </MemoryRouter>
    )

  it('il cliente va al menù, sullo stesso tavolo', async () => {
    ruoloClaim = null
    apri('/menu/special?tavolo=5')
    expect(await screen.findByText('SIAMO SU /menu?tavolo=5')).toBeInTheDocument()
  })

  // Lo stesso col menù Special spento: il QR stampato porta al menù.
  it('col menù Special spento il cliente va al menù, anche se gli special ci sono', async () => {
    ruoloClaim = null
    mockSettings = { special_attivo: false }
    mockDrinks = [...DRINKS, { id: 's1', name: 'Tè dei matti', price: 9, category_id: 'c1', available: true, speciale: true }]
    apri('/menu/special?tavolo=5')
    expect(await screen.findByText('SIAMO SU /menu?tavolo=5')).toBeInTheDocument()
  })

  it('chi lavora resta, e legge perché è vuoto', async () => {
    ruoloClaim = 'admin'
    apri('/menu/special?vista=cliente')
    expect(await screen.findByText(/Nessun drink speciale/)).toBeInTheDocument()
    expect(screen.queryByText(/SIAMO SU/)).toBeNull()
  })

  it('il carosello in cima al menù non c’è', async () => {
    ruoloClaim = null
    mostra('/menu?tavolo=5')
    await screen.findByText('Mojito')
    expect(screen.queryByRole('region', { name: 'Special' })).toBeNull()
  })
})

// LA STRUTTURA DEL MENÙ DEI CLIENTI (REQ-MENU-025). Flavio, 04/11/2026,
// guardando il menù dei clienti sul test: gin e vodka insieme, «Distillati»
// tutti uniti, shot e food al tavolo. L'utente, 05/11/2026: si parte dalle
// voci della cassa e poi tutto è libero, ogni voce collegata a un prodotto
// della cassa. Chi lavora ordina sempre dal menù del gestionale.
describe('la struttura del menù dei clienti (REQ-MENU-025)', () => {
  const STRUTTURA = {
    sezioni: [
      { id: 's-cocktail', nome: 'Cocktail IBA', ordine: 0, vista: 'dettagliata' },
      { id: 's-birre', nome: 'Birre alla spina', ordine: 1, vista: 'snella' },
      { id: 's-banco', nome: 'Dal banco', ordine: 2, vista: 'dettagliata', nascosta: true },
    ],
    voci: [
      { id: 'v-mojito', sezione_id: 's-cocktail', drink_id: 'd1', nome: 'Mojito cubano', descrizione: 'Dall’Avana.', ingredienti: 'Rum, lime, menta', ordine: 0 },
      { id: 'v-cuba', sezione_id: 's-cocktail', drink_id: 'd1', nome: 'Cuba libre', ordine: 1 },
      { id: 'v-ichnusa', sezione_id: 's-birre', drink_id: 'd3', ordine: 0 },
      // Il Negroni sta solo in una sezione nascosta.
      { id: 'v-negroni', sezione_id: 's-banco', drink_id: 'd2', ordine: 0 },
    ],
  }
  const sezioniLette = () => [...document.querySelectorAll('.cat-header')].map((e) => e.textContent)

  it('il cliente legge le sezioni della struttura, i loro nomi e solo quello che mostrano', async () => {
    ruoloClaim = null
    mockCarta = STRUTTURA
    mostra('/menu?tavolo=5')
    await screen.findByText('Mojito cubano')
    expect(sezioniLette()).toEqual(['Cocktail IBA', 'Birre alla spina'])
    expect(voci()).toEqual(['Mojito cubano', 'Cuba libre', 'Ichnusa'])
    expect(screen.queryByText('Negroni')).toBeNull()
    expect(screen.getByText('Dall’Avana.')).toBeInTheDocument()
    expect(screen.getByText('Rum · lime · menta')).toBeInTheDocument()
    // Le schede delle sezioni sono quelle grandi.
    expect(document.querySelector('.cat-nav')).toHaveClass('carta')
  })

  it('la sezione snella: nome e prezzo, senza immagine né descrizione', async () => {
    ruoloClaim = null
    mockDrinks = DRINKS.map((d) => (d.id === 'd3' ? { ...d, description: 'Non si vede' } : d))
    mockCarta = STRUTTURA
    mostra()
    await screen.findByText('Mojito cubano')
    const birre = document.querySelector('section.carta-snella')
    expect(birre).not.toBeNull()
    expect(within(birre).getByText('Ichnusa')).toBeInTheDocument()
    expect(birre.querySelector('img')).toBeNull()
    expect(screen.queryByText('Non si vede')).toBeNull()
  })

  it('senza struttura personalizzata il cliente vede le categorie, come sempre', async () => {
    ruoloClaim = null
    mostra()
    await screen.findByText('Negroni')
    expect(sezioniLette()).toEqual(['Cocktail', 'Birre'])
    expect(voci()).toEqual(['Mojito', 'Negroni', 'Ichnusa'])
    expect(document.querySelector('.cat-nav')).not.toHaveClass('carta')
  })

  it('il nome per il cliente della scheda vale anche senza struttura', async () => {
    ruoloClaim = null
    mockDrinks = DRINKS.map((d) => (d.id === 'd2' ? { ...d, nome_cliente: 'Negroni sbagliato' } : d))
    mostra()
    await screen.findByText('Negroni sbagliato')
    expect(voci()).toEqual(['Mojito', 'Negroni sbagliato', 'Ichnusa'])
  })

  it('chi lavora ordina dal menù del gestionale, coi nomi del banco e per categorie', async () => {
    mockDrinks = DRINKS.map((d) => (d.id === 'd2' ? { ...d, nome_cliente: 'Negroni sbagliato' } : d))
    mockCarta = STRUTTURA
    mostra()
    await screen.findByText(/Inserimento ordine da/)
    expect(voci()).toEqual(['Mojito', 'Negroni', 'Ichnusa'])
  })

  it('in vista cliente il personale vede la struttura come il cliente', async () => {
    mockCarta = STRUTTURA
    mostra('/menu?vista=cliente')
    await screen.findByText('Mojito cubano')
    expect(voci()).toEqual(['Mojito cubano', 'Cuba libre', 'Ichnusa'])
  })

  // Due voci sullo stesso prodotto con due nomi sono due righe, e al banco
  // arriva il prodotto del gestionale col nome letto dal cliente nella
  // nota. Lo stesso prodotto con lo stesso nome, preso da due sezioni, è
  // una riga sola: al banco è la stessa cosa.
  it('nel carrello due voci sullo stesso drink restano due righe, col nome letto in nota', async () => {
    const user = userEvent.setup()
    ruoloClaim = null
    mockCarta = {
      ...STRUTTURA,
      sezioni: [...STRUTTURA.sezioni, { id: 's-ancora', nome: 'Ancora', ordine: 3, vista: 'dettagliata' }],
      voci: [...STRUTTURA.voci, { id: 'v-mojito-2', sezione_id: 's-ancora', drink_id: 'd1', nome: 'Mojito cubano', ordine: 0 }],
    }
    mostra('/menu?tavolo=5')
    await screen.findByText('Cuba libre')
    const [primo, secondo] = screen.getAllByText('Mojito cubano').map((n) => n.closest('.menu-item'))
    await user.click(within(primo).getByRole('button', { name: 'Aggiungi' }))
    await user.click(within(screen.getByText('Cuba libre').closest('.menu-item')).getByRole('button', { name: 'Aggiungi' }))
    // Dall'altra sezione la stessa riga sale di uno.
    await user.click(within(secondo).getByRole('button', { name: 'Aumenta' }))
    const carrello = JSON.parse(localStorage.getItem('drink_cart_v1'))
    expect(carrello).toEqual([
      expect.objectContaining({ drink_id: 'd1', name: 'Mojito', nome_carta: 'Mojito cubano', note: 'Mojito cubano', qty: 2 }),
      expect.objectContaining({ drink_id: 'd1', name: 'Mojito', nome_carta: 'Cuba libre', note: 'Cuba libre', qty: 1 }),
    ])
    // Il cliente legge i nomi che ha scelto.
    expect(document.querySelector('.cartbar').textContent).toContain('Cuba libre')
  })
})

// L'IMPAGINAZIONE DI UN TEMA SU MISURA (REQ-MENU-030). L'utente, 06/11/2026:
// «si possa scegliere tra varie strutture di menu (tutto in una pagina, una
// pagina per categoria o una per macro categoria)». Le schede in alto
// diventano tasti che cambiano pagina; le macro categorie sono i gruppi
// scritti sulle sezioni.
describe('l’impaginazione di un tema su misura (REQ-MENU-030)', () => {
  const STRUTTURA = {
    sezioni: [
      { id: 's-sig', nome: 'Signature', ordine: 0, vista: 'dettagliata', gruppo: 'Cocktail' },
      { id: 's-iba', nome: 'Cocktail IBA', ordine: 1, vista: 'dettagliata', gruppo: 'Cocktail' },
      { id: 's-birre', nome: 'Birre', ordine: 2, vista: 'snella' },
    ],
    voci: [
      { id: 'v-negroni', sezione_id: 's-sig', drink_id: 'd2', ordine: 0 },
      { id: 'v-mojito', sezione_id: 's-iba', drink_id: 'd1', ordine: 0 },
      { id: 'v-ichnusa', sezione_id: 's-birre', drink_id: 'd3', ordine: 0 },
    ],
  }
  const tema = (impaginazione) => ({
    id: 'su-misura-bosco',
    nome: 'Bosco',
    tavolozza: { base: 'tana-scuro' },
    stile: 'classico',
    su_misura: true,
    ricetta: { versione: 1, caratteri: { titolo: 'inter', voce: 'inter', testo: 'inter' }, impaginazione },
  })
  const inUso = (impaginazione) => ({ temi_installati: [tema(impaginazione)], tema_menu: 'su-misura-bosco', stile_menu: 'su-misura-bosco' })
  const sezioniLette = () => [...document.querySelectorAll('.cat-header')].map((e) => e.textContent)
  const schede = () => within(screen.getByRole('navigation', { name: 'Pagine del menù' })).getAllByRole('button')

  it('una pagina per sezione: le schede la cambiano', async () => {
    const user = userEvent.setup()
    ruoloClaim = null
    mockCarta = STRUTTURA
    mockSettings = inUso('per-categoria')
    mostra('/menu?tavolo=5')
    await screen.findByText('Negroni')
    expect(schede().map((b) => b.textContent)).toEqual(['Signature', 'Cocktail IBA', 'Birre'])
    expect(sezioniLette()).toEqual(['Signature'])
    expect(screen.queryByText('Mojito')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Birre' }))
    expect(sezioniLette()).toEqual(['Birre'])
    expect(screen.getByRole('button', { name: 'Birre' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Signature' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('una pagina per gruppo: le sezioni del gruppo insieme', async () => {
    const user = userEvent.setup()
    ruoloClaim = null
    mockCarta = STRUTTURA
    mockSettings = inUso('per-macro-categoria')
    mostra()
    await screen.findByText('Negroni')
    expect(schede().map((b) => b.textContent)).toEqual(['Cocktail', 'Birre'])
    expect(sezioniLette()).toEqual(['Signature', 'Cocktail IBA'])
    await user.click(screen.getByRole('button', { name: 'Birre' }))
    expect(voci()).toEqual(['Ichnusa'])
  })

  it('senza il tema, o con un altro stile scelto dopo, il menù resta in una pagina', async () => {
    ruoloClaim = null
    mockCarta = STRUTTURA
    mockSettings = { ...inUso('per-categoria'), stile_menu: 'deco', stili_installati: ['deco'] }
    mostra()
    await screen.findByText('Negroni')
    expect(sezioniLette()).toEqual(['Signature', 'Cocktail IBA', 'Birre'])
    expect(screen.queryByRole('navigation', { name: 'Pagine del menù' })).toBeNull()
  })

  it('chi lavora ordina dal menù intero', async () => {
    mockCarta = STRUTTURA
    mockSettings = inUso('per-categoria')
    mostra()
    await screen.findByText(/Inserimento ordine da/)
    expect(voci()).toEqual(['Mojito', 'Negroni', 'Ichnusa'])
    expect(screen.queryByRole('navigation', { name: 'Pagine del menù' })).toBeNull()
  })

  it('in prova dal marketplace, prima di installarlo', async () => {
    mockCarta = STRUTTURA
    mockSettings = { licenza: { ...LICENZA_TANA, temi_su_misura: [tema('per-categoria')] } }
    mostra('/menu?vista=cliente&tema=su-misura-bosco')
    await screen.findByText('Negroni')
    expect(screen.getByText(/Stai provando il tema «Bosco»/)).toBeInTheDocument()
    expect(sezioniLette()).toEqual(['Signature'])
  })
})

// IL MOTORE DEGLI STILI A RICETTA (REQ-MENU-031): lo stile del locale
// arriva come ricetta, e il contenitore del menù la porta scritta negli
// attributi e nelle variabili dei caratteri, che le regole del motore
// leggono.
describe('uno stile a ricetta sul menù', () => {
  const OSTERIA = {
    id: 'osteria',
    nome: 'Osteria',
    ricetta: {
      versione: 1,
      caratteri: { titolo: 'libre-baskerville', voce: 'libre-baskerville', testo: 'georgia' },
      titoli: { corsivo: true, allineamento: 'centro' },
      voce: { forma: 'riga', prezzo: 'puntini' },
      sfondo: 'carta',
    },
  }

  it('installato e scelto, il cliente lo vede disegnato dal motore', async () => {
    ruoloClaim = null
    mockSettings = { stili_ricetta: [OSTERIA], stile_menu: 'osteria' }
    const { container } = mostra()
    await screen.findByText('Mojito')
    const menu = container.querySelector('.stile-ricetta')
    expect(menu).not.toBeNull()
    expect(menu.dataset).toMatchObject({ titoliCorsivo: 'true', titoliAllineamento: 'centro', voceForma: 'riga', vocePrezzo: 'puntini', sfondo: 'carta' })
    expect(menu.style.getPropertyValue('--stile-titolo')).toMatch(/Libre Baskerville/)
  })

  it('non installato non si applica; chi lavora lo prova dal catalogo ricordato', async () => {
    ruoloClaim = null
    mockSettings = { stile_menu: 'osteria' }
    const { container, unmount } = mostra()
    await screen.findByText('Mojito')
    expect(container.querySelector('.stile-ricetta')).toBeNull()
    unmount()

    ruoloClaim = 'bartender'
    mockSettings = {}
    localStorage.setItem('drink:catalogo-stili', JSON.stringify([OSTERIA]))
    const prova = mostra('/menu?vista=cliente&stile=osteria')
    await screen.findByText('Mojito')
    expect(prova.container.querySelector('.stile-ricetta')).not.toBeNull()
    expect(screen.getByText(/Stai provando lo stile «Osteria»/)).toBeInTheDocument()
  })
})

// LE SEZIONI DI SOLI SPECIAL FUORI DAL MENÙ (REQ-MENU-037). L'utente,
// 11/11/2026: «di default metti che il menù signature/special si vede solo
// se clicchi sul carosello o con il QR code», con un'opzione per rimetterli
// fra le sezioni. Una sezione fatta solo di drink speciali (i Signature) è
// già nel carosello in cima: ripeterla più sotto, fra le sezioni, era la
// stessa cosa due volte.
describe('gli Special fuori dalle sezioni del menù', () => {
  // «Birre» diventa una sezione di soli Special.
  const CON_SIGNATURE = [
    { id: 'd1', name: 'Mojito', price: 7, category_id: 'c1', available: true },
    { id: 'd2', name: 'Negroni', price: 8, category_id: 'c1', available: true },
    { id: 's9', name: 'Regina', price: 10, category_id: 'c2', available: true, speciale: true },
  ]

  it('di partenza il cliente non trova la sezione fra le altre: c’è il carosello', async () => {
    ruoloClaim = null
    mockDrinks = CON_SIGNATURE
    mostra()
    await waitFor(() => expect(voci()).toEqual(['Mojito', 'Negroni']))
    expect(screen.getByRole('link', { name: 'Regina' })).toHaveClass('carosello-slide')
  })

  it('con l’opzione accesa la sezione torna fra le altre', async () => {
    ruoloClaim = null
    mockDrinks = CON_SIGNATURE
    mockSettings = { special_nel_menu: true }
    mostra()
    await waitFor(() => expect(voci()).toEqual(['Mojito', 'Negroni', 'Regina']))
  })

  // Senza carosello non ci sarebbe strada per arrivarci.
  it('col menù Special spento la sezione resta nel menù', async () => {
    ruoloClaim = null
    mockDrinks = CON_SIGNATURE
    mockSettings = { special_attivo: false }
    mostra()
    await waitFor(() => expect(voci()).toEqual(['Mojito', 'Negroni', 'Regina']))
  })

  // Chi lavora dal menù batte ordini: deve trovarci tutto.
  it('chi lavora la trova sempre', async () => {
    ruoloClaim = 'bartender'
    mockDrinks = CON_SIGNATURE
    mostra()
    await waitFor(() => expect(voci()).toEqual(['Mojito', 'Negroni', 'Regina']))
  })

  // Uno Special in mezzo agli altri non fa sparire la sua sezione.
  it('una sezione mista resta intera', async () => {
    ruoloClaim = null
    mockDrinks = [...DRINKS, { id: 's9', name: 'Regina', price: 10, category_id: 'c1', available: true, speciale: true }]
    mostra()
    await waitFor(() => expect(voci()).toEqual(expect.arrayContaining(['Mojito', 'Negroni', 'Regina', 'Ichnusa'])))
  })
})

// I PREZZI DEL MENÙ SENZA EURO, IL CARRELLO CON (REQ-MENU-038). Flavio,
// 11/11/2026: «togliere il simbolo dell'euro dal menù dei clienti… 8 euro,
// 8». Daniele: è un'impostazione, quella di Flavio di partenza; e alla
// domanda sul carrello e sull'ordine, dove il cliente sta per pagare: lì
// l'importo resta in euro («sì ok»).
// LA VOCE NON DISPONIBILE (REQ-MENU-017, Daniele 13/11/2026): al cliente
// non si dice mai cosa manca; il titolare sceglie se la voce resta con la
// scritta o sparisce. Il personale la vede sempre.
describe('la voce non disponibile', () => {
  const conNegroniFinito = () => {
    mockDrinks = DRINKS.map((d) => (d.id === 'd2' ? { ...d, non_disponibile_cliente: true } : d))
  }

  it('di partenza resta, con «Non disponibile» al posto di «Aggiungi»', async () => {
    ruoloClaim = null
    conNegroniFinito()
    mostra()
    await waitFor(() => expect(voci()).toEqual(['Mojito', 'Negroni', 'Ichnusa']))
    expect(screen.getAllByText('Non disponibile')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Aggiungi' })).toHaveLength(2)
  })

  it('il titolare può farla sparire', async () => {
    ruoloClaim = null
    conNegroniFinito()
    mockSettings = { menu_non_disponibili: 'nascondi' }
    mostra()
    await waitFor(() => expect(voci()).toEqual(['Mojito', 'Ichnusa']))
    expect(screen.queryByText('Non disponibile')).toBeNull()
  })

  it('il personale la vede e la ordina come sempre', async () => {
    conNegroniFinito()
    mockSettings = { menu_non_disponibili: 'nascondi' }
    mostra()
    await screen.findByText(/Inserimento ordine da/)
    expect(screen.queryByText('Non disponibile')).toBeNull()
    expect(screen.getAllByRole('button', { name: /Aggiungi/ })).toHaveLength(3)
  })
})

describe('i prezzi nel menù dei clienti', () => {
  const prezzi = () => [...document.querySelectorAll('.menu-item .price')].map((e) => e.textContent.replace(/ /g, ' '))

  it('di partenza le voci portano il numero, senza euro e senza ,00', async () => {
    ruoloClaim = null
    mostra()
    await waitFor(() => expect(prezzi()).toEqual(['7', '8', '4']))
  })

  it('con «valuta» nelle impostazioni tornano gli importi in euro', async () => {
    ruoloClaim = null
    mockSettings = { formato_prezzi_menu: 'valuta' }
    mostra()
    await waitFor(() => expect(prezzi()).toEqual(['7,00 €', '8,00 €', '4,00 €']))
  })

  it('il carrello resta in euro: lì si sta per pagare', async () => {
    const user = userEvent.setup()
    mostra()
    await screen.findByText(/Inserimento ordine da/)
    await user.click(screen.getAllByRole('button', { name: /Aggiungi/ })[0])
    const carrello = document.querySelector('.cartbar')
    expect(carrello.textContent).toMatch(/7,00\s€/)
    // E la voce, nel menù sopra, resta un numero.
    expect(prezzi()[0]).toBe('7')
  })
})
