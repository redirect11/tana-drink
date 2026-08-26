// @vitest-environment happy-dom
'use strict'

// ── IL CARICO DI UNA CONSEGNA, RIGA PER RIGA E TUTTO INSIEME ─────────
//
// REQ-MAG-025 punto 4, parole dell'utente il 20/08: «è il bartender che
// decide, quando l'ordine è arrivato, SE e QUALI prodotti caricare in
// inventario. Riga per riga, più un tasto CARICA TUTTI». Il fornitore
// consegna quello che ha, non quello che è stato ordinato: le due casse su
// tre arrivate si caricano, la terza resta in attesa.
//
// E REQ-MAG-025 punto 5, l'assortimento pre-impostato: il passaggio a «in
// assortimento» si segna quando l'ordine parte e si applica quando la merce
// è arrivata e caricata davvero — preparare il listino mentre la merce
// viaggia, senza offrire in carta una bottiglia che non c'è (REQ-MAG-032).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const NOVA = { id: 'nova', name: 'Nova', email: 'ordini@nova.it', color: '#e74c3c' }

const ARTICOLI = [
  { id: 'campari', name: 'Campari', unit: 'pz', stock: 2, package_size: 700, content_unit: 'ml', cost: 12, vat: 22, kind: 'scorta', status: 'assortimento' },
  { id: 'gin', name: 'Gin Mare', unit: 'pz', stock: 5, package_size: 700, content_unit: 'ml', cost: 30, vat: 22, kind: 'scorta', status: 'assortimento' },
  // Un premium: è su questo che il pre-impostato cambia qualcosa, e quindi
  // è l'unico a cui la casella viene chiesta.
  { id: 'rum', name: 'Rum Zacapa', unit: 'pz', stock: 1, package_size: 700, content_unit: 'ml', cost: 45, vat: 22, kind: 'scorta', status: 'premium' },
]

// Una fetta sola, con tre righe: è il caso in cui «quali caricare» conta.
const ORDINE = {
  id: 'po-1',
  created_at: '2026-08-27T09:00:00.000Z',
  status: 'inviato',
  total_net: 152,
  total_gross: 185.44,
  lines: [
    { item_id: 'campari', name: 'Campari', qty_packages: 6, unit_cost: 12, vat: 22, supplier_id: 'nova', supplier_name: 'Nova', stato: 'richiesto' },
    { item_id: 'gin', name: 'Gin Mare', qty_packages: 2, unit_cost: 30, vat: 22, supplier_id: 'nova', supplier_name: 'Nova', stato: 'richiesto' },
    { item_id: 'rum', name: 'Rum Zacapa', qty_packages: 1, unit_cost: 45, vat: 22, supplier_id: 'nova', supplier_name: 'Nova', stato: 'richiesto' },
  ],
}

const stato = { ordini: [], listini: [], fatture: [] }

vi.mock('../../src/lib/api.js', () => ({
  fetchInventoryItems: vi.fn(async () => ARTICOLI),
  fetchSuppliers: vi.fn(async () => [NOVA]),
  fetchSupplierPrices: vi.fn(async () => stato.listini),
  fetchPurchaseOrders: vi.fn(async () => stato.ordini),
  createPurchaseOrder: vi.fn(async (o) => ({ id: 'po-nuovo', created_at: '2026-08-27T09:00:00.000Z', status: 'inviato', ...o })),
  consegnaRigheOrdine: vi.fn(async (id) => ({ ...stato.ordini[0], id })),
  segnaRighePagate: vi.fn(async (id) => ({ ...stato.ordini[0], id })),
  deletePurchaseOrder: vi.fn(async () => {}),
  fetchSupplierInvoices: vi.fn(async () => stato.fatture),
  collegaFatturaAFetta: vi.fn(async () => ({})),
}))

vi.mock('../../src/lib/printer.js', () => ({ printOrdineFornitore: vi.fn(async () => {}) }))
vi.mock('../../src/lib/toast.js', () => ({ toastSuccess: vi.fn(), toastError: vi.fn() }))

import PurchaseOrdersPanel from '../../src/components/PurchaseOrdersPanel.jsx'
import {
  consegnaRigheOrdine as consegnato,
  createPurchaseOrder as creato,
} from '../../src/lib/api.js'

beforeEach(() => {
  vi.clearAllMocks()
  stato.ordini = []
  stato.listini = []
  stato.fatture = []
})

// Apre la finestra della consegna sulla fetta di Nova.
async function apriConsegna(user) {
  render(<PurchaseOrdersPanel />)
  const storico = (await screen.findByText('Storico ordini')).closest('.card')
  const riga = within(storico).getByText('Nova').closest('.inv-row')
  await user.click(within(riga).getByRole('button', { name: /Consegnato/ }))
  return await screen.findByLabelText('Carica Campari')
}

describe('si decide SE e QUALI righe caricare', () => {
  beforeEach(() => {
    stato.ordini = [ORDINE]
  })

  // SI PARTE CON TUTTO SPUNTATO: la consegna intera è il caso normale, e chi
  // non tocca niente carica quello che ha ordinato.
  it('all’apertura sono spuntate tutte, e il tasto lo dice', async () => {
    const user = userEvent.setup()
    const prima = await apriConsegna(user)
    expect(prima).toBeChecked()
    expect(screen.getByLabelText('Carica Gin Mare')).toBeChecked()
    expect(screen.getByRole('button', { name: 'Carica tutti (3)' })).toBeInTheDocument()
  })

  it('togliendo una spunta si carica solo il resto, e il tasto cambia parole', async () => {
    const user = userEvent.setup()
    await apriConsegna(user)
    await user.click(screen.getByLabelText('Carica Gin Mare'))
    const tasto = screen.getByRole('button', { name: 'Carica i selezionati (2)' })
    await user.click(tasto)
    const [id, opts] = consegnato.mock.calls.at(-1)
    expect(id).toBe('po-1')
    // La riga 1 (il Gin) resta «richiesta»: si caricherà quando arriva.
    expect(opts.indici).toEqual([0, 2])
  })

  // «Più un tasto CARICA TUTTI»: le tre righe si caricano in un gesto, senza
  // spuntarle a una a una.
  it('«Carica tutti» manda tutte le righe ancora richieste della fetta', async () => {
    const user = userEvent.setup()
    await apriConsegna(user)
    await user.click(screen.getByRole('button', { name: 'Carica tutti (3)' }))
    expect(consegnato.mock.calls.at(-1)[1].indici).toEqual([0, 1, 2])
  })

  it('la spunta si toglie e si rimette a tutte in un colpo', async () => {
    const user = userEvent.setup()
    await apriConsegna(user)
    await user.click(screen.getByRole('button', { name: 'Togli tutte le spunte' }))
    // Senza niente spuntato non si carica: il tasto è spento, e non c'è
    // nessun gesto che scriva a vuoto.
    expect(screen.getByRole('button', { name: 'Carica i selezionati (0)' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Spunta tutte' }))
    expect(screen.getByRole('button', { name: 'Carica tutti (3)' })).toBeInTheDocument()
  })

  // Di lì si carica, non si ricarica: una riga già consegnata non torna
  // nella finestra, come le righe già in archivio della fattura
  // (REQ-MAG-030).
  it('le righe già consegnate non compaiono più', async () => {
    const user = userEvent.setup()
    stato.ordini = [
      { ...ORDINE, lines: [{ ...ORDINE.lines[0], stato: 'consegnato' }, ORDINE.lines[1], ORDINE.lines[2]] },
    ]
    render(<PurchaseOrdersPanel />)
    const storico = (await screen.findByText('Storico ordini')).closest('.card')
    const riga = within(storico).getByText('Nova').closest('.inv-row')
    await user.click(within(riga).getByRole('button', { name: /Consegnato/ }))
    await screen.findByLabelText('Carica Gin Mare')
    expect(screen.queryByLabelText('Carica Campari')).toBeNull()
    expect(screen.getByRole('button', { name: 'Carica tutti (2)' })).toBeInTheDocument()
  })
})

describe('l’assortimento si prepara mentre la merce viaggia', () => {
  // La casella si chiede solo dove cambia qualcosa: su un prodotto già in
  // assortimento sarebbe una casella che non fa niente.
  it('la casella compare solo dove il passaggio cambia lo stato', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrdersPanel />)
    await screen.findAllByText('Campari')
    await user.click(screen.getByRole('button', { name: 'Aggiungi Campari' }))
    await user.click(screen.getByRole('button', { name: 'Aggiungi Rum Zacapa' }))
    expect(screen.getByLabelText('Metti Rum Zacapa in assortimento quando arriva')).toBeInTheDocument()
    expect(screen.queryByLabelText('Metti Campari in assortimento quando arriva')).toBeNull()
  })

  it('spuntata, la riga d’ordine si porta dietro il cambio da applicare', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrdersPanel />)
    await screen.findAllByText('Campari')
    await user.click(screen.getByRole('button', { name: 'Aggiungi Rum Zacapa' }))
    await user.click(screen.getByLabelText('Metti Rum Zacapa in assortimento quando arriva'))
    await user.click(screen.getByRole('button', { name: /Salva ordine/ }))
    const salvato = creato.mock.calls.at(-1)[0]
    expect(salvato.lines[0]).toMatchObject({ item_id: 'rum', status_target: 'assortimento' })
  })

  // Non spuntata non si scrive niente: un campo in più su ogni riga di ogni
  // ordine sarebbe un dato che nessuno ha chiesto.
  it('non spuntata, sulla riga non si scrive niente', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrdersPanel />)
    await screen.findAllByText('Campari')
    await user.click(screen.getByRole('button', { name: 'Aggiungi Rum Zacapa' }))
    await user.click(screen.getByRole('button', { name: /Salva ordine/ }))
    expect(creato.mock.calls.at(-1)[0].lines[0].status_target).toBeUndefined()
  })
})
