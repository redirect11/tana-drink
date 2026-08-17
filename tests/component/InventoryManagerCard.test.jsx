// @vitest-environment happy-dom
'use strict'

// IL MAGAZZINO A SCHERMO. Quello che si legge sulle card e nella scheda di
// un prodotto: i numeri scritti come si leggono e le unità di misura che si
// possono scegliere. I calcoli stanno in tests/unit/inventory.test.js; qui
// si controlla che arrivino davanti a chi lavora nella forma giusta.

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen, within, waitFor } from '@testing-library/react'
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
    // I quattro modi in cui una scheda vecchia (senza campo `tipo`) si
    // riapre nel tipo giusto: il Campari qui sopra è il pezzo CON
    // contenuto (versato); questi coprono gli altri tre casi.
    { id: 'ichnusa', name: 'Ichnusa', unit: 'pz', stock: 12, cost: 1.2, vat: 22 },
    { id: 'ghiaccio', name: 'Ghiaccio', unit: 'U', scorta: true, stock: 6, cost: 2, vat: 22 },
    { id: 'lavoro', name: 'Tempo di Lavorazione', unit: 'U', stock: 0, cost: 0.5, vat: 22 },
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
    // La colonna «a fine serata» (REQ-MAG-014) legge anche la cassa aperta,
    // i conti in corso e il listino: qui la serata non è aperta, quindi la
    // colonna non compare — ma senza queste tre voci la schermata non si
    // monta proprio.
    subscribeOpenCashSession: (cb) => {
      cb(null)
      return () => {}
    },
    subscribeActiveOrders: (cb) => {
      cb([])
      return () => {}
    },
    subscribeDrinks: (_opts, cb) => {
      cb([])
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
// Card e lista sono DUE ICONE, e si cercano dalla loro etichetta: sulla linea
// di produzione era un tasto scritto «▦ Card», e con questo merge diventa
// l'icona «A card» (REQ-MAG-010). Il comportamento provato qui sotto è lo
// stesso: cambia solo come si arriva alla vista.
async function apriCard(user) {
  await screen.findByText('Campari')
  await user.click(screen.getByRole('button', { name: 'A card' }))
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
    // Ogni card ha il suo «⋯ Azioni»: si apre quella del Campari.
    const card = screen.getByText('Campari').closest('.grid-card')
    await user.click(within(card).getByRole('button', { name: '⋯ Azioni' }))
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

// E NEMMENO LA FILA DEI TRE TASTI DEVE SFONDARE LA CARD.
//
// Primo giro di correzione: le righe di testo si sono sistemate, ma provando
// sul test i tasti «✏️ Modifica · ⧉ Duplica · 🗑 Elimina» uscivano ancora dai
// bordi. Stesso errore un piano sotto: `.inv-azioni` era `repeat(3, 1fr)`, e
// `1fr` vale `minmax(auto, 1fr)` — non scende sotto la larghezza del
// contenuto. Tre bottoni con emoji e parola hanno un minimo più largo di
// quello che una card da 175px può dargli, quindi la griglia sborda invece di
// stringersi. La regola che li mandava a capo era una @media sulla finestra, e
// la finestra qui è grande: è la CARD a essere stretta.
//
// ATTENZIONE A COSA PROVA QUESTO TEST. happy-dom non fa layout — le larghezze
// e scrollWidth sono zero — quindi «la fila non esce dalla card» non si può
// MISURARE qui: quello si guarda con gli occhi, in un browser o al banco. Qui
// si prova il MECCANISMO, e non è poco: il foglio di stile vero viene applicato
// al DOM vero prodotto dal componente, e si controlla quale regola vince su
// quell'elemento — colonne che si stringono e vanno a capo da sé, guidate dal
// contenitore e non dalla finestra.
describe('la fila dei tasti dentro una card', () => {
  const css = readFileSync('src/index.css', 'utf8')

  // Il foglio di stile del progetto, addosso al DOM del componente.
  function applicaCss() {
    const style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)
    return () => style.remove()
  }

  async function apriAzioniInCard(user) {
    render(<InventoryManager />)
    await apriCard(user)
    // Ogni card ha il suo «⋯ Azioni»: si apre quella del Campari.
    const card = screen.getByText('Campari').closest('.grid-card')
    await user.click(within(card).getByRole('button', { name: '⋯ Azioni' }))
  }

  it('le colonne possono stringersi e vanno a capo da sé', async () => {
    const user = userEvent.setup()
    await apriAzioniInCard(user)
    const via = applicaCss()
    const fila = document.querySelector('.grid-card .inv-azioni')
    expect(fila).not.toBeNull()
    const colonne = getComputedStyle(fila).gridTemplateColumns
    // `auto-fit`: tiene solo le colonne che entrano DAVVERO nella card, le
    // altre vanno a capo. Niente più tre colonne per forza.
    expect(colonne).toContain('auto-fit')
    expect(colonne).not.toContain('repeat(3')
    // `min(…, 100%)`: una colonna non è mai più larga della card, nemmeno nel
    // caso peggiore.
    expect(colonne).toMatch(/min\(\s*\d+px\s*,\s*100%\s*\)/)
    via()
  })

  it('e se la parola non ci sta si tronca, invece di sfondare', async () => {
    const user = userEvent.setup()
    await apriAzioniInCard(user)
    const via = applicaCss()
    const tasto = document.querySelector('.grid-card .inv-azioni .btn')
    const stile = getComputedStyle(tasto)
    // Senza `min-width: 0` un bottone resta incomprimibile, allarga la colonna
    // e si torna al punto di partenza.
    expect(['0', '0px']).toContain(stile.minWidth)
    expect(stile.overflow).toBe('hidden')
    expect(stile.textOverflow).toBe('ellipsis')
    via()
  })

  it('nella vista a Lista la fila resta a tre, che lo spazio c’è', async () => {
    const user = userEvent.setup()
    render(<InventoryManager />)
    // Vista a Lista: è il default, basta aprire la riga del prodotto.
    await user.click(await screen.findByRole('button', { name: /Campari/ }))
    const via = applicaCss()
    const fila = document.querySelector('.inv-row .inv-azioni')
    expect(fila).not.toBeNull()
    expect(getComputedStyle(fila).gridTemplateColumns).toBe('repeat(3, 1fr)')
    via()
  })

  it('il comportamento è agganciato alla card, non alla finestra', () => {
    // Una @media guarda la finestra: dentro una card stretta, su un monitor
    // grande, non scatterebbe mai. La regola delle card deve quindi stare al
    // primo livello del foglio di stile, fuori da qualunque blocco @media —
    // e lo si vede dalle graffe ancora aperte prima di lei.
    const pulito = css.replace(/\/\*[\s\S]*?\*\//g, '')
    const dove = pulito.search(/\.grid-card\s+\.inv-azioni\s*\{[^}]*auto-fit/)
    expect(dove).toBeGreaterThan(-1)
    const prima = pulito.slice(0, dove)
    const aperte = (prima.match(/\{/g) || []).length - (prima.match(/\}/g) || []).length
    expect(aperte).toBe(0)
  })
})

// ── LA SCHEDA PRODOTTO PARTE DA UNA DOMANDA: CHE TIPO È? ─────────────
// Quattro card — intero, versato, sfuso, lavoro — e ognuna porta i suoi
// campi: il tipo decide unità e scorta, e sono spariti il selettore delle
// unità a famiglie e la casella «è una scorta». Vedi REQ-MAG-016.
describe('la scheda prodotto parte dal tipo', () => {
  async function apriForm(user) {
    render(<InventoryManager />)
    await screen.findByText('Campari')
    await user.click(screen.getByRole('button', { name: '+ Nuovo prodotto' }))
  }

  it('le quattro card ci sono, e i campi seguono la scelta', async () => {
    const user = userEvent.setup()
    await apriForm(user)
    // Prima si risponde: senza tipo, niente campi delle unità.
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    expect(screen.queryByLabelText(/Costo €\//)).toBeNull()

    await user.click(screen.getByRole('radio', { name: /Lo vendo intero/ }))
    expect(screen.getByLabelText(/Costo €\/pz/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Dentro c.è/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Soglia di avviso \(pz\)/)).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Sfuso/ }))
    expect(screen.getByLabelText('Come lo compri')).toBeInTheDocument()
    expect(screen.getByLabelText(/Costo €\/kg/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Si usa in un.altra misura/)).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Lavoro o servizio/ }))
    expect(screen.getByLabelText(/Costo €\/U/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Soglia di avviso/)).toBeNull()
    expect(screen.queryByLabelText(/Quantità iniziale/)).toBeNull()
  })

  it('senza rispondere non si salva, e la scheda spiega perché', async () => {
    const user = userEvent.setup()
    createInventoryItem.mockClear()
    await apriForm(user)
    await user.type(screen.getByLabelText('Nome *'), 'Senza tipo')
    await user.click(screen.getByRole('button', { name: /^Salva/ }))
    expect(createInventoryItem).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/che tipo di prodotto/i)
  })

  it('il «?» racconta i quattro tipi, con un esempio l’uno', async () => {
    const user = userEvent.setup()
    await apriForm(user)
    await user.click(screen.getByRole('button', { name: /Come si compila/ }))
    const box = await screen.findByRole('dialog', { name: /Come si compila/ })
    expect(within(box).getByText('🍺 Lo vendo intero')).toBeInTheDocument()
    expect(within(box).getByText(/Una bottiglia fa 70 cl/)).toBeInTheDocument()
    expect(within(box).getByText(/1 kg di limoni fa 50 cl/)).toBeInTheDocument()
    expect(within(box).getByText(/Il tempo di lavorazione/)).toBeInTheDocument()
  })
})

// ── IL LAVORO NON È MERCE ────────────────────────────────────────────
// «Tempo di Lavorazione» si crea per mettere il lavoro a listino: ha un
// costo per unità e niente altro — niente giacenza, niente soglia, mai
// esaurito. Prima bisognava scegliere «unità generiche» in una tendina di
// unità di misura e capire da soli la casella della scorta.
describe('il tipo «lavoro o servizio»', () => {
  async function nuovoLavoro(user) {
    render(<InventoryManager />)
    await screen.findByText('Campari')
    await user.click(screen.getByRole('button', { name: '+ Nuovo prodotto' }))
    await user.click(screen.getByRole('radio', { name: /Lavoro o servizio/ }))
  }

  it('chiede solo il costo per unità', async () => {
    const user = userEvent.setup()
    await nuovoLavoro(user)
    expect(screen.getByLabelText(/Costo €\/U/)).toBeInTheDocument()
    // Niente contenuto, niente giacenza iniziale, niente soglia e niente
    // casella «è una scorta»: lo dice il tipo.
    expect(screen.queryByLabelText(/Una bottiglia fa/)).toBeNull()
    expect(screen.queryByLabelText(/Quantità iniziale/)).toBeNull()
    expect(screen.queryByLabelText(/Soglia di avviso/)).toBeNull()
    expect(screen.queryByRole('checkbox', { name: /È una scorta/ })).toBeNull()
  })

  it('e si salva come U non-scorta, senza giacenza', async () => {
    const user = userEvent.setup()
    await nuovoLavoro(user)
    await user.type(screen.getByLabelText('Nome *'), 'Tempo di Lavorazione')
    await user.type(screen.getByLabelText(/Costo €\/U/), '0.5')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(createInventoryItem).toHaveBeenCalled())
    expect(createInventoryItem.mock.calls.at(-1)[0]).toMatchObject({
      name: 'Tempo di Lavorazione',
      tipo: 'lavoro',
      unit: 'U',
      display_unit: 'U',
      scorta: false,
      package_size: null,
      stock: 0,
      low_threshold: 0,
    })
  })
})

// ── IL «VERSATO» SENZA CONTENUTO NON SI SALVA ────────────────────────
// Una bottiglia che si versa senza sapere quanto fa: niente costo al cl e
// niente scarico frazionato. Salvare comunque vorrebbe dire un magazzino
// che non scala; meglio fermarsi e spiegare.
describe('il tipo «lo verso nei drink»', () => {
  async function nuovoVersato(user) {
    render(<InventoryManager />)
    await screen.findByText('Campari')
    await user.click(screen.getByRole('button', { name: '+ Nuovo prodotto' }))
    await user.click(screen.getByRole('radio', { name: /Lo verso nei drink/ }))
  }

  it('senza «una bottiglia fa…» il salvataggio si ferma e spiega perché', async () => {
    const user = userEvent.setup()
    createInventoryItem.mockClear()
    await nuovoVersato(user)
    await user.type(screen.getByLabelText('Nome *'), 'Gin Bosford')
    await user.type(screen.getByLabelText(/Costo €\/pz/), '12')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(createInventoryItem).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/quanto fa una bottiglia/i)

    // Scritto il contenuto, passa: 70 cl = 700 ml in base.
    await user.type(screen.getByLabelText(/Una bottiglia fa/), '70')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(createInventoryItem).toHaveBeenCalled())
    expect(createInventoryItem.mock.calls.at(-1)[0]).toMatchObject({
      tipo: 'versato',
      unit: 'pz',
      package_size: 700,
      content_unit: 'ml',
      scorta: true,
    })
  })

  it('in creazione la bottiglia già aperta vale la sua frazione', async () => {
    const user = userEvent.setup()
    await nuovoVersato(user)
    await user.type(screen.getByLabelText('Nome *'), 'Vermut')
    await user.type(screen.getByLabelText(/Una bottiglia fa/), '100')
    await user.type(screen.getByLabelText(/Quantità iniziale \(pezzi\)/), '2')
    await user.type(screen.getByLabelText(/Confezione aperta/), '50')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(createInventoryItem).toHaveBeenCalled())
    // 2 piene + mezza da 100 cl = 2,5 pezzi.
    expect(createInventoryItem.mock.calls.at(-1)[0]).toMatchObject({ stock: 2.5 })
  })
})

// ── «LO VENDO INTERO»: PEZZI, SENZA RESA ─────────────────────────────
// La birra si compra e si serve a bottiglia: il magazzino conta pezzi e
// il contenuto è solo il confronto del costo al cl con le altre.
describe('il tipo «lo vendo intero»', () => {
  async function nuovoIntero(user) {
    render(<InventoryManager />)
    await screen.findByText('Campari')
    await user.click(screen.getByRole('button', { name: '+ Nuovo prodotto' }))
    await user.click(screen.getByRole('radio', { name: /Lo vendo intero/ }))
  }

  it('salva a pezzi, col contenuto solo per il costo al cl', async () => {
    const user = userEvent.setup()
    await nuovoIntero(user)
    await user.type(screen.getByLabelText('Nome *'), 'Ichnusa 33')
    await user.type(screen.getByLabelText(/Costo €\/pz/), '1.2')
    await user.type(screen.getByLabelText(/Dentro c.è/), '33')
    await user.type(screen.getByLabelText(/Quantità iniziale \(pezzi\)/), '24')
    await user.type(screen.getByLabelText(/Soglia di avviso \(pz\)/), '6')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(createInventoryItem).toHaveBeenCalled())
    expect(createInventoryItem.mock.calls.at(-1)[0]).toMatchObject({
      tipo: 'intero',
      unit: 'pz',
      package_size: 330, // 33 cl: serve solo al €/cl di confronto
      content_unit: 'ml',
      resa: null,
      scorta: true,
      stock: 24,
      low_threshold: 6,
    })
  })

  it('e il contenuto si può lasciare vuoto: si dosa a pezzi', async () => {
    const user = userEvent.setup()
    await nuovoIntero(user)
    await user.type(screen.getByLabelText('Nome *'), 'Acqua tonica')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(createInventoryItem).toHaveBeenCalled())
    expect(createInventoryItem.mock.calls.at(-1)[0]).toMatchObject({
      tipo: 'intero',
      unit: 'pz',
      package_size: null,
      content_unit: null,
    })
  })
})

// ── IL GHIACCIO È SFUSO, E SI SCARICA ────────────────────────────────
// Prima andava spiegato con una casella «è una scorta» dentro le unità
// generiche; adesso lo dice il tipo: lo sfuso si scarica sempre, il
// lavoro mai. La casella non esiste più.
describe('sfuso a unità: il ghiaccio', () => {
  it('si compra a U, si scarica, e nessuna casella da capire', async () => {
    const user = userEvent.setup()
    render(<InventoryManager />)
    await screen.findByText('Campari')
    await user.click(screen.getByRole('button', { name: '+ Nuovo prodotto' }))
    await user.click(screen.getByRole('radio', { name: /Sfuso/ }))
    expect(screen.queryByRole('checkbox', { name: /È una scorta/ })).toBeNull()
    await user.selectOptions(screen.getByLabelText('Come lo compri'), 'U')
    await user.type(screen.getByLabelText('Nome *'), 'Ghiaccio a sacchi')
    await user.type(screen.getByLabelText(/Quantità iniziale \(U\)/), '6')
    await user.click(screen.getByRole('button', { name: /^Salva/ }))
    await waitFor(() => expect(createInventoryItem).toHaveBeenCalled())
    expect(createInventoryItem.mock.calls.at(-1)[0]).toMatchObject({
      name: 'Ghiaccio a sacchi',
      tipo: 'sfuso',
      unit: 'U',
      scorta: true,
      stock: 6,
    })
  })
})

// ── IL PREZZO SI SCRIVE COM'È SULLA FATTURA ──────────────────────────
// «2 € al chilo», non «10 € la cassetta da 5». L'etichetta segue il tipo
// e, per lo sfuso, l'unità con cui si compra.
describe('il costo segue come si compra', () => {
  async function apri(user) {
    render(<InventoryManager />)
    await screen.findByText('Campari')
    await user.click(screen.getByRole('button', { name: '+ Nuovo prodotto' }))
  }

  it('l’etichetta cambia col tipo e con l’unità dello sfuso', async () => {
    const user = userEvent.setup()
    await apri(user)
    await user.click(screen.getByRole('radio', { name: /Lo vendo intero/ }))
    expect(screen.getByLabelText(/Costo €\/pz/)).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Sfuso/ }))
    expect(screen.getByLabelText(/Costo €\/kg/)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Come lo compri'), 'cl')
    expect(screen.getByLabelText(/Costo €\/cl/)).toBeInTheDocument()
  })

  it('per lo sfuso una confezione è una unità', async () => {
    // Non si chiede quanto contiene una confezione: comprando a cl, la
    // confezione È un cl. Il prezzo scritto vale per quello.
    const user = userEvent.setup()
    await apri(user)
    await user.click(screen.getByRole('radio', { name: /Sfuso/ }))
    expect(screen.queryByLabelText(/Quanto contiene una confezione/)).toBeNull()
    await user.selectOptions(screen.getByLabelText('Come lo compri'), 'cl')
    await user.type(screen.getByLabelText('Nome *'), 'Gin sfuso')
    await user.type(screen.getByLabelText(/Costo €\/cl/), '0.2')
    await user.click(screen.getByRole('button', { name: /^Salva/ }))
    await waitFor(() => expect(createInventoryItem).toHaveBeenCalled())
    expect(createInventoryItem.mock.calls.at(-1)[0]).toMatchObject({
      name: 'Gin sfuso',
      cost: 0.2,
      package_size: 10, // un cl, in unità base
    })
  })
})

// ── UNA SCHEDA VECCHIA SI RIAPRE NEL TIPO GIUSTO ─────────────────────
// I prodotti salvati prima delle card non hanno il campo `tipo`: si
// deduce da com'erano configurati, senza nessuna migrazione. Le quattro
// regole: U non-scorta è lavoro, U con scorta è sfuso, pezzo con
// contenuto è versato, pezzo senza è intero.
describe('un prodotto esistente si riapre nel suo tipo', () => {
  async function apriModifica(user, nome) {
    render(<InventoryManager />)
    await screen.findByText('Campari')
    await user.click(screen.getByRole('button', { name: new RegExp(nome) }))
    await user.click(screen.getByRole('button', { name: '✏️ Modifica' }))
  }

  it.each([
    ['Campari', 'Lo verso nei drink'], // pz con contenuto
    ['Ichnusa', 'Lo vendo intero'], // pz senza contenuto
    ['Ghiaccio', 'Sfuso, a peso o volume'], // U ma scorta: si scarica
    ['Tempo di Lavorazione', 'Lavoro o servizio'], // U non scorta
  ])('%s si riapre come «%s»', async (nome, titolo) => {
    const user = userEvent.setup()
    await apriModifica(user, nome)
    expect(screen.getByRole('radio', { name: new RegExp(titolo) })).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })
})

// ── IL CARICO A COLLI È UN'ECCEZIONE ─────────────────────────────────
// Chi carica due bottiglie prese dal fornitore sotto casa non ha nessun
// cartone da dichiarare: i campi del collo stavano sempre a vista, in fondo
// e dentro il riquadro del prezzo, e la quantità andava scritta a mano
// sperando che il conto tornasse.
describe('carico: il collo dietro un interruttore', () => {
  // Il tasto «Carico» sta nel dettaglio del prodotto: prima si apre la riga.
  async function apriCarico(user) {
    render(<InventoryManager />)
    await user.click(await screen.findByText('Campari'))
    await user.click(await screen.findByRole('button', { name: /Carico/ }))
  }

  it('di suo non si vede: si scrivono i pezzi e basta', async () => {
    const user = userEvent.setup()
    await apriCarico(user)
    expect(screen.getByRole('checkbox', { name: /Carico a colli/ })).not.toBeChecked()
    expect(screen.queryByLabelText(/per collo/)).toBeNull()
    expect(screen.getByLabelText(/Quanti pezzi aggiungi/)).not.toHaveAttribute('readonly')
  })

  it('acceso, il collo sta SOPRA e i pezzi si contano da soli', async () => {
    const user = userEvent.setup()
    await apriCarico(user)
    await user.click(screen.getByRole('checkbox', { name: /Carico a colli/ }))

    const perCollo = screen.getByLabelText(/Pezzi per collo/)
    const colli = screen.getByLabelText(/Quanti colli arrivano/)
    // Il riquadro del collo viene prima della quantità, che è l'ordine in cui
    // si guarda il cartone.
    const pezzi = screen.getByLabelText(/Quanti pezzi aggiungi/)
    expect(perCollo.compareDocumentPosition(pezzi) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.type(perCollo, '24')
    await user.type(colli, '2')
    expect(pezzi).toHaveValue(48)
    // E non si corregge a mano: sarebbe un numero che non torna con quello
    // che è arrivato.
    expect(pezzi).toHaveAttribute('readonly')
  })
})

// ── «CINQUE CHILI DI LIMONI FANNO UN LITRO E MEZZO» ──────────────────
// Si scrive come si dice, con la quantità su tutti e due i lati. Sotto
// resta un rapporto, ed è quello che usa lo scarico: la proporzione vale
// per qualunque quantità si versi.
describe('la resa dello sfuso si scrive con le quantità sui due lati', () => {
  it('5 kg fanno 1,5 l diventa il rapporto giusto, e il carico resta in chili', async () => {
    const user = userEvent.setup()
    render(<InventoryManager />)
    await screen.findByText('Campari')
    await user.click(screen.getByRole('button', { name: '+ Nuovo prodotto' }))
    await user.click(screen.getByRole('radio', { name: /Sfuso/ }))
    await user.type(screen.getByLabelText('Nome *'), 'Limoni')
    // «Come lo compri» parte già dal chilo: è il caso dei limoni.
    expect(screen.getByLabelText('Come lo compri')).toHaveValue('kg')

    const daQty = screen.getByLabelText('Quanto ne prendi')
    await user.clear(daQty)
    await user.type(daQty, '5')
    await user.type(screen.getByLabelText(/Si usa in un.altra misura/), '1.5')
    await user.selectOptions(screen.getByLabelText(/Unità d.uso/), 'l')
    await user.click(screen.getByRole('button', { name: /^Salva/ }))

    await waitFor(() => expect(createInventoryItem).toHaveBeenCalled())
    const salvato = createInventoryItem.mock.calls.at(-1)[0]
    // 1500 ml ogni 5000 g = 0,3 ml per grammo.
    expect(salvato.tipo).toBe('sfuso')
    expect(salvato.resa).toBeCloseTo(0.3, 6)
    expect(salvato.resa_unit).toBe('ml')
    expect(salvato.unit).toBe('g') // la giacenza resta quella che si compra
  })
})

// ── IL CONTENUTO DI UN PEZZO NON È LA DOSE DEL DRINK ─────────────────
// La domanda si legge facilmente per un'altra — «quanto ne va in un
// drink?» — e quella la decide la ricetta. Chi le confonde riempie il campo
// con la dose di un cocktail e scarica il magazzino con numeri sbagliati.
// Il «?» resta accanto al contenuto per i tipi a pezzo (intero e versato).
describe('il contenuto di un pezzo, spiegato', () => {
  it('la didascalia dice a cosa serve, e il «?» distingue contenuto e dose', async () => {
    const user = userEvent.setup()
    render(<InventoryManager />)
    await screen.findByText('Campari')
    await user.click(screen.getByRole('button', { name: '+ Nuovo prodotto' }))
    await user.click(screen.getByRole('radio', { name: /Lo vendo intero/ }))

    expect(screen.getByText(/si vende intero e il magazzino conta pezzi/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Come funziona il contenuto di un pezzo/ }))
    const box = await screen.findByRole('dialog', { name: /A quanto corrisponde un pezzo/ })
    expect(within(box).getByText(/Se lo lasci vuoto/)).toBeInTheDocument()
    expect(within(box).getByText(/solo a pezzi/)).toBeInTheDocument()
  })
})

// ── «QUANTE NE HO?» È LA PRIMA DOMANDA ───────────────────────────────
// Aprendo un prodotto si leggevano soglia, costo e prezzo consigliato, ma
// non la giacenza — che è la cosa per cui lo si apre.
describe('il dettaglio del prodotto dice quanto ce n’è', () => {
  it('quanto ce n’è è la prima riga', async () => {
    const user = userEvent.setup()
    render(<InventoryManager />)
    await user.click(await screen.findByText('Campari'))
    // Dove si conta a pezzi lo dice la riga «Pezzi», che è più precisa
    // (quante piene, quella aperta, quanto fa una): una riga «Giacenza»
    // sopra direbbe lo stesso numero due volte.
    const prima = document.querySelector('.inv-info .inv-info-row')
    expect(prima.textContent).toMatch(/^(Pezzi|Giacenza)/)
    expect(prima.textContent).toMatch(/[\d.,]+\s*(pz|cl|ml|L|g|kg|U)/)
  })
})
