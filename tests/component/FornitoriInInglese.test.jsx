// @vitest-environment happy-dom
'use strict'

// FORNITORI E ACQUISTI IN INGLESE (REQ-UI-039). Daniele, 17/11/2026: la
// lingua del gestionale la sceglie chiunque, sul suo profilo. La sezione
// Fornitori è quella dove il gestore passa le mattine — ordini da comporre e
// da ricevere, documenti da registrare, altre spese, il riepilogo del mese —
// e le fatture di cortesia ai clienti stanno accanto. Qui le si apre in
// inglese, nei casi che mostrano più testo, e si chiede cosa è rimasto in
// italiano: la barra delle sottosezioni, un ordine nuovo con la riga aperta,
// la lista con un ordine ancora in arrivo e uno consegnato e fatturato (coi
// suoi dettagli e la finestra della consegna), lo scadenzario coi suoi
// filtri, i dialoghi e il modulo, il documento letto dall'AI, le altre spese
// col modulo aperto, il riepilogo e le fatture ai clienti.
//
// Le prove in italiano (PurchaseOrdersPanel, ListaOrdini, SupplierInvoices…)
// restano quelle di sempre: l'italiano è la lingua di partenza.
//
// RESTANO IN ITALIANO APPOSTA, e qui non si vedono: il testo dell'ordine che
// si manda o si copia per il fornitore (lib/composizioneOrdine.js,
// lib/warehouse.js) e la fattura stampata o mandata per email al cliente
// (lib/mailFattura.js, lib/printer.js). Li leggono altri, non chi lavora qui.
//
// I DATI FINTI NON HANNO PAROLE ITALIANE («Campari», «Aperol», «Nova»,
// «Mario», numeri): il controllo cerca proprio quelle.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from '../helpers/router.jsx'
import { CON_LICENZA } from '../helpers/licenza.js'
import { italianoRimasto } from '../helpers/nienteItaliano.js'
import { impostaLingua } from '../../src/lib/lingua.js'

// ── I TESTI CHE ARRIVANO DA src/lib ──────────────────────────────────
//
// Gli stati dell'ordine, i filtri della lista, la storia dell'ordine, i
// problemi del confronto, i tipi di documento e il saldo vengono da
// lib/statiOrdine.js, lib/confrontoOrdine.js e lib/fatture.js, e sono
// tradotti lì: la prova li controlla come ogni altro testo, senza
// metterne da parte nessuno.

// ── I DATI FINTI ─────────────────────────────────────────────────────

const NOVA = { id: 'nova', name: 'Nova', email: 'orders@nova.example', color: '#e74c3c' }
const ARTICOLI = [
  { id: 'campari', name: 'Campari', unit: 'pz', stock: 2, low_threshold: 4, package_size: 700, content_unit: 'ml', cost: 12, vat: 22, kind: 'scorta', status: 'linea' },
  { id: 'aperol', name: 'Aperol', unit: 'pz', stock: 9, package_size: 700, content_unit: 'ml', cost: 11, vat: 22, kind: 'scorta', status: 'assortimento' },
]
const LISTINI = [
  { id: 'nova__campari', supplier_id: 'nova', item_id: 'campari', price: 12.5, code: 'C-70', last_price_at: '2026-08-01T10:00:00.000Z' },
  { id: 'nova__aperol', supplier_id: 'nova', item_id: 'aperol', price: 11, last_price_at: '2026-08-01T10:00:00.000Z' },
]
const riga = (patch = {}) => ({
  item_id: 'campari',
  name: 'Campari',
  unit: 'pz',
  package_size: 700,
  qty_packages: 6,
  unit_cost: 12,
  vat: 22,
  supplier_id: 'nova',
  supplier_name: 'Nova',
  stato: 'richiesto',
  ...patch,
})
const ordine = (patch = {}) => ({
  id: 'po-1',
  supplier_id: 'nova',
  supplier_name: 'Nova',
  created_at: '2026-08-27T09:00:00.000Z',
  status: 'inviato',
  closed_at: null,
  storia: [],
  total_net: 72,
  total_gross: 87.84,
  lines: [riga()],
  ...patch,
})
// Un ordine ancora in arrivo, e uno consegnato con la fattura del fornitore
// che dice un prezzo diverso: il prospetto e l'allineamento del listino.
const IN_ARRIVO = ordine({ id: 'po-a', lines: [riga(), riga({ item_id: 'aperol', name: 'Aperol', qty_packages: 3 })] })
const CONSEGNATO = ordine({
  id: 'po-c',
  status: 'ricevuto',
  created_at: '2026-08-20T09:00:00.000Z',
  lines: [riga({ stato: 'consegnato', qty_ricevute: 6 })],
  storia: [{ at: '2026-08-20T09:00:00.000Z', tipo: 'creato', righe: 1 }],
})
const FATTURA_NOVA = {
  id: 'inv-1',
  supplier_id: 'nova',
  supplier_name: 'Nova',
  number: '1556',
  doc_type: 'Fattura',
  date: '2026-08-27',
  amount: 90,
  paid: false,
  notes: null,
  order_id: 'po-c',
  lines: [riga({ stato: 'consegnato', unit_cost: 12.5, caricata: true })],
}
const FATTURA_SCIOLTA = {
  id: 'inv-2',
  supplier_id: 'nova',
  supplier_name: 'Nova',
  number: '1600',
  doc_type: 'Proforma',
  date: '2026-08-29',
  amount: 40,
  paid: true,
  notes: null,
  order_id: null,
  lines: [],
}

const stato = { ordini: [], fatture: [], spese: [], impostazioni: {} }

vi.mock('../../src/lib/api.js', () => ({
  subscribeSettings: (cb) => {
    cb(stato.impostazioni)
    return () => {}
  },
  settingsIniziali: () => stato.impostazioni,
  fetchInventoryItems: vi.fn(async () => ARTICOLI),
  fetchSuppliers: vi.fn(async () => [NOVA]),
  fetchSupplierPrices: vi.fn(async () => LISTINI),
  fetchPurchaseOrders: vi.fn(async () => stato.ordini),
  fetchSupplierInvoices: vi.fn(async () => stato.fatture),
  fetchModelliOrdine: vi.fn(async () => [{ id: 'mod-1', nome: 'Weekly', righe: [] }]),
  salvaModelloOrdine: vi.fn((m) => ({ id: 'mod-2', ...m })),
  eliminaModelloOrdine: vi.fn(),
  createPurchaseOrder: vi.fn(() => ({ id: 'po-nuovo' })),
  confermaOrdine: vi.fn((o) => ({ ...o, status: 'inviato' })),
  chiudiOrdine: vi.fn((o) => o),
  registraMovimentoOrdine: vi.fn((o) => o),
  generaFatturaDaOrdine: vi.fn(),
  segnaFatturaPagata: vi.fn((f, paid) => ({ ...f, paid })),
  allineaPrezziDaFattura: vi.fn(async (o) => o),
  consegnaRigheOrdine: vi.fn(async () => IN_ARRIVO),
  togliRigaOrdine: vi.fn(async () => ({ ordine: IN_ARRIVO, articolo: null })),
  segnaInAssortimento: vi.fn(() => []),
  liberaDaAssortimento: vi.fn(() => []),
  deletePurchaseOrder: vi.fn(async () => {}),
  collegaFatturaAFetta: vi.fn(async (id) => stato.fatture.find((f) => f.id === id)),
  createSupplierInvoice: vi.fn(async (i) => ({ id: 'inv-nuova', ...i })),
  updateSupplierInvoice: vi.fn(async () => {}),
  deleteSupplierInvoice: vi.fn(async () => {}),
  aggiungiProdottiAFattura: vi.fn(async (id) => stato.fatture.find((f) => f.id === id)),
  allegaDocumentoAFattura: vi.fn(async (id) => stato.fatture.find((f) => f.id === id)),
  togliAllegatoDaFattura: vi.fn(async (id) => stato.fatture.find((f) => f.id === id)),
  modificaFattura: vi.fn((f, dati) => ({ ...f, ...dati })),
  fetchAltreSpese: vi.fn(async () => stato.spese),
  creaAltraSpesa: vi.fn(async (d) => ({ id: 'sp-nuova', ...d })),
  aggiornaAltraSpesa: vi.fn(async (id, d) => ({ id, ...d })),
  eliminaAltraSpesa: vi.fn(async () => {}),
  subscribeInvoices: (cb) => {
    cb([
      {
        id: 'cf-1',
        number: '2/2026',
        total: 22,
        items: [{ name: 'Negroni', qty: 2, unit_price: 11 }],
        customer: { denominazione: 'Mario Spa', piva: '01234567890', email: 'mario@example.com' },
        order_id: 'ord1',
        order_daily_number: 4,
        created_at: '2026-07-13T10:00:00.000Z',
        sent_at: '2026-07-13T11:00:00.000Z',
        sent_to: 'mario@example.com',
      },
    ])
    return () => {}
  },
  markInvoiceSent: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../src/lib/printer.js', () => ({
  printOrdineFornitore: vi.fn(async () => {}),
  printFattura: vi.fn(async () => {}),
  loadPrinterSettings: () => ({ businessName: 'Bar' }),
  datiFiscaliDelLocale: () => [],
}))
vi.mock('../../src/lib/toast.js', () => ({ toastSuccess: vi.fn(), toastError: vi.fn() }))
// Il documento letto dall'AI: la chiamata alla regia risponde da qui.
const chiamata = vi.fn()
vi.mock('../../src/porte/funzioni.js', () => ({ chiamaFunzione: (_nome, dati) => chiamata(dati) }))
vi.mock('../../src/lib/limiti.js', async (originale) => ({ ...(await originale()), senzaFunctions: () => false }))
vi.mock('../../src/lib/storage.js', () => ({ fotoDiFatturaLeggibile: (f) => Promise.resolve(f) }))
// L'anagrafica è del magazzino, già tradotta e provata in MagazzinoInInglese.
vi.mock('../../src/components/InventoryManager.jsx', () => ({ FornitoriPanel: () => <div>Suppliers</div> }))

import FornitoriTab from '../../src/components/FornitoriTab.jsx'
import PurchaseOrdersPanel from '../../src/components/PurchaseOrdersPanel.jsx'
import SupplierInvoicesPanel from '../../src/components/SupplierInvoicesPanel.jsx'
import FatturaDaAI from '../../src/components/FatturaDaAI.jsx'
import AltreSpesePanel from '../../src/components/AltreSpesePanel.jsx'
import RiepilogoFornitoriPanel from '../../src/components/RiepilogoFornitoriPanel.jsx'
import InvoicesTab from '../../src/components/InvoicesTab.jsx'
import { subscribeSottosezioni } from '../../src/lib/sottosezioni.js'
import { createSupplierInvoice, salvaModelloOrdine } from '../../src/lib/api.js'

beforeEach(() => {
  impostaLingua('en')
  stato.impostazioni = { ...CON_LICENZA }
  stato.ordini = [IN_ARRIVO, CONSEGNATO]
  stato.fatture = [FATTURA_NOVA, FATTURA_SCIOLTA]
  stato.spese = [
    { id: 'sp-1', name: 'Stools', qty: 4, unit_cost: 39.9, shop: 'Amazon', notes: null, bought: true, bought_at: '2026-01-14' },
    { id: 'sp-2', name: 'Sofa', qty: 1, unit_cost: 0, shop: null, notes: null, bought: true, bought_at: '2026-01-20' },
    { id: 'sp-3', name: 'Shelf', qty: 1, unit_cost: 120, shop: null, notes: null, bought: false, bought_at: null },
  ]
})
afterEach(() => {
  cleanup()
  impostaLingua('it')
})

describe('Fornitori in inglese (REQ-UI-039)', () => {
  it('le sottosezioni', () => {
    function Barra() {
      const [sotto, setSotto] = useState({ voci: [] })
      useEffect(() => subscribeSottosezioni(setSotto), [])
      return (sotto.voci || []).map((v) => <button key={v.id}>{v.label}</button>)
    }
    const { container } = render(
      <>
        <FornitoriTab />
        <Barra />
      </>
    )
    for (const voce of ['Supplier management', 'New order', 'Order list', 'Payables', 'Other expenses', 'Summary'])
      expect(screen.getByRole('button', { name: voce })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('il nuovo ordine, con una riga scelta e la sua scheda aperta', async () => {
    const user = userEvent.setup()
    const { container } = render(<PurchaseOrdersPanel vista="nuovo" />)
    await user.click(await screen.findByRole('checkbox', { name: 'Order Campari (Nova)' }))
    await user.click(screen.getByRole('button', { name: 'Open the product sheet of Campari (Nova)' }))
    expect(screen.getByText('Order being composed', { selector: 'strong' })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
    // Il modello scelto e il suo modulo del nome.
    await user.selectOptions(screen.getByLabelText('Order templates'), 'mod-1')
    await user.click(screen.getByRole('button', { name: 'Rename' }))
    expect(italianoRimasto(container)).toEqual([])
  })

  it('la lista ordini: uno in arrivo, uno consegnato e fatturato', async () => {
    const user = userEvent.setup()
    const { container } = render(<PurchaseOrdersPanel vista="lista" />)
    const [primo, secondo] = await screen.findAllByRole('button', { name: /The order from Nova/ })
    await user.click(primo)
    expect(italianoRimasto(container)).toEqual([])
    await user.click(secondo)
    expect(screen.getByText('Ordered, received, invoiced')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
    // La finestra della consegna, sull'ordine ancora in arrivo.
    // Il nome esatto: col filtro tradotto anche il chip «Delivered (1)» lo contiene.
    await user.click(screen.getByRole('button', { name: 'Delivered' }))
    expect(screen.getByText('Goods received from Nova?')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('lo scadenzario, coi dialoghi e il modulo', async () => {
    const user = userEvent.setup()
    const { container } = render(<SupplierInvoicesPanel />)
    await screen.findAllByText('#1556')
    expect(italianoRimasto(container)).toEqual([])
    // «Aggiungi prodotti» sul documento senza ordine, con un prodotto scelto.
    const [, sciolta] = screen.getAllByRole('button', { name: /Add products/ })
    await user.click(sciolta)
    await user.type(screen.getByLabelText('Search for a product'), 'campa')
    await user.click(await screen.findByRole('button', { name: 'Add Campari' }))
    expect(italianoRimasto(container)).toEqual([])
    await user.click(within(container.querySelector('.confirm-box')).getByRole('button', { name: 'Cancel' }))
    // Il collegamento a un ordine, e il modulo del documento nuovo.
    await user.click(screen.getByRole('button', { name: 'Link the document of Nova #1600 to an order' }))
    expect(italianoRimasto(container)).toEqual([])
    await user.click(within(container.querySelector('.confirm-box')).getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: /New document/ }))
    expect(italianoRimasto(container)).toEqual([])
  })

  it('il documento letto dall’AI', async () => {
    const user = userEvent.setup()
    chiamata.mockResolvedValue({
      ok: true,
      tipo: 'fattura',
      risultato: {
        fornitore: { ragione_sociale: 'NOVA SRL', partita_iva: null },
        numero: '123',
        data: '2026-11-10',
        righe: [{ descrizione: 'CAMPARI 70CL', quantita: 6, prezzo_unitario: 12, aliquota_iva: 22, importo: 72 }],
        imponibile: 72,
        iva: 15.84,
        totale: 87.84,
        da_verificare: [],
      },
      costo_eur: 0.04,
      credito_eur: 4.9,
    })
    const { container } = render(
      <FatturaDaAI suppliers={[NOVA]} items={ARTICOLI} listini={LISTINI} onAnnulla={() => {}} onRegistrata={() => {}} />
    )
    expect(italianoRimasto(container)).toEqual([])
    await user.upload(
      screen.getByLabelText('The photo or PDF of the invoice'),
      new File(['%PDF-1.4'], 'doc.pdf', { type: 'application/pdf' })
    )
    expect(await screen.findByRole('group', { name: 'Document read by the AI' })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('le altre spese, col modulo aperto', async () => {
    const user = userEvent.setup()
    const { container } = render(<AltreSpesePanel />)
    await screen.findByText('Stools')
    expect(italianoRimasto(container)).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Edit «Stools»' }))
    expect(screen.getByText('Edit expense')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('il riepilogo del mese', async () => {
    const { container } = render(<RiepilogoFornitoriPanel />)
    expect(await screen.findByText('August 2026')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('le fatture ai clienti', () => {
    const { container } = render(
      <MemoryRouter>
        <InvoicesTab />
      </MemoryRouter>
    )
    expect(screen.getByText('Invoice no. 2/2026')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })
})

// ── IN INGLESE A SCHERMO, IN ITALIANO NEI DATI ───────────────────────
//
// La lingua cambia quello che si LEGGE, non quello che si SALVA né quello
// che si manda fuori. Tre posti dove la parola tradotta poteva finire nei
// dati (revisione del 17/11): il tipo di documento (`doc_type` è italiano,
// e `eNotaDiCredito` lo riconosce solo così), il nome di partenza di un
// modello ricavato da un ordine senza fornitore, e la mail o il testo
// copiato per il fornitore, che li legge lui.
describe('in inglese a schermo, in italiano nei dati (REQ-UI-039)', () => {
  it('scegliendo «Credit note» il documento si salva come «Nota di credito»', async () => {
    const user = userEvent.setup()
    render(<SupplierInvoicesPanel />)
    await screen.findAllByText('#1556')
    await user.click(screen.getByRole('button', { name: /New document/ }))
    await user.selectOptions(screen.getByLabelText('Supplier *'), 'nova')
    // Si sceglie per il testo che si vede, non per il valore.
    await user.selectOptions(screen.getByLabelText('Type'), 'Credit note')
    await user.type(screen.getByLabelText('Amount € *'), '120')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(createSupplierInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ supplier_id: 'nova', doc_type: 'Nota di credito', amount: 120 })
    )
  })

  it('il modello di un ordine senza fornitore non parte da «No supplier»', async () => {
    const user = userEvent.setup()
    const senza = { supplier_id: null, supplier_name: null }
    stato.ordini = [ordine({ id: 'po-s', ...senza, lines: [riga(senza)] })]
    render(<PurchaseOrdersPanel vista="lista" />)
    await user.click(await screen.findByRole('button', { name: /The order from No supplier/ }))
    await user.click(screen.getByRole('button', { name: 'Save as template' }))
    // Il campo parte vuoto: «No supplier» è come si legge a schermo, e
    // salvato com'era finiva in archivio come nome del modello.
    const campo = screen.getByLabelText('Template name')
    expect(campo).toHaveValue('')
    await user.type(campo, 'Weekly 2')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(salvaModelloOrdine).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Weekly 2' }))
    expect(salvaModelloOrdine).not.toHaveBeenCalledWith(expect.objectContaining({ nome: 'No supplier' }))
  })

  it('la mail e il testo copiato per il fornitore restano in italiano', async () => {
    const user = userEvent.setup()
    // `window.location.href` non si assegna in happy-dom: si guarda cosa
    // la schermata avrebbe aperto, e alla fine si rimette com'era.
    const vero = window.location
    const aperto = []
    Object.defineProperty(window, 'location', { configurable: true, value: { set href(v) { aperto.push(v) } } })
    try {
      stato.ordini = [IN_ARRIVO]
      render(<PurchaseOrdersPanel vista="lista" />)
      await user.click(await screen.findByRole('button', { name: 'Send to Nova' }))
      expect(aperto).toHaveLength(1)
      const mail = new URL(aperto[0])
      expect(mail.searchParams.get('subject')).toBe('Ordine Nova — 2026-08-27')
      const testo = mail.searchParams.get('body')
      expect(testo).toMatch(/^Ordine del 2026-08-27\nFornitore: Nova\n/)
      expect(testo).toMatch(/Totale netto: /)
      expect(testo).not.toMatch(/\b(Order|Supplier|Total)\b/)

      await user.click(screen.getByRole('button', { name: 'Copy the order of Nova' }))
      expect(await navigator.clipboard.readText()).toBe(testo)
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: vero })
    }
  })
})
