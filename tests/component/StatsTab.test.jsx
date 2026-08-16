// @vitest-environment happy-dom
'use strict'

// Statistiche: oltre alle "ultime N giornate" si deve poter guardare UNA
// SERATA, cioè la finestra di una chiusura di cassa — che scavalca la
// mezzanotte e quindi non coincide con la giornata solare.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const ordini = [
  // Serata del 08/08: apertura 17:00, chiusura alle 02:00 del giorno dopo.
  {
    id: 'a',
    status: 'pagato',
    payment_status: 'pagato',
    created_at: '2026-08-08T19:00:00.000Z',
    paid_at: '2026-08-08T19:10:00.000Z',
    total: 100,
    discount_amount: 0,
    order_items: [{ drink_id: 'd1', name: 'Negroni', qty: 10, unit_price: 10 }],
    payments: [{ method: 'banco', amount: 100, at: '2026-08-08T19:10:00.000Z' }],
  },
  // Dopo la mezzanotte, ma SEMPRE della stessa serata.
  {
    id: 'b',
    status: 'pagato',
    payment_status: 'pagato',
    created_at: '2026-08-08T23:30:00.000Z',
    paid_at: '2026-08-08T23:40:00.000Z',
    total: 50,
    discount_amount: 0,
    order_items: [{ drink_id: 'd1', name: 'Negroni', qty: 5, unit_price: 10 }],
    payments: [{ method: 'carta', amount: 50, at: '2026-08-08T23:40:00.000Z' }],
  },
  // Serata PRECEDENTE: non deve entrare nel conto.
  {
    id: 'c',
    status: 'pagato',
    payment_status: 'pagato',
    created_at: '2026-08-07T20:00:00.000Z',
    paid_at: '2026-08-07T20:10:00.000Z',
    total: 999,
    discount_amount: 0,
    order_items: [{ drink_id: 'd1', name: 'Negroni', qty: 99, unit_price: 10 }],
    payments: [{ method: 'banco', amount: 999, at: '2026-08-07T20:10:00.000Z' }],
  },
]

const sessioni = [
  {
    id: 's2',
    status: 'closed',
    opened_at: '2026-08-08T17:00:00.000Z',
    closed_at: '2026-08-09T00:30:00.000Z',
    snapshot: { incassato: 150 },
  },
  {
    id: 's1',
    status: 'closed',
    opened_at: '2026-08-07T17:00:00.000Z',
    closed_at: '2026-08-07T23:00:00.000Z',
    snapshot: { incassato: 999 },
  },
]

vi.mock('../../src/lib/api.js', () => ({
  fetchOrdersBetween: vi.fn(async () => ordini),
  fetchDrinks: vi.fn(async () => [{ id: 'd1', name: 'Negroni', category: 'COCKTAIL' }]),
  fetchCashSessions: vi.fn(async () => sessioni),
  subscribeSettings: (cb) => {
    cb({ business_day_cutoff_hour: 5 })
    return () => {}
  },
  DEFAULT_SETTINGS: { business_day_cutoff_hour: 5 },
}))
vi.mock('../../src/components/MacroMonthlyTab.jsx', () => ({ default: () => <div /> }))

const { default: StatsTab } = await import('../../src/components/StatsTab.jsx')

// La didascalia è composta da più pezzi (numero e parentesi condizionale),
// quindi si cerca sul testo completo del paragrafo.
const paragrafo = (re) => (_, el) =>
  el?.tagName === 'P' && re.test((el.textContent || '').replace(/\s+/g, ' '))

describe('Statistiche per serata', () => {
  beforeEach(() => vi.clearAllMocks())

  // SI APRE SULL'ULTIMA CHIUSURA. La domanda del mattino dopo è «com'è
  // andata ieri sera», non «com'è andata la settimana»: prima si apriva su
  // sette giorni, che è un'altra domanda, e la serata stava in fondo alla
  // riga dei periodi.
  it('di partenza guarda l’ultima chiusura di cassa', async () => {
    render(<StatsTab />)
    expect(
      await screen.findByText(paragrafo(/dall’apertura alla chiusura della cassa/i))
    ).toBeTruthy()
    expect(screen.getByLabelText(/scegli la serata/i)).toBeTruthy()
  })

  it('e la serata sta PRIMA dei periodi a giornate', async () => {
    render(<StatsTab />)
    const chips = await screen.findAllByRole('button')
    const nomi = chips.map((b) => b.textContent)
    const iSerata = nomi.findIndex((t) => /ultima chiusura/i.test(t))
    const iSette = nomi.findIndex((t) => /^Ultime 7$/.test(t))
    expect(iSerata).toBeGreaterThanOrEqual(0)
    expect(iSerata).toBeLessThan(iSette)
  })

  it('si può passare alle ultime giornate', async () => {
    const user = userEvent.setup()
    render(<StatsTab />)
    await user.click(await screen.findByRole('button', { name: 'Ultime 7' }))
    // Nei dati di prova ci sono 2 giornate: la didascalia dice quante ne ha.
    expect(await screen.findByText(paragrafo(/ultime 2 giornate/i))).toBeTruthy()
  })

  it('offre la chiusura di cassa fra i periodi', async () => {
    render(<StatsTab />)
    expect(await screen.findByRole('button', { name: /ultima chiusura/i })).toBeTruthy()
  })

  it('tornando alla serata si rivede la finestra della cassa', async () => {
    const user = userEvent.setup()
    render(<StatsTab />)
    await user.click(await screen.findByRole('button', { name: 'Ultime 7' }))
    await user.click(await screen.findByRole('button', { name: /ultima chiusura/i }))
    // Didascalia della serata al posto delle "ultime N giornate".
    await waitFor(() =>
      expect(screen.queryByText(paragrafo(/ultime \d+ giornate/i))).toBeNull()
    )
    expect(screen.getByText(paragrafo(/dall’apertura alla chiusura della cassa/i))).toBeTruthy()
    // Elenco per scegliere un'altra serata.
    expect(screen.getByLabelText(/scegli la serata/i)).toBeTruthy()
  })

  it('la serata conta anche gli ordini dopo la mezzanotte, e solo i suoi', async () => {
    render(<StatsTab />)
    // 100 + 50 della serata dell'8; i 999 della sera prima restano fuori.
    await waitFor(() => expect(screen.getAllByText(/150,00/).length).toBeGreaterThan(0))
    expect(screen.queryByText(/999,00/)).toBeNull()
  })

  it('le due viste stanno nel menu, non in una riga sopra il contenuto', async () => {
    // Erano l'unica pagina con le sue sezioni in pagina: una riga di chip
    // che costa altezza a una schermata già fatta di tabelle.
    render(<StatsTab />)
    await screen.findByText(paragrafo(/dall’apertura alla chiusura della cassa/i))
    expect(screen.queryByRole('button', { name: /Mensile per macro/i })).toBeNull()
  })
})
