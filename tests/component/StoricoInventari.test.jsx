// @vitest-environment happy-dom
'use strict'

// LO STORICO INVENTARI (REQ-MAG-052). Flavio, 15/10/2026: «un tab che si
// chiamerà storico inventari, dove una volta che lo premo mi appare la
// lista degli inventari con la data di apertura e la data di chiusura, e se
// voglio ci clicco sopra e lo vedo; ovviamente la casella rimanenze
// risulta bloccata … e mi vado a vedere tutti i consumi che ho fatto in
// quel periodo».
// Prima gli inventari chiusi stavano in fondo all'inventario in corso,
// quindici al massimo, e aperti dicevano solo il consumo.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const stato = { storico: [], articoli: [], categorie: [] }

vi.mock('../../src/lib/api.js', () => ({
  fetchStockCounts: vi.fn(async () => stato.storico),
  fetchInventoryItems: vi.fn(async () => stato.articoli),
  fetchInventoryCategories: vi.fn(async () => stato.categorie),
}))

import StoricoInventari from '../../src/components/StoricoInventari.jsx'
import * as api from '../../src/lib/api.js'

const scritto = (re) => expect(document.body.textContent).toMatch(re)

// Quattordici giorni tondi: 1500 ml consumati fanno 750 ml a settimana.
const CHIUSO = {
  id: 'v1',
  status: 'closed',
  started_at: '2026-06-07T00:00:00.000Z',
  closed_at: '2026-06-21T00:00:00.000Z',
  totals: { counted: 1, cons_value: 15, rim_value: 5 },
  lines: [
    { item_id: 'gin', name: 'Gin Mare', unit: 'ml', dep: 2000, acq: 0, rim: 480, rim_adesso: 500, atteso: 500, cons: 1500, cons_value: 15, rim_value: 5 },
    { item_id: 'cynar', name: 'Cynar', unit: 'pz', dep: 3, acq: 1, rim: null, atteso: 2, cons: 2, cons_value: 20, rim_value: 20 },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  stato.storico = []
  stato.articoli = [
    { id: 'gin', name: 'Gin Mare', unit: 'ml', category_id: 'gin', stock: 500 },
    { id: 'cynar', name: 'Cynar', unit: 'pz', category_id: 'amari', stock: 2 },
  ]
  // Nell'ordine del magazzino (sort_order): prima gli amari.
  stato.categorie = [
    { id: 'amari', name: 'AMARI', sort_order: 0 },
    { id: 'gin', name: 'GIN', sort_order: 1 },
  ]
})

describe('l’elenco', () => {
  it('senza inventari chiusi lo dice', async () => {
    render(<StoricoInventari />)
    expect(await screen.findByText(/Nessun inventario chiuso/)).toBeInTheDocument()
  })

  it('mostra ogni inventario chiuso con le due date, i contati e i valori; quello aperto no', async () => {
    stato.storico = [{ id: 'aperto', status: 'open', started_at: '2026-06-21T00:00:00.000Z', lines: [] }, CHIUSO]
    render(<StoricoInventari />)
    const riga = await screen.findByRole('button', { name: /dal 07\/06\/2026 al 21\/06\/2026/ })
    expect(riga.textContent).toMatch(/2 settimane/)
    expect(riga.textContent).toMatch(/contati 1\/2/)
    expect(riga.textContent).toMatch(/rimanenze 5,00\s€/)
    expect(riga.textContent).toMatch(/consumo 15,00\s€/)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(api.fetchStockCounts).toHaveBeenCalledWith({ limit: 20, prima: null })
  })

  // Un inventario è un documento da quattrocento righe: «tutti» si
  // caricano a pagine, e la pagina dopo parte dall'ultimo in mano.
  it('a pagine: «Mostra altri» continua dall’ultimo inventario', async () => {
    const pagina = Array.from({ length: 20 }, (_, i) => ({
      ...CHIUSO,
      id: `p${i}`,
      started_at: `2026-05-${String(20 - i).padStart(2, '0')}T00:00:00.000Z`,
      closed_at: `2026-05-${String(21 - i).padStart(2, '0')}T00:00:00.000Z`,
    }))
    api.fetchStockCounts.mockImplementationOnce(async () => pagina).mockImplementationOnce(async () => [CHIUSO])
    render(<StoricoInventari />)
    await userEvent.click(await screen.findByRole('button', { name: /Mostra altri/ }))
    expect(api.fetchStockCounts).toHaveBeenLastCalledWith({ limit: 20, prima: '2026-05-01T00:00:00.000Z' })
    expect(await screen.findByRole('button', { name: /dal 07\/06\/2026 al 21\/06\/2026/ })).toBeInTheDocument()
    // L'ultima pagina era corta: non c'è altro da mostrare.
    expect(screen.queryByRole('button', { name: /Mostra altri/ })).toBeNull()
  })
})

describe('un inventario aperto dallo storico', () => {
  const apri = async () => {
    stato.storico = [CHIUSO]
    render(<StoricoInventari />)
    await userEvent.click(await screen.findByRole('button', { name: /dal 07\/06\/2026 al 21\/06\/2026/ }))
    await screen.findByText(/Inventario dal 07\/06\/2026 al 21\/06\/2026/)
  }
  const nomi = () => [...document.querySelectorAll('.inv-name')].map((n) => n.textContent)

  it('è la schermata dell’inventario, con DEP · ACQ · CONS · RIM e il consumo a settimana', async () => {
    await apri()
    scritto(/2 settimane · contati 1\/2/)
    scritto(/Valore rimanenze: 5,00\s€ · Consumo: 15,00\s€/)
    // La RIM è quella alla chiusura (500), non il contato delle 18 (480).
    scritto(/DEP 2 L · ACQ 0 ml · CONS 1,5 L · RIM 50 cl · 75 cl a settimana/)
    scritto(/DEP 3 pz · ACQ 1 pz · CONS 2 pz · RIM 2 pz · 1 pz a settimana/)
  })

  it('la casella della rimanenza c’è, col contato di allora, e non si scrive', async () => {
    await apri()
    const gin = screen.getByLabelText('Rimanenza di Gin Mare')
    expect(gin).toBeDisabled()
    expect(gin).toHaveValue(500)
    // Un prodotto non contato ha la casella vuota, come quando si contava.
    const cynar = screen.getByLabelText('Rimanenza di Cynar')
    expect(cynar).toBeDisabled()
    expect(cynar).toHaveValue(null)
  })

  it('le righe stanno per categoria, nell’ordine del magazzino, e si filtrano', async () => {
    await apri()
    expect(nomi()).toEqual(['Cynar', 'Gin Mare'])
    await userEvent.click(screen.getByRole('button', { name: /GIN/ }))
    expect(nomi()).toEqual(['Gin Mare'])
  })

  it('si torna all’elenco', async () => {
    await apri()
    await userEvent.click(screen.getByRole('button', { name: /Tutti gli inventari/ }))
    expect(await screen.findByText(/Inventari chiusi/)).toBeInTheDocument()
  })
})
