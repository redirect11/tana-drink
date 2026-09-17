// @vitest-environment happy-dom
'use strict'

// ── I DUE ELENCHI DEL PERIODO (REQ-STAT-002) ─────────────────────────
//
// Flavio, 17/09/2026: «tutti questi dati mi servirebbero in formato di
// lista, un po' la visualizzazione come sono i prodotti del magazzino».
// Uno per il magazzino — «quanto avevo di deposito, quanto ho acquistato,
// quanto ho consumato» — e uno per il menù, «una classifica di quello che
// piaceva, che me li metti in ordine».
//
// I GRAFICI CHE C'ERANO GIÀ NON BASTAVANO, ed è il motivo per cui questi
// due esistono: mostrano i primi dieci, mentre la domanda di Flavio
// riguarda anche la CODA — «cosa credevo di poter vendere e invece,
// analizzando i dati, non ho venduto» sta in fondo, dove le barre non
// arrivano.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

// Un gin comprato a bottiglie da 70 cl e versato a millilitri: è il caso in
// cui le unità dei movimenti non coincidono, e il conto deve reggerlo.
const ITEMS = [
  { id: 'gin', name: 'Gin Bosford', unit: 'pz', package_size: 700, content_unit: 'ml', stock: 4, cost: 10, vat: 22 },
  { id: 'cola', name: 'Coca Cola', unit: 'pz', package_size: null, stock: 20, cost: 1, vat: 22 },
]
const MOVIMENTI = [
  { item_id: 'gin', type: 'load', qty: 6, unit: 'pz', reason: 'ordine fornitore', created_at: '2026-06-05T09:00:00.000Z' },
  { item_id: 'gin', type: 'unload', qty: 2100, unit: 'ml', reason: 'ordine', created_at: '2026-06-20T22:00:00.000Z' },
  { item_id: 'cola', type: 'unload', qty: 5, unit: 'pz', reason: 'ordine', created_at: '2026-06-21T22:00:00.000Z' },
]

vi.mock('../../src/lib/api.js', () => ({
  fetchInventoryItems: vi.fn(async () => ITEMS),
  fetchStockMovementsSince: vi.fn(async () => MOVIMENTI),
}))

const { default: MagazzinoPeriodo } = await import('../../src/components/MagazzinoPeriodo.jsx')
const api = await import('../../src/lib/api.js')

const PERIODO = { dal: '2026-06-01', al: '2026-06-30' }
// Le colonne di una riga sono `span` attaccati: nel testo grezzo finirebbero
// incollati («Gin Bosforddeposito 1 pz»), quindi si rimettono in fila.
const righe = () =>
  [...document.querySelectorAll('.inv-row')].map((r) =>
    [...r.querySelectorAll('.inv-row-main > span')]
      .map((s) => s.textContent.replace(/[\u00a0\u202f]/g, ' ').trim())
      .filter(Boolean)
      .join(' ')
  )

beforeEach(() => vi.clearAllMocks())

describe('il magazzino nel periodo', () => {
  // NON SI CALCOLA DA SÉ. Gli altri riquadri lavorano sugli ordini già in
  // mano; questo legge tutti gli articoli e tutti i movimenti del periodo,
  // che su due mesi sono migliaia di documenti: chi apre le statistiche per
  // guardare l'incasso non deve pagarli.
  it('si apre a richiesta, e prima non legge niente', async () => {
    const user = userEvent.setup()
    render(<MagazzinoPeriodo {...PERIODO} cutoffHour={5} />)
    expect(api.fetchStockMovementsSince).not.toHaveBeenCalled()
    expect(righe()).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Calcola' }))
    expect(await screen.findByText(/Gin Bosford/)).toBeInTheDocument()
    expect(api.fetchStockMovementsSince).toHaveBeenCalledTimes(1)
  })

  // La lettura parte un giorno prima della data scelta: la giornata
  // commerciale comincia alle cinque del mattino, e la nottata che le
  // appartiene è cominciata il giorno avanti. Il taglio preciso lo fa il
  // conto, per giornata.
  it('legge con un giorno di margine, e taglia per giornata commerciale', async () => {
    const user = userEvent.setup()
    render(<MagazzinoPeriodo {...PERIODO} cutoffHour={5} />)
    await user.click(screen.getByRole('button', { name: 'Calcola' }))
    await screen.findByText(/Gin Bosford/)
    expect(api.fetchStockMovementsSince).toHaveBeenCalledWith('2026-05-31T00:00:00.000Z')
  })

  it('ogni riga dice deposito, comprato, usato e cosa resta', async () => {
    const user = userEvent.setup()
    render(<MagazzinoPeriodo {...PERIODO} cutoffHour={5} />)
    await user.click(screen.getByRole('button', { name: 'Calcola' }))
    await screen.findByText(/Gin Bosford/)
    // 2100 ml versati sono TRE bottiglie, non 2100: è la conversione che
    // rende sommabili un carico a pezzi e una vendita a millilitri.
    expect(righe()[0]).toMatch(/Gin Bosford deposito 1 pz comprato 6 pz usato 3 pz resta 4 pz/)
    expect(righe()[1]).toMatch(/Coca Cola deposito 25 pz comprato 0 pz usato 5 pz resta 20 pz/)
  })

  it('in cima quello che è costato di più, e in fondo i totali in euro', async () => {
    const user = userEvent.setup()
    render(<MagazzinoPeriodo {...PERIODO} cutoffHour={5} />)
    await user.click(screen.getByRole('button', { name: 'Calcola' }))
    await screen.findByText(/Gin Bosford/)
    // 3 gin a 12,20 fanno 36,60; 5 cole a 1,22 fanno 6,10.
    expect(righe()[0]).toContain('36,60')
    const totali = screen.getByText('Consumato nel periodo').closest('.row')
    expect(within(totali).getByText(/42,70/)).toBeInTheDocument()
  })

  // I DUE NUMERI NON COINCIDONO, E VA DETTO PRIMA. Qui il consumo è quello
  // scalato dalle ricette; quello vero lo dà la conta, contando le
  // bottiglie (l'Inventario). Senza questa riga si leggono come se dovessero tornare
  // uguali, e chi li confronta pensa a un difetto.
  it('dice che questo consumo non è quello contato sullo scaffale', async () => {
    const user = userEvent.setup()
    render(<MagazzinoPeriodo {...PERIODO} cutoffHour={5} />)
    await user.click(screen.getByRole('button', { name: 'Calcola' }))
    expect(await screen.findByText(/scalato dalle ricette battute/i)).toBeInTheDocument()
    expect(screen.getByText(/Inventario/)).toBeInTheDocument()
  })

  it('un periodo senza movimenti lo dice, invece di restare vuoto', async () => {
    api.fetchStockMovementsSince.mockResolvedValueOnce([])
    const user = userEvent.setup()
    render(<MagazzinoPeriodo {...PERIODO} cutoffHour={5} />)
    await user.click(screen.getByRole('button', { name: 'Calcola' }))
    expect(await screen.findByText(/Nessun movimento di magazzino/i)).toBeInTheDocument()
  })

  it('e se la lettura non riesce lo dice, invece di mostrare zeri', async () => {
    api.fetchStockMovementsSince.mockRejectedValueOnce(new Error('rete assente'))
    const user = userEvent.setup()
    render(<MagazzinoPeriodo {...PERIODO} cutoffHour={5} />)
    await user.click(screen.getByRole('button', { name: 'Calcola' }))
    expect(await screen.findByText(/rete assente/)).toBeInTheDocument()
  })
})
