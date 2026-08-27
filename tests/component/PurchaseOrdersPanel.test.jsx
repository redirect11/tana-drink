// @vitest-environment happy-dom
'use strict'

// ── LA SCHERMATA DEGLI ORDINI FORNITORE (REQ-MAG-029) ────────────────
//
// Flavio l'ha provata il 26/08/2026 e si è fermato subito: «quel prodotto —
// ad esempio il Campari — deve essere associato a quel fornitore, e io
// questo non lo posso fare CATEGORICAMENTE: è quasi sicuro che il Campari lo
// prendo anche da fornitori differenti». E: «sarebbe buono se avesse il
// campetto di ricerca, in modo tale che io posso mettere il prodotto
// INDIPENDENTEMENTE da quale fornitore resta associato».
//
// La schermata di prima chiedeva PRIMA il fornitore: scegliendo Nova se ne
// vedevano tre prodotti su 388, perché il legame prodotto-fornitore in
// magazzino quasi non esiste. Qui si sorveglia che non ci si torni.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const NOVA = { id: 'nova', name: 'Nova', email: 'ordini@nova.it', color: '#e74c3c' }
const ENOFEL = { id: 'enofel', name: 'Enofel', email: 'ordini@enofel.it', color: '#3498db' }

const ARTICOLI = [
  { id: 'campari', name: 'Campari', unit: 'pz', stock: 2, package_size: 700, content_unit: 'ml', cost: 12, vat: 22, kind: 'scorta', status: 'linea' },
  { id: 'gin', name: 'Gin Mare', unit: 'pz', stock: 5, package_size: 700, content_unit: 'ml', cost: 30, vat: 22, kind: 'scorta', status: 'assortimento' },
]

// Il Campari sta sul listino di tutti e due, a prezzi diversi: è il caso da
// cui nasce tutta questa voce.
const LISTINI = [
  { id: 'nova__campari', supplier_id: 'nova', item_id: 'campari', price: 12.5, last_price_at: '2026-08-01T10:00:00.000Z' },
  { id: 'enofel__campari', supplier_id: 'enofel', item_id: 'campari', price: 11.9, last_price_at: '2024-02-01T10:00:00.000Z' },
]

const stato = { ordini: [], listini: LISTINI, fatture: [] }

vi.mock('../../src/lib/api.js', () => ({
  fetchInventoryItems: vi.fn(async () => ARTICOLI),
  fetchSuppliers: vi.fn(async () => [NOVA, ENOFEL]),
  fetchSupplierPrices: vi.fn(async () => stato.listini),
  fetchPurchaseOrders: vi.fn(async () => stato.ordini),
  createPurchaseOrder: vi.fn(async (o) => ({ id: 'po-nuovo', created_at: '2026-08-26T09:00:00.000Z', status: 'inviato', ...o })),
  consegnaRigheOrdine: vi.fn(async (id) => ({ ...stato.ordini[0], id })),
  segnaRighePagate: vi.fn(async (id) => ({ ...stato.ordini[0], id })),
  deletePurchaseOrder: vi.fn(async () => {}),
  // Lo storico dice, fetta per fetta, se la fattura c'è (REQ-MAG-031).
  fetchSupplierInvoices: vi.fn(async () => stato.fatture),
  collegaFatturaAFetta: vi.fn(async (id, { order_id }) => ({
    ...stato.fatture.find((f) => f.id === id),
    order_id: order_id || null,
  })),
}))

vi.mock('../../src/lib/printer.js', () => ({ printOrdineFornitore: vi.fn(async () => {}) }))
vi.mock('../../src/lib/toast.js', () => ({ toastSuccess: vi.fn(), toastError: vi.fn() }))

import PurchaseOrdersPanel from '../../src/components/PurchaseOrdersPanel.jsx'
import {
  createPurchaseOrder as creato,
  consegnaRigheOrdine as consegnato,
} from '../../src/lib/api.js'

const catalogo = () => screen.getByLabelText('Cerca un prodotto').closest('.card')

beforeEach(() => {
  vi.clearAllMocks()
  stato.ordini = []
  stato.listini = LISTINI
  stato.fatture = []
})

describe('si parte dal prodotto, non dal fornitore', () => {
  it('la ricerca c’è, e trova il prodotto senza aver scelto nessun fornitore', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrdersPanel />)
    await screen.findAllByText('Campari')
    // Nessun fornitore scelto: si vede tutto il magazzino ordinabile.
    expect(screen.getByText('Gin Mare')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Cerca un prodotto'), 'campa')
    await waitFor(() => expect(screen.queryByText('Gin Mare')).toBeNull())
    expect(screen.getAllByText('Campari').length).toBeGreaterThan(0)
  })

  // «Facciamo una tabella con tutta la lista di prodotti, anche se sono
  // duplicati, e li distinguiamo per fornitore» (Flavio).
  it('senza filtro il Campari compare una volta per fornitore', async () => {
    render(<PurchaseOrdersPanel />)
    await screen.findAllByText('Campari')
    expect(screen.getAllByText('Campari')).toHaveLength(2)
    // Le due righe si distinguono dal fornitore, che sta sulla riga stessa.
    expect(screen.getByLabelText('Fornitore per Campari (Nova)')).toHaveValue('nova')
    expect(screen.getByLabelText('Fornitore per Campari (Enofel)')).toHaveValue('enofel')
  })

  // «Quando Flavio seleziona un fornitore vedrà solamente la lista dei
  // prodotti ordinabili da quel fornitore».
  it('col filtro si vede il catalogo di quel fornitore, e basta', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrdersPanel />)
    await screen.findAllByText('Campari')
    await user.selectOptions(screen.getByLabelText('Filtra per fornitore'), 'nova')
    await waitFor(() => expect(screen.getAllByText('Campari')).toHaveLength(1))
    // Il Gin non sta sul listino di Nova: non si ordina da lui.
    expect(screen.queryByText('Gin Mare')).toBeNull()
  })

  // Il fornitore proposto è quello dell'ULTIMO ACQUISTO; il più economico si
  // MOSTRA, perché il prezzo più basso in archivio è quasi sempre il più
  // vecchio — nessuno aggiorna al rialzo un fornitore da cui non compra più.
  //
  // DA REQ-MAG-036 I DUE SUGGERIMENTI STANNO NELLA SCHEDA DELLA RIGA, non
  // accanto al nome: la riga è diventata una riga di tabella, con otto
  // colonne, e la scheda è dove si guarda un prodotto prima di decidere.
  it('la scheda dice qual è l’ultimo acquisto e qual è il più economico', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrdersPanel />)
    await screen.findAllByText('Campari')
    await user.click(screen.getByRole('button', { name: 'Apri la scheda di Campari (Nova)' }))
    const scheda = document.querySelector('.inv-row-dettaglio')
    expect(scheda).toHaveTextContent(/ultimo acquisto Nova/)
    expect(scheda).toHaveTextContent(/più economico Enofel/)
  })

  // La schermata deve reggere anche con ZERO listini: sono da compilare a
  // mano, e nessuno ha ancora cominciato.
  it('con zero listini i prodotti si vedono lo stesso', async () => {
    stato.listini = []
    render(<PurchaseOrdersPanel />)
    await screen.findByText('Campari')
    expect(screen.getByText('Gin Mare')).toBeInTheDocument()
    expect(within(catalogo()).getAllByText(/senza fornitore/).length).toBe(2)
  })
})

// DA REQ-MAG-036 L'ORDINE SI COMPONE SULLA RIGA: niente più tasto
// «Aggiungi» e lista sotto — «non mi piace la doppia lista» — ma quantità e
// fornitore scritti sulla riga della tabella. La regola di REQ-MAG-029 non
// cambia: un ordine solo può contenere prodotti di più fornitori, e il
// prezzo è quello del listino di chi vende. Il fornitore già usato che si
// spegne nella tendina è passato ai test della schermata nuova
// (tests/component/NuovoOrdineTabella.test.jsx).
describe('l’ordine si compone, col fornitore sulla riga', () => {
  it('un ordine solo può contenere prodotti di più fornitori', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrdersPanel />)
    await screen.findAllByText('Campari')
    // Si scrive sulla riga del Campari di Nova, non su una a caso: sono due,
    // e l'ordine dipende da chi vende.
    await user.type(screen.getByLabelText('Pezzi di Campari (Nova)'), '6')
    await user.type(screen.getByLabelText('Pezzi di Gin Mare (senza fornitore)'), '2')
    // Il Gin non ha fornitore: si sceglie sulla riga.
    await user.selectOptions(screen.getByLabelText('Fornitore per Gin Mare (senza fornitore)'), 'enofel')
    await user.click(screen.getByRole('button', { name: /Salva ordine/ }))

    await waitFor(() => expect(creato).toHaveBeenCalled())
    const righe = creato.mock.calls.at(-1)[0].lines
    expect(righe.map((l) => [l.item_id, l.supplier_id])).toEqual([
      ['campari', 'nova'],
      ['gin', 'enofel'],
    ])
    // Il prezzo è quello del listino DI QUEL FORNITORE.
    expect(righe[0].unit_cost).toBe(12.5)
  })
})

describe('lo storico va per FETTA di fornitore', () => {
  const ORDINE = {
    id: 'po-1',
    created_at: '2026-08-26T09:00:00.000Z',
    status: 'inviato',
    total_net: 95,
    total_gross: 115.9,
    lines: [
      { item_id: 'campari', name: 'Campari', qty_packages: 6, unit_cost: 12.5, vat: 22, supplier_id: 'nova', stato: 'richiesto' },
      { item_id: 'gin', name: 'Gin Mare', qty_packages: 1, unit_cost: 20, vat: 22, supplier_id: 'enofel', stato: 'richiesto' },
    ],
  }

  beforeEach(() => {
    stato.ordini = [ORDINE]
  })

  // Mandare a Nova anche le righe di Enofel è un errore verso il fornitore,
  // non un dettaglio grafico.
  it('ogni fornitore ha la sua riga, con le sue sole voci', async () => {
    render(<PurchaseOrdersPanel />)
    const storico = (await screen.findByText('Storico ordini')).closest('.card')
    expect(within(storico).getByText('Nova')).toBeInTheDocument()
    expect(within(storico).getByText('Enofel')).toBeInTheDocument()
    expect(within(storico).getByText('6× Campari')).toBeInTheDocument()
    expect(within(storico).getByText('1× Gin Mare')).toBeInTheDocument()
  })

  it('l’email parte con l’indirizzo di quel fornitore e le sue righe', async () => {
    const user = userEvent.setup()
    // `window.location.href` non si può assegnare in happy-dom: si guarda
    // cosa la schermata avrebbe aperto.
    const aperto = []
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { set href(v) { aperto.push(v) } },
    })
    render(<PurchaseOrdersPanel />)
    const storico = (await screen.findByText('Storico ordini')).closest('.card')
    await user.click(within(storico).getByRole('button', { name: 'Invia a Nova' }))
    expect(aperto).toHaveLength(1)
    const testo = decodeURIComponent(aperto[0])
    expect(testo).toMatch(/ordini@nova\.it/)
    expect(testo).toMatch(/Campari/)
    // Le righe dell'altro fornitore NON ci sono.
    expect(testo).not.toMatch(/Gin Mare/)
  })

  // IL CARICO AVVIENE AL PASSAGGIO A CONSEGNATO, e per la sola fetta
  // arrivata: i fornitori consegnano in giorni diversi.
  it('«Consegnato» carica solo le righe di quel fornitore, coi prezzi corretti', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrdersPanel />)
    const storico = (await screen.findByText('Storico ordini')).closest('.card')
    const rigaNova = within(storico).getByText('Nova').closest('.inv-row')
    await user.click(within(rigaNova).getByRole('button', { name: /Consegnato/ }))

    // La finestra della consegna: si correggono i PREZZI, non il fornitore.
    const prezzo = await screen.findByLabelText('Prezzo di Campari')
    expect(screen.queryByLabelText(/Fornitore di/)).toBeNull()
    await user.clear(prezzo)
    await user.type(prezzo, '13.5')
    // Il tasto dice quante righe carica e se sono tutte: da REQ-MAG-032 la
    // consegna si può spuntare riga per riga, e un carico fatto alla cieca
    // lo si scopre contando le bottiglie.
    await user.click(screen.getByRole('button', { name: 'Carica tutti (1)' }))

    await waitFor(() => expect(consegnato).toHaveBeenCalled())
    const [id, opts] = consegnato.mock.calls.at(-1)
    expect(id).toBe('po-1')
    // Solo la riga 0, che è quella di Nova.
    expect(opts.indici).toEqual([0])
    expect(opts.prezzi[0]).toBe('13.5')
  })

  // «Lo metto come consegnato, e da lì me lo metto come da pagare»: il
  // pagato non si può saltare avanti.
  it('«Pagato» compare solo su una fetta già consegnata', async () => {
    stato.ordini = [
      { ...ORDINE, lines: [{ ...ORDINE.lines[0], stato: 'consegnato' }, ORDINE.lines[1]] },
    ]
    render(<PurchaseOrdersPanel />)
    const storico = (await screen.findByText('Storico ordini')).closest('.card')
    const rigaNova = within(storico).getByText('Nova').closest('.inv-row')
    const rigaEnofel = within(storico).getByText('Enofel').closest('.inv-row')
    expect(within(rigaNova).getByRole('button', { name: /Pagato/ })).toBeInTheDocument()
    expect(within(rigaEnofel).queryByRole('button', { name: /Pagato/ })).toBeNull()
    expect(within(rigaEnofel).getByRole('button', { name: /Consegnato/ })).toBeInTheDocument()
  })
})
