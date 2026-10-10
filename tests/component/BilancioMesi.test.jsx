// @vitest-environment happy-dom
'use strict'

// BILANCIO → MESI (REQ-CASSA-011): la schermata. Il conto ha la sua prova
// (tests/unit/bilancioMesi.test.js); qui si guarda che il mese si legga come
// il foglio, con i numeri giusti al posto giusto e la spiegazione a
// scomparsa.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { businessDayKey } from '../../src/lib/businessDay.js'

// Il mese che la schermata apre: quello della giornata commerciale di oggi,
// come la calcola lei (alle 3 di notte del 1° è ancora il mese prima).
const MESE = businessDayKey(new Date(), 5).slice(0, 7)

vi.mock('../../src/lib/api.js', () => ({
  settingsIniziali: () => ({ business_day_cutoff_hour: 5, sale_vat: 10 }),
  subscribeSettings: (cb) => {
    cb({ business_day_cutoff_hour: 5, sale_vat: 10 })
    return () => {}
  },
  fetchDrinks: async () => [],
  fetchInventoryItems: async () => [],
  fetchSupplierInvoices: async () => [],
  fetchAltreSpese: async () => [],
  fetchPurchaseOrders: async () => [],
  fetchSuppliers: async () => [],
  subscribeStaffRates: () => () => {},
  subscribeStaffHoursRange: () => () => {},
  subscribeStaffShiftsRange: () => () => {},
  fetchVenditeStoriche: async () => [],
  fetchOrdersBetween: vi.fn(async () => [
    { status: 'pagato', created_at: `${MESE}-01T20:00:00.000Z`, total: 400, discount_amount: 0, order_items: [] },
  ]),
  // Un foglio anche per il mese corrente, per vedere minimo e nota.
  fetchFoglioMese: vi.fn(async (m) =>
    m === MESE ? { giorni: { [`${MESE}-01`]: { minimo: 300, nota: 'KARAOKE' } }, stipendi: 1500, spese: 2000 } : null
  ),
}))

import MesiBilancio from '../../src/components/MesiBilancio.jsx'

describe('Bilancio → Mesi', () => {
  it('il mese per settimane: minimo e nota dal foglio, incassato dai conti, differenza', async () => {
    render(<MesiBilancio />)
    expect(await screen.findByText('I SETT')).toBeInTheDocument()
    expect(screen.getByText('KARAOKE')).toBeInTheDocument()
    // Minimo 300, incassato 400: cento sopra.
    expect(screen.getAllByText(/100,00/).length).toBeGreaterThan(0)
  })

  it('sotto, i conti del mese col netto, e da dove vengono stipendi e spese', async () => {
    render(<MesiBilancio />)
    await screen.findByText('I SETT')
    expect(screen.getByText(/Σ Il mese/)).toBeInTheDocument()
    expect(screen.getAllByText(/dal foglio/)).toHaveLength(2)
    // 400 − 1500 − 2000
    expect(screen.getByText(/−\s?3\.100,00|-3\.100,00/)).toBeInTheDocument()
  })

  it('la spiegazione sta in cima, chiusa', async () => {
    render(<MesiBilancio />)
    await screen.findByText('I SETT')
    expect(screen.getByText(/Cosa misura questa tabella/).closest('details')).not.toHaveAttribute('open')
    expect(screen.getByText(/Da dove viene il minimo/)).toBeInTheDocument()
  })

  it('si va al mese prima con la freccia', async () => {
    const user = userEvent.setup()
    const api = await import('../../src/lib/api.js')
    render(<MesiBilancio />)
    await screen.findByText('I SETT')
    await user.click(screen.getByRole('button', { name: 'Mese precedente' }))
    expect(api.fetchFoglioMese).toHaveBeenLastCalledWith(expect.not.stringContaining(MESE))
  })
})
