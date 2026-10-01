// @vitest-environment happy-dom
'use strict'

// BILANCIO → ACQUISTI × FATTURATO (REQ-MAG-022). La tabella del foglio
// «RAPPORTI ACQUISTI» di Flavio: per ogni macro acquisti, fatturato, utile,
// rapporto fat/acq e incidenza sugli utili. Il conto ha la sua prova
// (tests/unit/acquistiFatturato.test.js); qui si guarda la schermata: le
// righe nell'ordine del foglio, le quattro viste, il lordo che si apre per
// primo e il netto a un tocco, e le letture limitate al periodo mostrato.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const ANNO = new Date().getFullYear()

const api = vi.hoisted(() => ({
  fetchOrdersBetween: vi.fn(),
  fetchCarichiBetween: vi.fn(),
}))

vi.mock('../../src/lib/api.js', () => ({
  settingsIniziali: () => ({ sale_vat: 10, business_day_cutoff_hour: 5 }),
  subscribeSettings: (cb) => {
    cb({ sale_vat: 10, business_day_cutoff_hour: 5 })
    return () => {}
  },
  fetchOrdersBetween: api.fetchOrdersBetween,
  fetchCarichiBetween: api.fetchCarichiBetween,
  fetchDrinks: async () => [{ id: 'gintonic' }],
  fetchInventoryItems: async () => [{ id: 'gin', unit: 'pz', cost: 5, vat: 22 }],
  fetchMacroCategories: async () => [
    { id: 'alc', name: 'Distillati', pesi_voci: { gintonic: 100 }, pesi_prodotti: { gin: 100 } },
  ],
  // Due gin consegnati a luglio, a 5 € netti l'uno.
  fetchPurchaseOrders: async () => [
    {
      status: 'inviato',
      lines: [{ item_id: 'gin', unit_cost: 5, qty_packages: 2, stato: 'consegnato', delivered_at: `${ANNO}-07-02T10:00:00.000Z` }],
    },
  ],
}))

import AcquistiFatturato from '../../src/components/AcquistiFatturato.jsx'

beforeEach(() => {
  api.fetchOrdersBetween.mockReset()
  api.fetchCarichiBetween.mockReset()
  api.fetchOrdersBetween.mockImplementation(async () => [
    { status: 'pagato', created_at: `${ANNO}-07-03T20:00:00.000Z`, order_items: [{ drink_id: 'gintonic', qty: 2, unit_price: 11 }] },
  ])
  api.fetchCarichiBetween.mockImplementation(async () => [])
})

async function blocco(titolo) {
  return (await screen.findByText(titolo)).closest('.card')
}
async function riga(titolo, etichetta) {
  const card = await blocco(titolo)
  const r = [...card.querySelectorAll('tbody tr')].find((x) => x.querySelector('th')?.textContent === etichetta)
  if (!r) throw new Error(`riga «${etichetta}» non trovata in «${titolo}»`)
  return r
}

describe('Acquisti × Fatturato', () => {
  it('ha le righe del foglio, nel suo ordine', async () => {
    render(<AcquistiFatturato />)
    const card = await blocco('🗂️ Distillati')
    const righe = [...card.querySelectorAll('tbody th')].map((th) => th.textContent)
    expect(righe).toEqual(['Acquisti', 'Fatturato', 'Utile', 'Fat/Acq', 'Incidenza'])
  })

  // Si apre al lordo, come il foglio: 2 gin a 5 € + IVA 22% = 12,20.
  it('si apre al lordo, e il netto è a un tocco', async () => {
    const user = userEvent.setup()
    render(<AcquistiFatturato />)
    const acq = await riga('🗂️ Distillati', 'Acquisti')
    expect(within(acq).getAllByText('12 €').length).toBeGreaterThan(0)
    const fat = await riga('🗂️ Distillati', 'Fatturato')
    expect(within(fat).getAllByText('22 €').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Netto IVA' }))
    expect(within(await riga('🗂️ Distillati', 'Acquisti')).getAllByText('10 €').length).toBeGreaterThan(0)
    // 22 € scorporati al 10%.
    expect(within(await riga('🗂️ Distillati', 'Fatturato')).getAllByText('20 €').length).toBeGreaterThan(0)
    expect(screen.getByText(/al netto dell’IVA/)).toBeInTheDocument()
  })

  it('sotto i totali l’incidenza è sul periodo mostrato', async () => {
    render(<AcquistiFatturato />)
    expect(await riga(/Σ Totale/, 'Incidenza sull’anno')).toBeTruthy()
  })

  // Flavio: «per l'anno, per il mese che vada a selezionare io e per la
  // settimana […] volendo anche giornaliera».
  it('si guarda per anno, mese, settimana o giorno', async () => {
    const user = userEvent.setup()
    render(<AcquistiFatturato />)
    await blocco('🗂️ Distillati')

    await user.click(screen.getByRole('button', { name: 'Mese' }))
    expect(await screen.findAllByText('I SETT')).not.toHaveLength(0)
    expect(await riga(/Σ Totale/, 'Incidenza sul mese')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Settimana' }))
    expect(await screen.findAllByText('LUN')).not.toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Giorno' }))
    expect(await riga(/Σ Totale/, 'Incidenza sul giorno')).toBeTruthy()
  })

  // Un anno fa non si legge da lì fino a oggi: conti e carichi si chiedono
  // per il solo periodo mostrato. E un periodo già visto non si rilegge.
  it('legge conti e carichi del solo periodo mostrato, una volta sola', async () => {
    const user = userEvent.setup()
    render(<AcquistiFatturato />)
    await blocco('🗂️ Distillati')
    expect(api.fetchOrdersBetween).toHaveBeenLastCalledWith(`${ANNO}-01-01`, `${ANNO}-12-31`, 5)
    expect(api.fetchCarichiBetween).toHaveBeenLastCalledWith(`${ANNO}-01-01`, `${ANNO}-12-31`)

    await user.click(screen.getByRole('button', { name: 'Periodo precedente' }))
    expect(await screen.findByText(String(ANNO - 1))).toBeInTheDocument()
    expect(api.fetchOrdersBetween).toHaveBeenLastCalledWith(`${ANNO - 1}-01-01`, `${ANNO - 1}-12-31`, 5)

    await user.click(screen.getByRole('button', { name: 'Periodo successivo' }))
    await blocco('🗂️ Distillati')
    expect(api.fetchOrdersBetween).toHaveBeenCalledTimes(2)
  })

  it('sotto la tabella dice cosa sono i numeri e da dove vengono', async () => {
    render(<AcquistiFatturato />)
    await blocco('🗂️ Distillati')
    expect(screen.getByText(/al lordo dell’IVA/)).toBeInTheDocument()
    expect(screen.getByText(/lo storico del foglio non è importato/)).toBeInTheDocument()
  })
})
