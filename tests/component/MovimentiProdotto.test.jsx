// @vitest-environment happy-dom
'use strict'

// LA MOVIMENTAZIONE DI UN PRODOTTO (REQ-MAG-048), dalla scheda del
// magazzino: i totali per tipo, il venduto mese per mese con quello di
// Tiller, e l'elenco. Il conto ha la sua prova (movimentiProdotto.test.js);
// qui si guarda la finestra.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/lib/api.js', () => ({
  fetchMovimentiProdotto: vi.fn(async () => [
    { id: 'm1', item_id: 'ceres', reason: 'ordine fornitore', type: 'load', qty: 24, unit: 'pz', created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
    { id: 'm2', item_id: 'ceres', reason: 'ordine', type: 'unload', qty: 3, unit: 'pz', created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  ]),
  fetchVendutoStoricoProdotto: vi.fn(async () => ({ '2024-06-01': 40 })),
}))

import MovimentiProdotto from '../../src/components/MovimentiProdotto.jsx'

const CERES = { id: 'ceres', name: 'Ceres', unit: 'pz' }

describe('i movimenti di un prodotto', () => {
  it('divisi per tipo, nel periodo scelto', async () => {
    render(<MovimentiProdotto item={CERES} onClose={vi.fn()} />)
    expect(await screen.findByText('Consegna ordine fornitore')).toBeInTheDocument()
    expect(screen.getAllByText('Vendite').length).toBeGreaterThan(0)
    // Le vendite di Tiller del 2024 stanno fuori dai 90 giorni.
    expect(screen.queryByText('Vendite su Tiller')).toBeNull()
  })

  it('con «Tutto» compare il venduto su Tiller, mese per mese', async () => {
    const user = userEvent.setup()
    render(<MovimentiProdotto item={CERES} onClose={vi.fn()} />)
    await screen.findByText('Consegna ordine fornitore')
    await user.click(screen.getByRole('button', { name: 'Tutto' }))
    expect(screen.getByText('Vendite su Tiller')).toBeInTheDocument()
    expect(screen.getByText('giu 2024')).toBeInTheDocument()
  })
})
