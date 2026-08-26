// @vitest-environment happy-dom
'use strict'

// ── IL LEGAME FATTURA ↔ FETTA, NELLE DUE SCHERMATE (REQ-MAG-031) ─────
//
// L'utente, 20/08: «la vista degli ordini contiene più fornitori, ma la
// fattura è collegata all'ordine PER IL FORNITORE, perché è il fornitore che
// rilascia la fattura».
//
// Qui si sorveglia quello che si vede: che da una fetta si arrivi alla sua
// fattura e da una fattura alla sua fetta, che il fornitore sbagliato non si
// possa nemmeno scegliere, e che i due buchi — merce arrivata senza
// documento, documento senza ordine — si vedano senza andarli a cercare.
// Sono le due cose che a fine mese fanno tornare o non tornare i conti con
// il commercialista.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const NOVA = { id: 'nova', name: 'Nova', email: 'ordini@nova.it', color: '#e74c3c' }
const ENOFEL = { id: 'enofel', name: 'Enofel', email: 'ordini@enofel.it', color: '#3498db' }

const ARTICOLI = [
  { id: 'campari', name: 'Campari', unit: 'pz', stock: 2, package_size: 700, content_unit: 'ml', cost: 12, vat: 22, kind: 'scorta', status: 'linea' },
  { id: 'gin', name: 'Gin Mare', unit: 'pz', stock: 5, package_size: 700, content_unit: 'ml', cost: 30, vat: 22, kind: 'scorta', status: 'linea' },
]

// L'ordine del 20 agosto: due fornitori dentro. Nova ha consegnato, Enofel
// no — è il caso normale, consegnano in giorni diversi.
const ORDINE = {
  id: 'po-1',
  created_at: '2026-08-20T09:00:00.000Z',
  status: 'inviato',
  total_net: 105,
  total_gross: 128.1,
  lines: [
    { item_id: 'campari', name: 'Campari', unit: 'pz', package_size: 700, qty_packages: 6, unit_cost: 12.5, vat: 22, supplier_id: 'nova', supplier_name: 'Nova', stato: 'consegnato' },
    { item_id: 'gin', name: 'Gin Mare', unit: 'pz', package_size: 700, qty_packages: 1, unit_cost: 30, vat: 22, supplier_id: 'enofel', supplier_name: 'Enofel', stato: 'richiesto' },
  ],
}

const FATTURA_NOVA = {
  id: 'inv-nova',
  supplier_id: 'nova',
  supplier_name: 'Nova',
  number: '1556',
  doc_type: 'Fattura',
  date: '2026-08-26',
  amount: 81,
  paid: false,
  lines: [],
  order_id: null,
}

const FATTURA_ENOFEL = { ...FATTURA_NOVA, id: 'inv-enofel', supplier_id: 'enofel', supplier_name: 'Enofel', number: '77', amount: 30 }

const stato = { ordini: [ORDINE], fatture: [FATTURA_NOVA] }

vi.mock('../../src/lib/api.js', () => ({
  fetchInventoryItems: vi.fn(async () => ARTICOLI),
  fetchSuppliers: vi.fn(async () => [NOVA, ENOFEL]),
  fetchSupplierPrices: vi.fn(async () => []),
  fetchPurchaseOrders: vi.fn(async () => stato.ordini),
  fetchSupplierInvoices: vi.fn(async () => stato.fatture),
  createPurchaseOrder: vi.fn(async () => ({})),
  consegnaRigheOrdine: vi.fn(async () => ({})),
  segnaRighePagate: vi.fn(async () => ({})),
  deletePurchaseOrder: vi.fn(async () => {}),
  createSupplierInvoice: vi.fn(async () => ({})),
  updateSupplierInvoice: vi.fn(async () => {}),
  deleteSupplierInvoice: vi.fn(async () => {}),
  aggiungiProdottiAFattura: vi.fn(async () => ({})),
  // Come l'api vera: compone il documento aggiornato senza rileggerlo.
  collegaFatturaAFetta: vi.fn(async (id, { order_id }) => ({
    ...stato.fatture.find((f) => f.id === id),
    order_id: order_id || null,
  })),
}))

vi.mock('../../src/lib/printer.js', () => ({ printOrdineFornitore: vi.fn(async () => {}) }))
vi.mock('../../src/lib/toast.js', () => ({ toastSuccess: vi.fn(), toastError: vi.fn() }))

import PurchaseOrdersPanel from '../../src/components/PurchaseOrdersPanel.jsx'
import SupplierInvoicesPanel from '../../src/components/SupplierInvoicesPanel.jsx'
import { collegaFatturaAFetta as collegato } from '../../src/lib/api.js'

beforeEach(() => {
  vi.clearAllMocks()
  stato.ordini = [ORDINE]
  stato.fatture = [{ ...FATTURA_NOVA }]
})

describe('dall’ordine si vede se la fattura c’è', () => {
  // IL PRIMO DEI DUE BUCHI: la merce è arrivata, il documento no.
  it('una fetta consegnata senza documento lo dice, e si conta in testa', async () => {
    render(<PurchaseOrdersPanel />)
    expect(await screen.findByText('manca la fattura')).toBeInTheDocument()
    expect(screen.getByText('1 consegna senza fattura')).toBeInTheDocument()
  })

  // La fetta di Enofel è ancora «richiesta»: lì non è arrivato niente, e
  // segnalarla insegnerebbe a ignorare il segnale.
  it('la fetta ancora richiesta non risulta scoperta', async () => {
    render(<PurchaseOrdersPanel />)
    await screen.findByText('manca la fattura')
    expect(screen.getAllByText('manca la fattura')).toHaveLength(1)
  })

  it('con la fattura attaccata si legge il documento, e il buco si chiude', async () => {
    stato.fatture = [{ ...FATTURA_NOVA, order_id: 'po-1' }]
    render(<PurchaseOrdersPanel />)
    expect(await screen.findByText(/Fattura #1556/)).toBeInTheDocument()
    expect(screen.queryByText('manca la fattura')).toBeNull()
    expect(screen.queryByText(/consegna senza fattura/)).toBeNull()
  })
})

describe('il fornitore fa da guardia, e non si può nemmeno sbagliare', () => {
  it('alla fetta di Enofel si propongono solo i documenti di Enofel', async () => {
    stato.fatture = [FATTURA_NOVA, FATTURA_ENOFEL]
    const user = userEvent.setup()
    render(<PurchaseOrdersPanel />)
    await user.click(await screen.findByRole('button', { name: 'Collega una fattura a Enofel' }))

    const tendina = screen.getByLabelText('Documento')
    expect(tendina.textContent).toContain('#77')
    // Quella di Nova non è in elenco: agganciarla qui vorrebbe dire pagare
    // merce a chi non l'ha venduta.
    expect(tendina.textContent).not.toContain('#1556')
  })

  it('un documento già agganciato altrove non si propone una seconda volta', async () => {
    stato.fatture = [{ ...FATTURA_NOVA, order_id: 'po-vecchio' }]
    const user = userEvent.setup()
    render(<PurchaseOrdersPanel />)
    await user.click(await screen.findByRole('button', { name: 'Collega una fattura a Nova' }))
    expect(screen.getByText(/Nessun documento di Nova da collegare/)).toBeInTheDocument()
  })
})

describe('si aggancia e si sgancia, dai due lati', () => {
  it('dall’ordine si sceglie il documento e la riga lo mostra subito', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrdersPanel />)
    await user.click(await screen.findByRole('button', { name: 'Collega una fattura a Nova' }))
    await user.selectOptions(screen.getByLabelText('Documento'), 'inv-nova')
    await user.click(screen.getByRole('button', { name: 'Collega' }))

    expect(collegato).toHaveBeenCalledWith('inv-nova', { order_id: 'po-1' })
    // Niente attesa: l'esito si vede nell'istante in cui si tocca.
    expect(await screen.findByText(/Fattura #1556/)).toBeInTheDocument()
  })

  it('e dall’ordine si stacca, che è lo stesso gesto al contrario', async () => {
    stato.fatture = [{ ...FATTURA_NOVA, order_id: 'po-1' }]
    const user = userEvent.setup()
    render(<PurchaseOrdersPanel />)
    await user.click(await screen.findByRole('button', { name: 'Scollega la fattura di Nova' }))

    expect(collegato).toHaveBeenCalledWith('inv-nova', { order_id: null })
    await waitFor(() => expect(screen.getByText('manca la fattura')).toBeInTheDocument())
  })

  it('dal documento si vede a quale parte di quale ordine si riferisce', async () => {
    stato.fatture = [{ ...FATTURA_NOVA, order_id: 'po-1' }]
    render(<SupplierInvoicesPanel />)
    // La data dell'ordine, quanti articoli e il netto: è la FETTA di Nova,
    // non l'ordine intero, e il gin di Enofel non ci sta dentro.
    expect(await screen.findByText(/Ordine 2026-08-20 · 1 art\./)).toBeInTheDocument()
  })

  it('dal documento si collega, scegliendo fra gli ordini del suo fornitore', async () => {
    const user = userEvent.setup()
    render(<SupplierInvoicesPanel />)
    await user.click(await screen.findByRole('button', { name: /Collega a un ordine il documento di Nova/ }))
    await user.selectOptions(screen.getByLabelText('Ordine'), 'po-1')
    await user.click(screen.getByRole('button', { name: 'Collega' }))

    expect(collegato).toHaveBeenCalledWith('inv-nova', { order_id: 'po-1' })
    expect(await screen.findByText(/Ordine 2026-08-20/)).toBeInTheDocument()
  })
})

describe('un documento senza ordine si vede, e si può isolare', () => {
  // IL SECONDO DEI DUE BUCHI: il documento c'è, l'ordine no.
  it('la riga lo dice, e il filtro tiene solo quelli', async () => {
    stato.fatture = [{ ...FATTURA_NOVA }, { ...FATTURA_ENOFEL, order_id: 'po-1' }]
    const user = userEvent.setup()
    render(<SupplierInvoicesPanel />)

    expect(await screen.findByText('senza ordine')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Senza ordine (1)' }))
    // Resta il solo documento scoperto: quello di Enofel ha il suo ordine.
    await waitFor(() => expect(screen.queryByText('#77')).toBeNull())
    expect(screen.getByText('#1556')).toBeInTheDocument()
  })
})
