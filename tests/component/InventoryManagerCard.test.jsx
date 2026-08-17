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
    await user.click(screen.getByRole('button', { name: '⋯ Azioni' }))
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
    const misura = screen.getByLabelText(/Unità d.acquisto/)
    expect([...misura.options].map((o) => o.value)).toContain('U')
  })

  it('scelto il generico non si chiede un contenuto che non c’è', async () => {
    const user = userEvent.setup()
    render(<InventoryManager />)
    await nuovoProdotto(user)
    await user.selectOptions(screen.getByLabelText(/Unità d.acquisto/), 'U')
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
    await user.selectOptions(screen.getByLabelText(/Unità d.acquisto/), 'U')
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

// ── LE TRE DOMANDE, E IL «?» CHE LE SPIEGA ───────────────────────────
// La scheda decide come si scala il magazzino e quanto costa un drink: chi
// la compila la prima volta non deve indovinare cosa vogliono dire le
// domande. Vedi REQ-MAG-016.
describe('la scheda prodotto chiede tre cose', () => {
  async function apriForm(user) {
    render(<InventoryManager />)
    await screen.findByText('Campari')
    await user.click(screen.getByRole('button', { name: '+ Nuovo prodotto' }))
  }

  it('«come lo compri» e «come lo usi», con il tasto che le spiega', async () => {
    const user = userEvent.setup()
    await apriForm(user)
    expect(screen.getByText('Come lo compri')).toBeInTheDocument()
    expect(screen.getByLabelText(/Unità d.acquisto/)).toBeInTheDocument()
    expect(screen.getByText('Come lo usi in ricetta')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Come si compila/ }))
    const box = await screen.findByRole('dialog', { name: /Come si compila/ })
    expect(within(box).getByText(/1 kg di limoni = 50 cl/)).toBeInTheDocument()
    expect(within(box).getByText(/Unità generiche/)).toBeInTheDocument()
  })

  it('la terza domanda — quanto rende — c’è per chi non si conta a pezzi', async () => {
    const user = userEvent.setup()
    await apriForm(user)
    // La risposta è già data: quasi tutti i prodotti si usano come si
    // comprano, e a quelli non si chiede niente.
    const interruttore = screen.getByRole('checkbox', { name: /Lo uso come lo compro/ })
    expect(interruttore).toBeChecked()
    expect(screen.queryByLabelText('Quanto rende')).toBeNull()
    // Spegnendolo compare la resa, e nient'altro.
    await user.click(interruttore)
    expect(screen.getByLabelText('Quanto rende')).toBeInTheDocument()
    // Anche sui pezzi c'è, ed è acceso: la birra si compra e si serve a
    // bottiglia. Spegnendolo si dice a quanto corrisponde un pezzo — è così
    // che l'Aperol, comprato a bottiglia, si versa in cl.
    await user.selectOptions(screen.getByLabelText(/Unità d.acquisto/), 'pz')
    const suiPezzi = screen.getByRole('checkbox', { name: /Lo uso come lo compro/ })
    expect(suiPezzi).toBeChecked()
    expect(screen.queryByLabelText(/A quanto corrisponde un pezzo/)).toBeNull()
    await user.click(suiPezzi)
    expect(screen.getByLabelText(/A quanto corrisponde un pezzo/)).toBeInTheDocument()
    // E l'unità d'uso si sceglie fra tutte, non solo dentro la sua famiglia.
    const unita = screen.getByLabelText('Unità del contenuto')
    expect([...unita.options].map((o) => o.value)).toEqual(
      expect.arrayContaining(['l', 'cl', 'ml', 'kg', 'g', 'mg', 'U'])
    )
  })
})

// ── NON TUTTO QUELLO CHE SI CONTA A UNITÀ È MANODOPERA ───────────────
// Il tempo di lavoro non sta su nessuno scaffale; il ghiaccio si conta a
// unità uguale, ma a mezzanotte è finito. La differenza la sa chi carica il
// prodotto, non l'app.
describe('a unità, ma è una scorta', () => {
  async function apri(user) {
    render(<InventoryManager />)
    await screen.findByText('Campari')
    await user.click(screen.getByRole('button', { name: '+ Nuovo prodotto' }))
    await user.selectOptions(screen.getByLabelText(/Unità d.acquisto/), 'U')
  }

  it('la domanda compare solo per le unità generiche, e di suo è spenta', async () => {
    const user = userEvent.setup()
    render(<InventoryManager />)
    await screen.findByText('Campari')
    await user.click(screen.getByRole('button', { name: '+ Nuovo prodotto' }))
    // Un liquido è una scorta e basta: non gli si chiede.
    expect(screen.queryByRole('checkbox', { name: /È una scorta/ })).toBeNull()
    await user.selectOptions(screen.getByLabelText(/Unità d.acquisto/), 'U')
    expect(screen.getByRole('checkbox', { name: /È una scorta/ })).not.toBeChecked()
  })

  it('accendendola, il prodotto si salva come scorta', async () => {
    const user = userEvent.setup()
    await apri(user)
    await user.type(screen.getByLabelText('Nome *'), 'Ghiaccio')
    await user.click(screen.getByRole('checkbox', { name: /È una scorta/ }))
    await user.click(screen.getByRole('button', { name: /^Salva/ }))
    await waitFor(() => expect(createInventoryItem).toHaveBeenCalled())
    expect(createInventoryItem.mock.calls.at(-1)[0]).toMatchObject({
      name: 'Ghiaccio',
      unit: 'U',
      scorta: true,
    })
  })
})

// ── IL PREZZO SI SCRIVE COM'È SULLA FATTURA ──────────────────────────
// «2 € al chilo», non «10 € la cassetta da 5». L'etichetta diceva sempre
// «€/pz» anche per un prodotto comprato a chili, e chi scriveva il numero
// non sapeva a cosa si riferiva.
describe('il costo segue l’unità d’acquisto', () => {
  async function apri(user) {
    render(<InventoryManager />)
    await screen.findByText('Campari')
    await user.click(screen.getByRole('button', { name: '+ Nuovo prodotto' }))
  }

  it('l’etichetta cambia con l’unità scelta', async () => {
    const user = userEvent.setup()
    await apri(user)
    expect(screen.getByLabelText(/Costo €\/cl/)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/Unità d.acquisto/), 'pz')
    expect(screen.getByLabelText(/Costo €\/pz/)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/Unità d.acquisto/), 'g')
    expect(screen.getByLabelText(/Costo €\/g/)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/Unità d.acquisto/), 'U')
    expect(screen.getByLabelText(/Costo €\/U/)).toBeInTheDocument()
  })

  it('per chi non conta a pezzi, una confezione è una unità', async () => {
    // Non si chiede più quanto contiene una confezione: comprando a cl, la
    // confezione È un cl. Il prezzo scritto vale per quello.
    const user = userEvent.setup()
    await apri(user)
    expect(screen.queryByLabelText(/Quanto contiene una confezione/)).toBeNull()
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
// Si scrive come si dice, con la quantità su tutte e due i lati. Sotto
// resta un rapporto, ed è quello che usa lo scarico: la proporzione vale
// per qualunque quantità si versi.
describe('la resa si scrive con le quantità di tutti e due i lati', () => {
  it('5 kg → 1,5 l diventa il rapporto giusto, e il carico resta in chili', async () => {
    const user = userEvent.setup()
    render(<InventoryManager />)
    await screen.findByText('Campari')
    await user.click(screen.getByRole('button', { name: '+ Nuovo prodotto' }))
    await user.type(screen.getByLabelText('Nome *'), 'Limoni')
    await user.selectOptions(screen.getByLabelText(/Unità d.acquisto/), 'kg')
    await user.click(screen.getByRole('checkbox', { name: /Lo uso come lo compro/ }))

    const daQty = screen.getByLabelText('Quanto ne prendi')
    await user.clear(daQty)
    await user.type(daQty, '5')
    await user.type(screen.getByLabelText('Quanto rende'), '1.5')
    await user.selectOptions(screen.getByLabelText(/Unità d.uso/), 'l')
    await user.click(screen.getByRole('button', { name: /^Salva/ }))

    await waitFor(() => expect(createInventoryItem).toHaveBeenCalled())
    const salvato = createInventoryItem.mock.calls.at(-1)[0]
    // 1500 ml ogni 5000 g = 0,3 ml per grammo.
    expect(salvato.resa).toBeCloseTo(0.3, 6)
    expect(salvato.resa_unit).toBe('ml')
    expect(salvato.unit).toBe('g') // la giacenza resta quella che si compra
  })
})

// ── «A QUANTO CORRISPONDE UN PEZZO» NON È LA DOSE DEL DRINK ──────────
// La domanda si legge facilmente per un'altra — «quanto ne va in un
// drink?» — e quella la decide la ricetta. Chi le confonde riempie il campo
// con la dose di un cocktail e scarica il magazzino con numeri sbagliati.
describe('il contenuto di un pezzo, spiegato', () => {
  it('la didascalia dice che si può lasciare vuoto, e il «?» spiega il resto', async () => {
    const user = userEvent.setup()
    render(<InventoryManager />)
    await screen.findByText('Campari')
    await user.click(screen.getByRole('button', { name: '+ Nuovo prodotto' }))
    await user.selectOptions(screen.getByLabelText(/Unità d.acquisto/), 'pz')
    await user.click(screen.getByRole('checkbox', { name: /Lo uso come lo compro/ }))

    expect(
      screen.getByText(/da lasciare vuoto per decidere la quantità direttamente nella ricetta/)
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Come funziona «a quanto corrisponde un pezzo»/ }))
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
