// @vitest-environment happy-dom
'use strict'

// ── ACQUISTI, VENDUTO E GENERATO PER MACRO (REQ-STAT-004) ─────────────
// Flavio, 30/09/2026: «quello che non vedo è la visualizzazione nelle
// statistiche di quello che c'è nelle macro-categorie: vedere gli acquisti,
// il venduto e quanto mi ha generato». La scheda sta nelle statistiche per
// periodo, si apre a richiesta e segue lo stesso periodo del resto della
// pagina. Il conto è provato in tests/unit/macroStats.test.js.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const stato = { ordiniFornitore: [], items: [], macros: [], movimenti: [] }

vi.mock('../../src/lib/api.js', () => ({
  fetchPurchaseOrders: vi.fn(async () => stato.ordiniFornitore),
  fetchInventoryItems: vi.fn(async () => stato.items),
  fetchMacroCategories: vi.fn(async () => stato.macros),
  fetchStockMovementsSince: vi.fn(async () => stato.movimenti),
}))

import MacroPeriodo from '../../src/components/MacroPeriodo.jsx'

const MACRO_DISTILLATI = { id: 'm1', name: 'DISTILLATI', pesi_prodotti: { gin: 100 }, pesi_voci: { gintonic: 100 } }
const drinksById = { gintonic: { id: 'gintonic', name: 'Gin Tonic', recipe: [] } }
const conto = { status: 'pagato', created_at: '2026-09-20T20:00:00.000Z', order_items: [{ drink_id: 'gintonic', qty: 2, unit_price: 10 }] }
const consegna = (delivered_at, qty) => ({
  status: 'inviato',
  lines: [{ item_id: 'gin', unit_cost: 5, qty_packages: qty, qty_received: qty, stato: 'consegnato', delivered_at }],
})

beforeEach(() => {
  vi.clearAllMocks()
  stato.macros = [MACRO_DISTILLATI]
  stato.items = [{ id: 'gin', unit: 'pz', cost: 5 }]
  stato.movimenti = []
  stato.ordiniFornitore = [consegna('2026-09-20T10:00:00.000Z', 1), consegna('2026-08-01T10:00:00.000Z', 10)]
})

describe('per macro-categoria', () => {
  // Legge ordini fornitore, prodotti e macro: chi guarda l'incasso non paga
  // quella lettura se non la chiede.
  it('non legge niente finché non la si apre', async () => {
    const api = await import('../../src/lib/api.js')
    render(<MacroPeriodo ordini={[conto]} drinksById={drinksById} dal="2026-09-15" al="2026-09-25" cutoffHour={5} />)
    expect(api.fetchPurchaseOrders).not.toHaveBeenCalled()
    expect(screen.getByText(/Acquisti, venduto e margine generato/)).toBeInTheDocument()
  })

  it('aperta, dice acquisti, venduto e generato del periodo', async () => {
    render(<MacroPeriodo ordini={[conto]} drinksById={drinksById} dal="2026-09-15" al="2026-09-25" cutoffHour={5} />)
    await userEvent.click(screen.getByRole('button', { name: 'Calcola' }))
    const riga = (await screen.findByText('DISTILLATI')).closest('.inv-row').textContent
    // La consegna di agosto è fuori periodo: conta solo quella del 20/09.
    // Gli importi hanno lo spazio non divisibile prima dell'euro: \s lo prende.
    expect(riga).toMatch(/Acquisti 5,00\s€ · Venduto 20,00\s€ · Generato 15,00\s€/)
    expect(screen.getByText('Totale').closest('.inv-row').textContent).toMatch(/Generato 15,00\s€/)
  })
})
