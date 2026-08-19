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
// Tutto si conta a PEZZI (REQ-MAG-016) e il contenuto dice a quanto
// corrisponde un pezzo: è la forma in cui gli articoli arrivano dalle api,
// che rimettono in riga anche quelli scritti alla vecchia maniera.
const ITEMS = [
  {
    id: 'i1',
    name: 'Gin Mare',
    unit: 'pz',
    package_size: 1000, // bottiglia da 100 cl…
    content_unit: 'ml',
    stock: 0.5, // …piena a metà → 0,5 pz
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
    unit: 'pz',
    package_size: 700,
    content_unit: 'ml',
    stock: 2.5, // 2 piene + mezza → 2,5 pz
    category_id: 'c1',
    supplier_id: 's2',
    cost: 30,
    vat: 22,
    status: 'premium',
  },
  {
    id: 'i3',
    name: 'Vodka Vecchia',
    unit: 'pz',
    package_size: 700,
    content_unit: 'ml',
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
  // «Distillati» sta in una macro, ALTRO no — ed è una scelta, non una
  // dimenticanza: è il caso che REQ-UI-022 deve far vedere a colpo d'occhio.
  { id: 'c1', name: 'Distillati', sort_order: 0, macro_id: 'mag1' },
  { id: 'c2', name: 'ALTRO', sort_order: 1 },
]
const MACRO_MAG = [{ id: 'mag1', name: 'Alcolici', sort_order: 0 }]
const SUPS = [
  { id: 's1', name: 'NOVA' },
  { id: 's2', name: 'ENOFEL' },
]

// Quello che la serata sta facendo, quando serve: cassa aperta, conti in
// corso, listino. Di suo il locale è chiuso e non c'è niente in ballo.
const stato = { cassa: null, ordini: [], drinks: [] }

// La cassa aperta la tiene un modulo solo per tutta l'app (una
// sottoscrizione sola, vedi lib/cashSession.js): fra un test e l'altro
// resterebbe quella del primo. Qui la si legge di volta in volta.
vi.mock('../../src/lib/cashSession.js', () => ({
  useCashSession: () => ({ session: stato.cassa, open: !!stato.cassa, loading: false }),
}))

vi.mock('../../src/lib/api.js', () => ({
  fetchInventoryItems: vi.fn(async () => ITEMS),
  fetchInventoryCategories: vi.fn(async () => CATS),
  fetchSuppliers: vi.fn(async () => SUPS),
  fetchStockMovements: vi.fn(async () => []),
  fetchMacroCategories: vi.fn(async (ambito) => (ambito === 'magazzino' ? MACRO_MAG : [])),
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
  // La colonna «a fine serata» (REQ-MAG-014) guarda la cassa aperta, i
  // conti in corso e il listino: il test le decide di volta in volta.
  subscribeOpenCashSession: vi.fn((cb) => {
    cb(stato.cassa)
    return () => {}
  }),
  subscribeActiveOrders: vi.fn((cb) => {
    cb(stato.ordini)
    return () => {}
  }),
  subscribeDrinks: vi.fn((_opts, cb) => {
    cb(stato.drinks)
    return () => {}
  }),
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

beforeEach(() => {
  vi.clearAllMocks()
  stato.cassa = null
  stato.ordini = []
  stato.drinks = []
})

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

  it('«In scorta» lascia quello che c’è, esaurimento compreso', async () => {
    // Mancava la domanda più ovvia di tutte: al banco c'erano 232 esauriti
    // su 388, e per vedere cosa c'era davvero bisognava guardare «Tutti» e
    // saltare a occhio due terzi di righe.
    const user = userEvent.setup()
    mostra()
    await aspettaLista()
    await user.click(screen.getByRole('button', { name: /⚗️ Filtra/ }))
    const voce = screen.getByRole('button', { name: /In scorta/ })
    // Il conteggio c'è come sulle altre voci: Gin Mare, Rum e Ichnusa.
    expect(voce).toHaveTextContent('3')
    await user.click(voce)
    expect(screen.getByText('Gin Mare')).toBeInTheDocument()
    expect(screen.queryByText('Vodka Vecchia')).toBeNull()
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

// ── QUELLO CHE TI RITROVI A FINE SERATA (REQ-MAG-014) ────────────────
//
// A metà serata, sui tavoli, ci sono drink già fatti e conti non ancora
// chiusi: quel gin è promesso anche se il magazzino non l'ha ancora
// scalato. Chi guarda le scorte per decidere se mandare qualcuno a
// prendere una bottiglia deve vedere quello, non la giacenza di questo
// istante.
describe('la colonna «a fine serata» (REQ-MAG-014)', () => {
  const cassaAperta = { id: 'cassa-1', opened_at: '2026-08-17T18:00:00.000Z' }
  const negroni = {
    id: 'negroni',
    name: 'Negroni',
    recipe_items: [{ inventory_item_id: 'i1', name: 'Gin Mare', unit: 'ml', qty: 250 }],
  }
  const contoAperto = {
    id: 'o1',
    status: 'aperto',
    payment_status: 'non_richiesto',
    comande: [
      { id: 'c1', status: 'ricevuto', items: [{ drink_id: 'negroni', qty: 1 }] },
    ],
  }

  it('a cassa chiusa non c’è: non c’è una serata di cui dire come finirà', async () => {
    mostra()
    await aspettaLista()
    expect(screen.queryByRole('button', { name: /A fine serata/i })).toBeNull()
  })

  it('coi conti aperti compare, e toglie quello che è già promesso', async () => {
    stato.cassa = cassaAperta
    stato.drinks = [negroni]
    stato.ordini = [contoAperto]
    mostra()
    await aspettaLista()
    // Il Gin Mare ha mezza bottiglia (0,5 pz da 100 cl): un Negroni ne
    // impegna 250 ml, cioè un quarto di bottiglia → resta 0,25 pz.
    expect(await screen.findByRole('button', { name: /A fine serata/i })).toBeInTheDocument()
    const riga = screen.getByText('Gin Mare').closest('.inv-row')
    expect(within(riga).getByText('0,25 pz')).toBeInTheDocument()
  })

  it('i prodotti che nessuno ha chiesto restano com’erano', async () => {
    stato.cassa = cassaAperta
    stato.drinks = [negroni]
    stato.ordini = [contoAperto]
    mostra()
    await aspettaLista()
    // Il Rum non è in quel drink: la sua previsione è un trattino, non un
    // numero inventato.
    const riga = screen.getByText('Rum Diplomatico').closest('.inv-row')
    expect(within(riga).getByText('—')).toBeInTheDocument()
  })
})

// ── I NUMERI SI SCRIVONO COME LI SI PENSA (REQ-MAG-013) ──────────────
//
// «Avvisami quando resta una bottiglia» è il modo in cui la domanda si fa al
// banco: nessuno la pensa in 700 ml. La soglia non ha più una tendina per
// l'unità, e dal 1.5 non ha nemmeno più un'unità che cambia: si conta a
// PEZZI come la giacenza (REQ-MAG-016), perché il pezzo è quello che si va a
// ricomprare.
describe('le unità nel modulo del prodotto (REQ-MAG-013)', () => {
  it('la soglia si scrive in pezzi, e non si sceglie', async () => {
    const user = userEvent.setup()
    mostra()
    await aspettaLista()
    await user.click(screen.getByRole('button', { name: /Nuovo prodotto/ }))
    expect(screen.getByLabelText(/Soglia di avviso \(pz\)/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Unità della soglia di avviso')).toBeNull()
    // E non c'è nessuna domanda prima: né il tipo di prodotto né l'unità
    // d'acquisto: il costo è già lì, al pezzo.
    expect(screen.queryByLabelText('Come lo compri')).toBeNull()
    expect(screen.getByLabelText(/Costo €\/pz/)).toBeInTheDocument()
  })
})

// ── LE CATEGORIE SENZA MACRO SI VEDONO A COLPO D'OCCHIO (REQ-UI-022) ──
// ALTRO resta fuori dalle macro ed è una scelta: non si forza dentro un
// gruppo per far tornare un elenco. Da lì nasce il bisogno opposto — una
// categoria fuori APPOSTA e una dimenticata si somigliavano troppo, e
// questo elenco è proprio quello da cui si esce convinti di aver sistemato
// tutto. Prima mostrava il solo nome.
describe('la macro di ogni categoria, nell’elenco delle categorie', () => {
  it('accanto al nome c’è il suo gruppo, e dove manca lo dice', async () => {
    const user = userEvent.setup()
    mostra()
    await aspettaLista()
    await user.click(screen.getByRole('button', { name: /Categorie/ }))
    const distillati = (await screen.findByText('Distillati')).closest('.row')
    expect(within(distillati).getByText('Alcolici')).toBeInTheDocument()
    const altro = screen.getByText('ALTRO').closest('.row')
    expect(within(altro).getByText('senza macro')).toBeInTheDocument()
  })
})
