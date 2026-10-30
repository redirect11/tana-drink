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
import '@testing-library/jest-dom/vitest'

let mockSettings = {}
let ruoloClaim = 'bartender'

vi.mock('../../src/lib/api.js', () => ({
  subscribeServiceStats: vi.fn(() => () => {}),
  subscribeSettings: vi.fn((cb) => {
    cb({ service_mode: 'tavolo', menu_only: false, ...mockSettings })
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

vi.mock('../../src/lib/menuCache.js', () => ({
  useMenu: () => ({
    loading: false,
    cats: [
      { id: 'c1', name: 'Cocktail', sort_order: 1 },
      { id: 'c2', name: 'Birre', sort_order: 2 },
    ],
    drinks: mockDrinks,
  }),
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
vi.mock('../../src/lib/printer.js', () => ({
  printComanda: (...a) => stampata(...a),
  salaStampaDaSe: () => stampaSala !== 'rimbalzo',
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
    expect(screen.getByText(/Rivolgersi allo staff per ordinare/)).toBeInTheDocument()
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

// LA VISTA MENÙ, PER CHI LAVORA, SERVE A UNA COSA: battere un ordine. La
// coda è un'altra pagina — vedersi in mezzo i propri ordini attivi
// mescolava due mestieri. Al cliente invece servono: è l'unico posto dove
// ritrova quello che ha ordinato.
describe('gli ordini in cima al menù', () => {
  it('il cliente ritrova il suo', async () => {
    localStorage.setItem('drink_my_orders_v1', JSON.stringify(['o-mio']))
    ruoloClaim = null
    mostra()
    expect(await screen.findByText(/Ordine #7/)).toBeInTheDocument()
  })

  it('chi lavora no: gli ordini stanno in coda', async () => {
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
    expect(screen.getByText('Creato con Drink')).toBeInTheDocument()
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

