// @vitest-environment happy-dom
'use strict'

// DUPLICARE UN DRINK. Mezzo listino sono variazioni: lo stesso drink col
// gin diverso, la versione analcolica, il formato grande. Rifarli a mano
// vuol dire riscrivere la RICETTA ingrediente per ingrediente, ed è lì che
// si sbaglia una dose e poi il magazzino scala storto.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
import { act } from 'react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

// Il filo per far arrivare alla pagina, mentre è aperta, quello che il
// server manderebbe: vi.mock viene issato in cima al file, quindi la
// scatola va creata con vi.hoisted o dentro il mock sarebbe ancora vuota.
const filo = vi.hoisted(() => ({ consegnaCategorie: null, impostazioni: {}, consegnaCarta: null, carta: { sezioni: [], voci: [] } }))

const DRINKS = [
  {
    id: 'mojito',
    name: 'Mojito',
    price: 7,
    description: 'Rum, lime, menta',
    recipe: 'Pesta la menta, poi allunga con soda.',
    available: true,
    category_id: 'c1',
    image_url: 'https://esempio/mojito.jpg',
    recipe_items: [{ inventory_item_id: 'i1', name: 'Rum', qty: 50, unit: 'ml' }],
  },
]
const CATEGORIE = [{ id: 'c1', name: 'Cocktail', sort_order: 0 }]
const MAGAZZINO = [{ id: 'i1', name: 'Rum', unit: 'ml', qty: 3000, cost: 20, package_qty: 700 }]

vi.mock('../../src/lib/api.js', () => ({
  fetchDrinks: vi.fn(() => Promise.resolve(DRINKS)),
  updateDrink: vi.fn(() => Promise.resolve()),
  deleteDrink: vi.fn(() => Promise.resolve()),
  fetchCategories: vi.fn(() => Promise.resolve(CATEGORIE)),
  // La pagina sta in ascolto: qui teniamo il filo per consegnare, a mano,
  // quello che il server manderebbe mentre la pagina è aperta.
  // La struttura del menù dei clienti (REQ-MENU-025): la prova la consegna
  // quando serve, come le categorie.
  subscribeCarta: vi.fn((onChange) => {
    filo.consegnaCarta = onChange
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
    filo.consegnaCategorie = onChange
    onChange(CATEGORIE)
    return () => {}
  }),
  createCategory: vi.fn(() => Promise.resolve({ id: 'c2', name: 'Nuova' })),
  updateCategory: vi.fn(() => Promise.resolve()),
  deleteCategory: vi.fn(() => Promise.resolve()),
  fetchInventoryItems: vi.fn(() => Promise.resolve(MAGAZZINO)),
  fetchInventoryCategories: vi.fn(() => Promise.resolve([])),
  subscribePosPrefs: vi.fn(() => () => {}),
  savePosColors: vi.fn(() => Promise.resolve()),
  subscribeSettings: vi.fn(() => () => {}),
  updateSettings: vi.fn(() => Promise.resolve()),
  DEFAULT_SETTINGS: { stripe_menu: 'scorte', special_titolo: 'Special', special_sottotitolo: '' },
  settingsIniziali: () => ({ stripe_menu: 'scorte', ...filo.impostazioni }),
}))
vi.mock('../../src/lib/storage.js', () => ({
  deleteDrinkImageByUrl: vi.fn(() => Promise.resolve()),
  uploadDrinkImage: vi.fn(() => Promise.resolve('https://esempio/nuova.jpg')),
}))

// Il QR del menù Special: l'immagine vera la fa la libreria, qui basta
// sapere che c'è e che punta all'indirizzo giusto.
const qr = vi.hoisted(() => ({ indirizzi: [] }))
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(async (testo) => {
      qr.indirizzi.push(testo)
      return 'data:image/png;base64,QR'
    }),
  },
}))

const salvaDrink = vi.fn(() => Promise.resolve())
vi.mock('../../src/lib/saveDrink.js', () => ({
  saveDrinkFromForm: (...a) => salvaDrink(...a),
}))

import MenuManager from '../../src/components/MenuManager.jsx'
import { AiutiCampi } from '../../src/lib/aiutiCampi.js'
import {
  updateDrink,
  creaSezioneCarta,
  aggiornaSezioneCarta,
  eliminaSezioneCarta,
  riordinaSezioniCarta,
  prepopolaStruttura,
  eliminaStruttura,
  creaVoceCarta,
  aggiornaVoceCarta,
  eliminaVoceCarta,
  spostaVociCarta,
} from '../../src/lib/api.js'
import { subscribeSottosezioni } from '../../src/lib/sottosezioni.js'
import { CON_LICENZA } from '../helpers/licenza.js'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  filo.impostazioni = {}
  filo.carta = { sezioni: [], voci: [] }
})

// Apre le azioni della card del Mojito e restituisce il riquadro.
async function azioniMojito(user) {
  const card = (await screen.findByText('Mojito')).closest('.menu-card')
  await user.click(within(card).getByRole('button', { name: /Azioni/ }))
  return within(card)
}

describe('duplicare un drink dalle azioni della card', () => {
  it('apre la scheda già piena, col nome marcato come copia', async () => {
    const user = userEvent.setup()
    render(<MenuManager />)
    const card = await azioniMojito(user)
    await user.click(card.getByRole('button', { name: /Duplica/ }))

    expect(await screen.findByLabelText('Nome *')).toHaveValue('Mojito (copia)')
    expect(screen.getByLabelText(/Prezzo/)).toHaveValue(7)
    // LA RICETTA VIENE DIETRO: è la parte lunga, ed è il motivo per cui si
    // duplica invece di rifare da capo.
    expect(screen.getByText('Rum')).toBeInTheDocument()
  })

  it('salvando NASCE un drink nuovo: l’originale non si tocca', async () => {
    const user = userEvent.setup()
    render(<MenuManager />)
    const card = await azioniMojito(user)
    await user.click(card.getByRole('button', { name: /Duplica/ }))
    await screen.findByLabelText('Nome *')
    await user.click(screen.getByRole('button', { name: /^Salva/ }))

    await waitFor(() => expect(salvaDrink).toHaveBeenCalled())
    const arg = salvaDrink.mock.calls[0][0]
    expect(arg.existing).toBe(null) // nuovo, non una modifica del Mojito
    expect(arg.form.name).toBe('Mojito (copia)')
  })

  it('la copia non si porta dietro la foto dell’originale', async () => {
    // Il file è agganciato al drink che l'ha caricato: cancellando
    // l'originale sparirebbe anche dalla copia, che resterebbe con un
    // riquadro rotto in carta.
    const user = userEvent.setup()
    render(<MenuManager />)
    const card = await azioniMojito(user)
    await user.click(card.getByRole('button', { name: /Duplica/ }))
    await screen.findByLabelText('Nome *')
    await user.click(screen.getByRole('button', { name: /^Salva/ }))

    await waitFor(() => expect(salvaDrink).toHaveBeenCalled())
    expect(salvaDrink.mock.calls[0][0].form.image_url).toBe(null)
  })

  it('«Aggiungi prodotto» dopo una duplica parte da vuoto', async () => {
    const user = userEvent.setup()
    render(<MenuManager />)
    const card = await azioniMojito(user)
    await user.click(card.getByRole('button', { name: /Duplica/ }))
    await screen.findByLabelText('Nome *')
    await user.click(screen.getByRole('button', { name: /Annulla/ }))
    await user.click(await screen.findByRole('button', { name: /Aggiungi prodotto/ }))
    expect(await screen.findByLabelText('Nome *')).toHaveValue('')
  })
})

// IL CONTEGGIO DELLE CATEGORIE NEL MENU A LATO. Le categorie si leggevano
// una volta sola all’apertura della pagina: il numero fra parentesi restava
// quello di allora, e una categoria creata dall’altro terminale (o al volo
// dalla scheda di un drink) non si contava finché non si entrava nella
// sezione. Al banco vuol dire fidarsi di un numero sbagliato.
describe('il conteggio «Categorie (N)» nel menu a lato', () => {
  // Le voci del menu a lato non le disegna la pagina: le dichiara e basta
  // (lib/sottosezioni.js), la barra le mostra. Qui le leggiamo da lì.
  function spiaVoci() {
    let ultime = []
    const stop = subscribeSottosezioni((s) => { ultime = s.voci })
    return { voce: (id) => ultime.find((v) => v.id === id), stop }
  }

  it('si aggiorna appena ne arriva una nuova, senza entrare nella sezione', async () => {
    const spia = spiaVoci()
    render(<MenuManager />)
    await screen.findByText('Mojito')
    await waitFor(() => expect(spia.voce('categorie').label).toBe('Categorie (1)'))

    // Un altro terminale aggiunge «Analcolici»: la pagina resta sul catalogo.
    act(() =>
      filo.consegnaCategorie([...CATEGORIE, { id: 'c2', name: 'Analcolici', sort_order: 1 }])
    )

    await waitFor(() => expect(spia.voce('categorie').label).toBe('Categorie (2)'))
    expect(screen.queryByPlaceholderText('Nuova categoria')).not.toBeInTheDocument()
    spia.stop()
  })

  it('e cala quando una categoria viene tolta', async () => {
    const spia = spiaVoci()
    render(<MenuManager />)
    await screen.findByText('Mojito')
    act(() => filo.consegnaCategorie([]))
    await waitFor(() => expect(spia.voce('categorie').label).toBe('Categorie (0)'))
    spia.stop()
  })
})

// ── L'IVA DI VENDITA SULLA SINGOLA VOCE (REQ-MENU-013) ───────────────
// Il locale ha la sua aliquota generale, ma nel menù c'è una categoria
// BOTTIGLIE e una bottiglia intera non si rivende come un drink servito al
// banco. Mettere tutto al 10% gonfia il netto, e dal netto scendono
// margine, incidenze e conto di fine mese.
describe('l’IVA di vendita nella scheda del prodotto', () => {
  it('c’è un campo suo, e vuoto vale quella del locale', async () => {
    const user = userEvent.setup()
    render(<MenuManager />)
    await user.click(await screen.findByRole('button', { name: /Aggiungi prodotto/ }))
    const campo = await screen.findByLabelText(/IVA vendita/)
    // Parte VUOTO: chi non ha eccezioni da scrivere non compila niente.
    expect(campo).toHaveValue(null)
    // L'aiuto riscritto il 08/11/2026 (REQ-UI-032): stessa regola, frase piana.
    expect(screen.getByText(/si applica l’IVA del locale/i)).toBeInTheDocument()
  })

  it('quello che si scrive lì finisce nel prodotto salvato', async () => {
    const user = userEvent.setup()
    render(<MenuManager />)
    await user.click(await screen.findByRole('button', { name: /Aggiungi prodotto/ }))
    await user.type(await screen.findByLabelText('Nome *'), 'Bottiglia di gin')
    await user.type(screen.getByLabelText(/IVA vendita/), '22')
    await user.click(screen.getByRole('button', { name: /^Salva/ }))

    await waitFor(() => expect(salvaDrink).toHaveBeenCalled())
    expect(salvaDrink.mock.calls[0][0].form.sale_vat).toBe('22')
  })
})

// LE ICONE DELLE SOTTOSEZIONI SONO EMOJI, E VANNO SCRITTE A COLORI.
// 🏷 e 🗂 sono fra i pochi emoji con presentazione TESTUALE di serie:
// scritti nudi il font li disegna in bianco e nero, e su Windows escono
// come rettangolini storti. Provammo a sostituirli con disegni SVG: il
// glifo si vedeva, ma in una fila fatta di emoji a colori due sagome
// monocrome stonavano, e lo stacco si notava piu' del difetto di prima.
// La cura e' il selettore di variante U+FE0F in coda, che dice al font
// «questa disegnala a colori»: stessa emoji, stessa fila. Qui si
// controlla che non ne resti in giro una NUDA, cioe' senza selettore.
describe('le icone delle sottosezioni', () => {
  const sorgente = (f) => readFileSync(join(process.cwd(), 'src/components', f), 'utf8')
  // Le righe fra `const NOME = [` e la quadra che lo chiude a inizio riga.
  const elenco = (f, nome) => {
    const righe = sorgente(f).split(/\r?\n/)
    const da = righe.findIndex((riga) => riga.includes(`const ${nome} = [`))
    expect(da, `${nome} in ${f}`).toBeGreaterThan(-1)
    const fine = righe.findIndex((riga, i) => i > da && riga.startsWith(']'))
    return righe.slice(da, fine + 1).join(' ')
  }

  // 🏷 o 🗂 NON seguiti da U+FE0F: l'emoji nuda, quella che si vede male.
  const NUDA = /[\u{1F3F7}\u{1F5C2}](?!\u{FE0F})/u

  // Le Statistiche non hanno più un elenco di sezioni: il «Mensile per
  // macro» ha traslocato in Bilancio, e con una vista sola non c'è niente
  // da far scegliere. L'elenco col 🗂️ dentro adesso è quello del Bilancio.
  it('menù, magazzino, bilancio e impostazioni le scrivono a colori', () => {
    for (const [file, nome] of [
      ['MenuManager.jsx', 'sezioni'],
      ['InventoryManager.jsx', 'INV_VIEWS'],
      ['BilancioTab.jsx', 'SEZIONI_BILANCIO'],
      ['SettingsTab.jsx', 'GRUPPI'],
    ]) {
      expect(elenco(file, nome), `${nome} in ${file}`).not.toMatch(NUDA)
    }
  })

  it('e non ne resta una nuda nei pannelli delle macro', () => {
    for (const f of ['MacroCategoryManager.jsx', 'MacroMonthlyTab.jsx']) {
      expect(sorgente(f), f).not.toMatch(NUDA)
    }
  })
})

// GLI SPECIAL DELLA CASA DAL GESTIONALE (REQ-MENU-018): «I drink speciali
// devono poter essere indicati nel backoffice del menu».
describe('gli special nella gestione del menù', () => {
  // Il disegno si COMPONE: bicchiere, colore, decorazione (l'utente,
  // 29/10/2026: «le immagini dei drink dovrebbero rappresentare i drink»).
  // I disegni sono del locale che ha «Notte» nella licenza (REQ-LIC-013):
  // la Tana.
  it('nella scheda si segna «Drink speciale» e si compone il disegno del drink', async () => {
    filo.impostazioni = CON_LICENZA
    const user = userEvent.setup()
    render(<MenuManager />)
    await user.click(await screen.findByRole('button', { name: /Aggiungi prodotto/ }))
    await user.type(await screen.findByLabelText('Nome *'), 'Tè dei matti')
    expect(screen.queryByRole('group', { name: 'Disegno del drink' })).toBeNull()
    await user.click(screen.getByLabelText('Drink speciale'))
    const disegno = within(screen.getByRole('group', { name: 'Disegno del drink' }))
    await user.click(disegno.getByRole('button', { name: 'Componi un disegno' }))
    await user.click(within(disegno.getByRole('group', { name: 'Bicchiere' })).getByRole('button', { name: 'Tazza' }))
    await user.click(within(disegno.getByRole('group', { name: 'Colore' })).getByRole('button', { name: 'Ambra' }))
    await user.click(within(disegno.getByRole('group', { name: 'Decorazione' })).getByRole('button', { name: 'Fetta di agrume' }))
    expect(within(disegno.getByRole('group', { name: 'Bicchiere' })).getByRole('button', { name: 'Tazza' })).toHaveAttribute('aria-pressed', 'true')
    // L'anteprima è il disegno vero.
    expect(disegno.getByRole('img', { name: 'Anteprima del disegno' }).getAttribute('src')).toMatch(/^data:image\/svg\+xml/)
    await user.click(screen.getByRole('button', { name: /^Salva/ }))
    await waitFor(() => expect(salvaDrink).toHaveBeenCalled())
    const { form } = salvaDrink.mock.calls[0][0]
    expect(form.speciale).toBe(true)
    expect(form.illustrazione).toEqual({ bicchiere: 'tazza', colore: 'ambra', decorazione: 'agrume' })
  })

  // L'utente, 04/11/2026: i disegni «sono della Tana»; la foto invece la
  // carica chiunque, a prescindere da tema e stile.
  it('senza «Notte» nella licenza il disegno non si compone, la foto si carica', async () => {
    filo.impostazioni = { licenza: { moduli: {}, temi: [] } }
    const user = userEvent.setup()
    render(<MenuManager />)
    await user.click(await screen.findByRole('button', { name: /Aggiungi prodotto/ }))
    await user.click(screen.getByLabelText('Drink speciale'))
    expect(screen.queryByRole('group', { name: 'Disegno del drink' })).toBeNull()
    expect(document.querySelector('input[type="file"]')).not.toBeNull()
  })

  // REQ-MENU-019: gli ingredienti che legge il cliente si scrivono nella
  // scheda, perché la ricetta è di magazzino e i Signature non ne hanno.
  it('nella scheda si scrivono gli ingredienti in carta', async () => {
    const user = userEvent.setup()
    render(<MenuManager />)
    await user.click(await screen.findByRole('button', { name: /Aggiungi prodotto/ }))
    await user.type(await screen.findByLabelText('Nome *'), 'Basiliconiglio')
    await user.type(screen.getByLabelText('Ingredienti in carta'), 'Gin, basilico, lime')
    await user.click(screen.getByRole('button', { name: /^Salva/ }))
    await waitFor(() => expect(salvaDrink).toHaveBeenCalled())
    expect(salvaDrink.mock.calls.at(-1)[0].form.ingredienti).toBe('Gin, basilico, lime')
  })

  // REQ-MENU-025: il nome che legge il cliente, quando quello del banco è
  // fatto per il banco («MARE» per il gin tonic col Gin Mare).
  it('nella scheda si scrive il nome nel menù dei clienti', async () => {
    const user = userEvent.setup()
    render(<MenuManager />)
    await user.click(await screen.findByRole('button', { name: /Aggiungi prodotto/ }))
    await user.type(await screen.findByLabelText('Nome *'), 'MARE')
    expect(screen.getByLabelText('Nome nel menù dei clienti')).toHaveAttribute('placeholder', 'MARE')
    await user.type(screen.getByLabelText('Nome nel menù dei clienti'), 'Gin Mare tonic')
    await user.click(screen.getByRole('button', { name: /^Salva/ }))
    await waitFor(() => expect(salvaDrink).toHaveBeenCalled())
    expect(salvaDrink.mock.calls.at(-1)[0].form.nome_cliente).toBe('Gin Mare tonic')
  })

  it('la sezione Special ha titolo, elenco e il QR del menù Special', async () => {
    const user = userEvent.setup()
    render(<MenuManager />)
    await screen.findByText('Mojito')
    const sezioni = []
    const stop = subscribeSottosezioni((s) => sezioni.push(s))
    const ultima = () => sezioni[sezioni.length - 1]
    await waitFor(() => expect(ultima()?.voci?.some((v) => v.id === 'special')).toBe(true))
    await act(async () => ultima().scegli('special'))
    expect(await screen.findByRole('heading', { name: /Menù Special/ })).toBeInTheDocument()
    expect(screen.getByText(/Nessun drink speciale/)).toBeInTheDocument()
    const immagine = await screen.findByRole('img', { name: 'QR del menù Special' })
    expect(immagine).toHaveAttribute('src', 'data:image/png;base64,QR')
    expect(qr.indirizzi.at(-1)).toMatch(/\/menu\/special$/)
    expect(screen.getByRole('link', { name: 'Scarica il QR' })).toHaveAttribute('download', 'qr-menu-special.png')
    stop()
  })
})

// IL MENÙ DEL PIANO FREE (REQ-LIC-003): oltre `prodotti_max` il tasto per
// aggiungere si spegne e la pagina dice perché, con la strada per cambiare
// piano. I prodotti che ci sono restano, e si modificano.
describe('il limite dei prodotti del piano Free', () => {
  const free = (max) => ({
    licenza: { piano: 'free', limiti: { prodotti_max: max }, regia_url: 'https://regia.example/piani' },
  })

  it('col menù pieno non si aggiunge, e lo si legge', async () => {
    filo.impostazioni = free(1)
    render(<MenuManager />)
    await screen.findByText('Mojito')
    expect(screen.getByRole('button', { name: '+ Aggiungi prodotto' })).toBeDisabled()
    expect(
      screen.getByText('Nel piano Free il menù ha al massimo 1 prodotto. Per aggiungerne passa a un piano a pagamento.')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vedi i piani' })).toHaveAttribute('href', 'https://regia.example/piani')
  })

  it('sotto il limite si aggiunge, e il salvataggio porta con sé il limite', async () => {
    const user = userEvent.setup()
    filo.impostazioni = free(2)
    render(<MenuManager />)
    await screen.findByText('Mojito')
    const aggiungi = screen.getByRole('button', { name: '+ Aggiungi prodotto' })
    expect(aggiungi).toBeEnabled()
    expect(screen.queryByText(/Nel piano Free/)).toBeNull()
    await user.click(aggiungi)
    // Sul profilo leggero del Free Storage non c'è: la foto non si carica,
    // e la scheda lo dice invece di fallire al salvataggio (REQ-LIC-004).
    expect(screen.getByText('Le foto dei prodotti sono dei piani a pagamento.')).toBeInTheDocument()
    expect(document.querySelector('input[type="file"]')).toBeNull()
    await user.type(screen.getByLabelText('Nome *'), 'Spritz')
    await user.click(screen.getByRole('button', { name: /Salva/ }))
    expect(salvaDrink).toHaveBeenCalledWith(
      expect.objectContaining({ impostazioni: expect.objectContaining(free(2)), prodotti: DRINKS })
    )
  })

  it('senza limiti nella licenza non c’è niente da leggere, e la foto si carica', async () => {
    const user = userEvent.setup()
    render(<MenuManager />)
    await screen.findByText('Mojito')
    expect(screen.getByRole('button', { name: '+ Aggiungi prodotto' })).toBeEnabled()
    expect(screen.queryByText(/Nel piano Free/)).toBeNull()
    await user.click(screen.getByRole('button', { name: '+ Aggiungi prodotto' }))
    expect(document.querySelector('input[type="file"]')).not.toBeNull()
  })
})

// LA STRUTTURA DEL MENÙ DEI CLIENTI, DAL GESTIONALE (REQ-MENU-025).
// Flavio, 04/11/2026: «un pannello dove creiamo tutte le voci che vanno nel
// menù vista cliente», e sulla voce del gestionale «una tendina con tutti
// gli item». L'utente, 05/11/2026: si parte dalle voci della cassa, poi
// sezioni e voci sono libere, ma ogni voce è collegata a un prodotto della
// cassa; e l'editor ha la forma del menù, coi testi scritti dove si leggono.
describe('la struttura del menù dei clienti nel gestionale (REQ-MENU-025)', () => {
  const STRUTTURA = {
    sezioni: [
      { id: 's-cocktail', nome: 'Cocktail IBA', ordine: 0, vista: 'dettagliata', nascosta: false },
      { id: 's-bibite', nome: 'Bibite', ordine: 1, vista: 'snella', nascosta: false },
    ],
    voci: [
      { id: 'v-mojito', sezione_id: 's-cocktail', drink_id: 'mojito', nome: 'Mojito cubano', descrizione: '', ingredienti: '', ordine: 0 },
      // Scritta da uno script, senza prodotto: l'editor non ne fa, ma la
      // deve saper mostrare.
      { id: 'v-libera', sezione_id: 's-cocktail', drink_id: null, nome: 'Daiquiri', descrizione: '', ingredienti: '', ordine: 1 },
    ],
  }

  async function apriStruttura() {
    render(<MenuManager />)
    await screen.findByText('Mojito')
    const sezioni = []
    const stop = subscribeSottosezioni((s) => sezioni.push(s))
    const ultima = () => sezioni[sezioni.length - 1]
    await waitFor(() => expect(ultima()?.voci?.some((v) => v.id === 'carta')).toBe(true))
    await act(async () => ultima().scegli('carta'))
    stop()
  }

  // LA VISTA COMPATTA (REQ-MENU-035): le sezioni partono chiuse, e si
  // aprono per lavorarci.
  async function apriSezione(user, nome) {
    const sezione = await screen.findByRole('region', { name: `Sezione ${nome}` })
    await user.click(within(sezione).getByRole('button', { name: `Apri la sezione ${nome}` }))
    return sezione
  }

  it('senza struttura il menù è per categorie, e si parte dalla copia delle voci della cassa', async () => {
    const user = userEvent.setup()
    await apriStruttura()
    expect(await screen.findByRole('heading', { name: /Menù dei clienti/ })).toBeInTheDocument()
    expect(screen.queryAllByRole('region', { name: /^Sezione / })).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Prepopola con le voci della cassa' }))
    const [copia] = prepopolaStruttura.mock.calls.at(-1)
    expect(copia.sezioni.map((x) => x.nome)).toEqual(['Cocktail'])
    expect(copia.voci).toEqual([{ sezione: copia.sezioni[0].chiave, drink_id: 'mojito', ordine: 0 }])
  })

  // L'utente, 10/11/2026, davanti a centinaia di card: «deve essere una
  // vista più compatta e maneggevole». Chiuse, le sezioni sono un indice
  // col numero delle voci; aperte, una riga per voce. I testi si aprono
  // sotto la riga, e sopra ogni campo c'è da dove viene il testo (l'utente,
  // 05/11/2026: «la casella con il nome in grigio cos'è?»).
  it('le sezioni sono un indice chiuso; aperte, una riga per voce, che si apre sui suoi testi', async () => {
    const user = userEvent.setup()
    filo.carta = STRUTTURA
    await apriStruttura()
    expect(screen.getByRole('link', { name: /Anteprima del menù dei clienti/ })).toHaveAttribute('href', '/menu?vista=cliente')
    expect(screen.getAllByRole('region', { name: /^Sezione / }).map((r) => r.getAttribute('aria-label'))).toEqual([
      'Sezione Cocktail IBA',
      'Sezione Bibite',
    ])
    const chiusa = screen.getByRole('region', { name: 'Sezione Cocktail IBA' })
    expect(within(chiusa).getByText('2 voci')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Sezione Bibite' })).getByText('0 voci · snella')).toBeInTheDocument()
    expect(within(chiusa).queryByRole('textbox')).toBeNull()

    const cocktail = await apriSezione(user, 'Cocktail IBA')
    // La riga: il nome letto al tavolo, quello della cassa accanto, il prezzo.
    const riga = within(cocktail).getByRole('button', { name: 'Apri Mojito cubano' })
    expect(within(riga).getByText('Mojito')).toBeInTheDocument()
    expect(within(cocktail).getByText(/^7,00/)).toBeInTheDocument()
    // La voce senza prodotto ha il dettaglio aperto da subito, con la tendina.
    expect(within(cocktail).getByText('senza prodotto')).toBeInTheDocument()
    let tendine = within(cocktail).getAllByRole('combobox', { name: 'Prodotto della cassa' })
    expect(tendine.map((t) => t.value)).toEqual([''])
    await user.click(riga)
    // Il prodotto collegato si legge; la tendina resta solo per la voce che
    // un prodotto non ce l'ha.
    expect(within(cocktail).getByText(/^Mojito · 7,00/, { selector: 'span' })).toBeInTheDocument()
    tendine = within(cocktail).getAllByRole('combobox', { name: 'Prodotto della cassa' })
    expect(tendine.map((t) => t.value)).toEqual([''])
    expect(within(cocktail).getByText(/Nessun prodotto della cassa collegato/)).toBeInTheDocument()
    // Il nome è della sezione, la descrizione viene dalla scheda: il campo
    // mostra il testo che legge il cliente, non un segnaposto.
    const [nome] = within(cocktail).getAllByRole('textbox', { name: 'Nome nella sezione' })
    expect(nome).toHaveValue('Mojito cubano')
    const [descrizione] = within(cocktail).getAllByRole('textbox', { name: 'Descrizione nella sezione' })
    expect(descrizione).toHaveValue('Rum, lime, menta')
    expect(within(cocktail).getAllByText('solo in questa sezione').length).toBeGreaterThan(0)
    expect(within(cocktail).getAllByText('dalla scheda prodotto').length).toBeGreaterThan(0)
    // Una voce sola aperta alla volta: richiusa, i testi se ne vanno.
    await user.click(within(cocktail).getByRole('button', { name: 'Chiudi Mojito cubano' }))
    expect(within(cocktail).getAllByRole('textbox', { name: 'Nome nella sezione' })).toHaveLength(1)
  })

  // REQ-MENU-041 (Daniele, 13/11/2026): le sezioni nascono dalla categoria
  // delle voci. Prima si dice cosa cambia, poi si fa; la voce senza
  // categoria resta dov'è.
  it('«Raggruppa per categoria» crea la sezione che manca e ci sposta la voce', async () => {
    const user = userEvent.setup()
    filo.carta = STRUTTURA
    creaSezioneCarta.mockClear()
    spostaVociCarta.mockClear()
    await apriStruttura()
    await user.click(screen.getByRole('button', { name: 'Raggruppa per categoria' }))
    expect(screen.getByText(/Nuove sezioni: Cocktail\. Voci spostate nella sezione della loro categoria: 1\./)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Raggruppa' }))
    expect(creaSezioneCarta).toHaveBeenCalledWith({ nome: 'Cocktail', ordine: 2 })
    expect(spostaVociCarta).toHaveBeenCalledWith([{ id: 'v-mojito', sezione_id: 'nuova', ordine: 0 }])
  })

  it('una sezione nuova va in cima; una voce nasce col suo prodotto, cambia prodotto e cambia sezione', async () => {
    const user = userEvent.setup()
    filo.carta = STRUTTURA
    await apriStruttura()
    await user.type(await screen.findByRole('textbox', { name: 'Nome della nuova sezione' }), 'Signature{Enter}')
    expect(creaSezioneCarta).toHaveBeenCalledWith({ nome: 'Signature', ordine: -1 })

    const cocktail = await apriSezione(user, 'Cocktail IBA')
    await user.selectOptions(within(cocktail).getByRole('combobox', { name: 'Aggiungi un prodotto a Cocktail IBA' }), 'mojito')
    expect(creaVoceCarta).toHaveBeenCalledWith({ sezione_id: 's-cocktail', drink_id: 'mojito', ordine: 2 })

    const [libera] = within(cocktail).getAllByRole('combobox', { name: 'Prodotto della cassa' })
    await user.selectOptions(libera, 'mojito')
    expect(aggiornaVoceCarta).toHaveBeenCalledWith('v-libera', { drink_id: 'mojito' })

    // Il prodotto si cambia, ma non si toglie: la scelta vuota non c'è.
    await user.click(within(cocktail).getByRole('button', { name: 'Apri Mojito cubano' }))
    await user.click(within(cocktail).getByRole('button', { name: 'Cambia il prodotto della cassa di Mojito cubano' }))
    const [cambia] = within(cocktail).getAllByRole('combobox', { name: 'Prodotto della cassa' })
    expect(cambia).toHaveValue('mojito')
    expect(within(cambia).queryByRole('option', { name: /Scegliere/ })).toBeNull()

    // Si sposta in fondo all'altra sezione, coi suoi ritocchi.
    await user.selectOptions(within(cocktail).getByRole('combobox', { name: 'Sposta Mojito cubano in un’altra sezione' }), 's-bibite')
    expect(aggiornaVoceCarta).toHaveBeenLastCalledWith('v-mojito', { sezione_id: 's-bibite', ordine: 0 })
  })

  // Un ritocco uguale al testo della scheda non è un ritocco: se si
  // scrivesse, una correzione fatta poi sulla scheda qui non arriverebbe.
  it('un ritocco si scrive; svuotato o uguale alla scheda torna alla scheda', async () => {
    const user = userEvent.setup()
    filo.carta = STRUTTURA
    await apriStruttura()
    const cocktail = await apriSezione(user, 'Cocktail IBA')
    await user.click(within(cocktail).getByRole('button', { name: 'Apri Mojito cubano' }))
    const [descrizione] = within(cocktail).getAllByRole('textbox', { name: 'Descrizione nella sezione' })
    await user.clear(descrizione)
    await user.type(descrizione, 'Solo per la sezione')
    await user.tab()
    expect(aggiornaVoceCarta).toHaveBeenLastCalledWith('v-mojito', { descrizione: 'Solo per la sezione' })

    const [nome] = within(cocktail).getAllByRole('textbox', { name: 'Nome nella sezione' })
    await user.clear(nome)
    await user.type(nome, 'Mojito{Enter}')
    expect(aggiornaVoceCarta).toHaveBeenLastCalledWith('v-mojito', { nome: '' })

    const [ripristina] = within(cocktail).getAllByRole('button', { name: 'Riporta il nome come la scheda' })
    await user.click(ripristina)
    expect(aggiornaVoceCarta).toHaveBeenLastCalledWith('v-mojito', { nome: '' })
  })

  // L'utente, 05/11/2026: «serve un tasto per prepopolare tutto come se
  // fosse il menu cassa e poi da lì modifico» — anche su un menù già
  // personalizzato, come quello della demo.
  // La struttura di prima e la copia nuova vanno nello stesso giro di
  // scritture: in due giri l'editor passava per il menù vuoto.
  it('su una struttura che c’è già, si riparte dalle voci della cassa dopo una conferma', async () => {
    const user = userEvent.setup()
    filo.carta = STRUTTURA
    await apriStruttura()
    const tasto = await screen.findByRole('button', { name: 'Riparti dalle voci della cassa' })
    await user.click(tasto)
    await user.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(prepopolaStruttura).not.toHaveBeenCalled()
    await user.click(tasto)
    await user.click(screen.getByRole('button', { name: 'Riparti' }))
    const [copia, opzioni] = prepopolaStruttura.mock.calls.at(-1)
    expect(copia.voci.map((v) => v.drink_id)).toEqual(['mojito'])
    expect(opzioni).toEqual({ sostituisci: STRUTTURA })
  })

  // IL GRUPPO DELLA SEZIONE (REQ-MENU-030): la macro categoria per i menù
  // impaginati a gruppi. Si sceglie fra quelli scritti o se ne scrive uno
  // nuovo; svuotato, la sezione non è in nessun gruppo.
  it('il gruppo di una sezione: le proposte sono quelli già scritti, uno nuovo si scrive lì', async () => {
    const user = userEvent.setup()
    filo.carta = {
      ...STRUTTURA,
      sezioni: STRUTTURA.sezioni.map((s) => (s.id === 's-cocktail' ? { ...s, gruppo: 'Cocktail' } : s)),
    }
    await apriStruttura()
    const cocktail = await apriSezione(user, 'Cocktail IBA')
    const suo = within(cocktail).getByRole('combobox', { name: 'Gruppo della sezione Cocktail IBA' })
    expect(suo).toHaveValue('Cocktail')
    const proposte = document.getElementById(suo.getAttribute('list'))
    expect([...proposte.querySelectorAll('option')].map((o) => o.value)).toEqual(['Cocktail'])

    const bibite = await apriSezione(user, 'Bibite')
    const gruppo = within(bibite).getByRole('combobox', { name: 'Gruppo della sezione Bibite' })
    await user.type(gruppo, ' Da bere {Enter}')
    expect(aggiornaSezioneCarta).toHaveBeenLastCalledWith('s-bibite', { gruppo: 'Da bere' })

    aggiornaSezioneCarta.mockClear()
    await user.click(suo)
    await user.tab()
    expect(aggiornaSezioneCarta).not.toHaveBeenCalled()
    await user.clear(suo)
    await user.tab()
    expect(aggiornaSezioneCarta).toHaveBeenLastCalledWith('s-cocktail', { gruppo: null })
  })

  // Le cancellazioni si confermano col dialogo dell'app, non col
  // `confirm` del browser, che nella PWA installata può non comparire.
  it('le sezioni si nascondono, si spostano, si eliminano; e tutto torna al menù per categorie', async () => {
    const user = userEvent.setup()
    filo.carta = STRUTTURA
    await apriStruttura()
    const bibite = await apriSezione(user, 'Bibite')
    await user.click(within(bibite).getByRole('checkbox', { name: 'Nascosta' }))
    expect(aggiornaSezioneCarta).toHaveBeenLastCalledWith('s-bibite', { nascosta: true })
    // Il riordino va in un pacchetto solo.
    await user.click(within(bibite).getByRole('button', { name: 'Sezione su' }))
    expect(riordinaSezioniCarta).toHaveBeenCalledWith([
      { id: 's-bibite', ordine: 0 },
      { id: 's-cocktail', ordine: 1 },
    ])
    await user.click(within(bibite).getByRole('button', { name: 'Elimina la sezione Bibite' }))
    await user.click(screen.getByRole('button', { name: 'Elimina' }))
    expect(eliminaSezioneCarta).toHaveBeenCalledWith('s-bibite', [])
    await user.click(screen.getByRole('button', { name: 'Torna al menù per categorie' }))
    await user.click(screen.getByRole('button', { name: 'Elimina tutto' }))
    expect(eliminaStruttura).toHaveBeenCalledWith(STRUTTURA)
  })

  // «Con la possibilità di spostare gli item di menu tra le categorie»
  // (l'utente, 10/11/2026): una per una dalla riga, o selezionate e
  // spostate insieme, in un pacchetto solo.
  it('le voci selezionate si spostano insieme in un’altra sezione', async () => {
    const user = userEvent.setup()
    filo.carta = STRUTTURA
    await apriStruttura()
    const cocktail = await apriSezione(user, 'Cocktail IBA')
    await user.click(within(cocktail).getByRole('button', { name: 'Seleziona tutte' }))
    const scelte = screen.getByRole('group', { name: 'Voci selezionate' })
    expect(within(scelte).getByText('2 voci selezionate')).toBeInTheDocument()
    await user.click(within(cocktail).getByRole('checkbox', { name: 'Seleziona Daiquiri' }))
    expect(within(scelte).getByText('1 voce selezionata')).toBeInTheDocument()

    await user.selectOptions(within(scelte).getByRole('combobox', { name: 'Sposta le voci selezionate in un’altra sezione' }), 's-bibite')
    expect(spostaVociCarta).toHaveBeenCalledWith([{ id: 'v-mojito', sezione_id: 's-bibite', ordine: 0 }])
    // La scelta si svuota e la sezione d'arrivo si apre.
    expect(screen.queryByRole('group', { name: 'Voci selezionate' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Chiudi la sezione Bibite' })).toBeInTheDocument()
  })

  it('la ricerca apre le sezioni sulle voci trovate, e tutte le sezioni si aprono e si chiudono insieme', async () => {
    const user = userEvent.setup()
    filo.carta = STRUTTURA
    await apriStruttura()
    await user.click(await screen.findByRole('button', { name: 'Apri tutte' }))
    expect(screen.getByRole('button', { name: 'Chiudi la sezione Bibite' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Chiudi tutte' }))
    expect(screen.getByRole('button', { name: 'Apri la sezione Cocktail IBA' })).toBeInTheDocument()

    const cerca = screen.getByRole('searchbox', { name: 'Cerca una voce nel menù dei clienti' })
    await user.type(cerca, 'cubano')
    expect(screen.getAllByRole('region', { name: /^Sezione / }).map((r) => r.getAttribute('aria-label'))).toEqual([
      'Sezione Cocktail IBA',
    ])
    const cocktail = screen.getByRole('region', { name: 'Sezione Cocktail IBA' })
    expect(within(cocktail).getByRole('button', { name: 'Apri Mojito cubano' })).toBeInTheDocument()
    expect(within(cocktail).queryByRole('checkbox', { name: 'Seleziona Daiquiri' })).toBeNull()

    await user.clear(cerca)
    await user.type(cerca, 'negroni')
    expect(screen.getByText('Nessuna voce trovata per «negroni».')).toBeInTheDocument()
  })

  // UN PRODOTTO CHE IN CASSA NON C'È (REQ-MENU-036). L'utente, 10/11/2026:
  // «dobbiamo agevolare questo workflow direttamente dal menu clienti. Se
  // non esiste un item cassa, si può creare anche da lì». La scheda nuova
  // parte con la categoria che porta il nome della sezione; salvato, il
  // prodotto entra in fondo alla sezione, e si torna con la sezione aperta.
  it('dalla sezione si crea un prodotto della cassa che entra subito come voce', async () => {
    const user = userEvent.setup()
    filo.carta = {
      sezioni: [...STRUTTURA.sezioni, { id: 's-cat', nome: 'cocktail', ordine: 2, vista: 'dettagliata', nascosta: false }],
      voci: STRUTTURA.voci,
    }
    salvaDrink.mockResolvedValueOnce({ id: 'nuovo-drink', name: 'Paloma' })
    await apriStruttura()
    const sezione = await apriSezione(user, 'cocktail')
    await user.click(within(sezione).getByRole('button', { name: 'Nuovo prodotto della cassa in cocktail' }))
    expect(await screen.findByLabelText('Nome *')).toHaveValue('')
    expect(screen.getByLabelText('Categoria')).toHaveValue('c1')
    await user.type(screen.getByLabelText('Nome *'), 'Paloma')
    await user.type(screen.getByLabelText(/Prezzo/), '9')
    await user.click(screen.getByRole('button', { name: /^Salva/ }))

    await waitFor(() => expect(creaVoceCarta).toHaveBeenCalledWith({ sezione_id: 's-cat', drink_id: 'nuovo-drink', ordine: 0 }))
    expect(salvaDrink.mock.calls[0][0].existing).toBe(null)
    expect(await screen.findByRole('button', { name: 'Chiudi la sezione cocktail' })).toBeInTheDocument()
  })

  it('una sezione senza categoria omonima apre la scheda senza categoria; annullando non nasce niente', async () => {
    const user = userEvent.setup()
    filo.carta = STRUTTURA
    await apriStruttura()
    const bibite = await apriSezione(user, 'Bibite')
    await user.click(within(bibite).getByRole('button', { name: 'Nuovo prodotto della cassa in Bibite' }))
    expect(await screen.findByLabelText('Categoria')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(creaVoceCarta).not.toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Chiudi la sezione Bibite' })).toBeInTheDocument()
  })

  // Il prezzo della libertà: un prodotto nuovo in cassa non entra da solo
  // nel menù dei clienti. L'editor lo dice, e lo fa aggiungere.
  it('i prodotti della cassa rimasti fuori si vedono, e si aggiungono a una sezione', async () => {
    const user = userEvent.setup()
    filo.carta = { sezioni: STRUTTURA.sezioni, voci: [] }
    await apriStruttura()
    expect(await screen.findByText('Prodotti della cassa non presenti nel menù dei clienti (1)')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Aggiungi Mojito a una sezione' }), 's-bibite')
    expect(creaVoceCarta).toHaveBeenCalledWith({ sezione_id: 's-bibite', drink_id: 'mojito', ordine: 0 })
  })

  it('dalla voce si apre la scheda del prodotto', async () => {
    const user = userEvent.setup()
    filo.carta = STRUTTURA
    await apriStruttura()
    const cocktail = await apriSezione(user, 'Cocktail IBA')
    await user.click(within(cocktail).getByRole('button', { name: 'Apri Mojito cubano' }))
    await user.click(within(cocktail).getByRole('button', { name: 'Apri la scheda di Mojito' }))
    expect(await screen.findByLabelText('Nome *')).toHaveValue('Mojito')
  })

  it('dalla scheda del prodotto: in quali sezioni compare, aggiungerlo a un’altra, toglierlo', async () => {
    const user = userEvent.setup()
    filo.carta = STRUTTURA
    render(<MenuManager />)
    const azioni = await azioniMojito(user)
    expect(azioni.getByText(/Menù dei clienti:/)).toBeInTheDocument()
    await user.selectOptions(azioni.getByRole('combobox', { name: 'Aggiungi Mojito a una sezione' }), 's-bibite')
    expect(creaVoceCarta).toHaveBeenCalledWith({ sezione_id: 's-bibite', drink_id: 'mojito', ordine: 0 })
    await user.click(azioni.getByRole('button', { name: 'Togli Mojito da Cocktail IBA' }))
    expect(eliminaVoceCarta).toHaveBeenCalledWith('v-mojito')
  })

  it('sulla scheda del prodotto si vede quando non compare nel menù dei clienti', async () => {
    const user = userEvent.setup()
    filo.carta = { sezioni: STRUTTURA.sezioni, voci: [] }
    render(<MenuManager />)
    const azioni = await azioniMojito(user)
    expect(azioni.getByText('non compare')).toBeInTheDocument()
  })

  it('senza struttura personalizzata, sulla scheda del prodotto non compare niente', async () => {
    const user = userEvent.setup()
    render(<MenuManager />)
    const azioni = await azioniMojito(user)
    expect(azioni.queryByText(/Menù dei clienti:/)).toBeNull()
  })
})

// GLI AIUTI SOTTO I CAMPI SI SPENGONO (REQ-UI-032). Richiesta dell'08/11/2026:
// «rimuovere gli aiuti sopra tutti i campi compilabili o almeno permettere
// di abilitarli/disabilitarli». Nell'app di partenza sono nascosti; il
// campo resta, la riga che lo spiega no.
describe('la scheda del prodotto con gli aiuti nascosti', () => {
  it('i campi ci sono, le righe d’aiuto no', async () => {
    const user = userEvent.setup()
    render(
      <AiutiCampi.Provider value={false}>
        <MenuManager />
      </AiutiCampi.Provider>
    )
    await user.click(await screen.findByRole('button', { name: /Aggiungi prodotto/ }))
    expect(await screen.findByLabelText(/IVA vendita/)).toBeInTheDocument()
    expect(screen.getByLabelText('Nome nel menù dei clienti')).toBeInTheDocument()
    expect(screen.queryByText(/si applica l’IVA del locale/i)).toBeNull()
    expect(screen.queryByText(/Nome della voce nel menù dei clienti/)).toBeNull()
    expect(document.querySelectorAll('.aiuto-campo')).toHaveLength(0)
  })

  it('accesi, gli aiuti tornano', async () => {
    const user = userEvent.setup()
    render(
      <AiutiCampi.Provider value={true}>
        <MenuManager />
      </AiutiCampi.Provider>
    )
    await user.click(await screen.findByRole('button', { name: /Aggiungi prodotto/ }))
    await screen.findByLabelText(/IVA vendita/)
    expect(document.querySelectorAll('.aiuto-campo').length).toBeGreaterThan(3)
  })
})
