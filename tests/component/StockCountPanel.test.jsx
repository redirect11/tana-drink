// @vitest-environment happy-dom
'use strict'

// LA CONTA DI MAGAZZINO, e il consumo A SETTIMANA (REQ-MAG-024).
//
// Nel foglio INV quel numero è diviso per una costante battuta a mano —
// «÷ 3», poi «÷ 2», poi «÷ 1,5», poi «÷ 4» — che si aggiorna ogni tanto e
// nel frattempo sbaglia di quanto è lontana dalla realtà. È il numero su
// cui si decide quanto ordinare, quindi l'errore non resta dov'è: qui il
// divisore sono i giorni veri del periodo, che l'app conosce perché le
// conte hanno una data.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

// Quattordici giorni tondi: 1500 ml consumati fanno 750 ml a settimana.
const APERTA = new Date(Date.now() - 14 * 86400000).toISOString()

const stato = { aperta: null, storico: [] }

vi.mock('../../src/lib/api.js', () => ({
  fetchInventoryItems: vi.fn(async () => []),
  getOpenStockCount: vi.fn(async () => stato.aperta),
  startStockCount: vi.fn(),
  updateStockCountLines: vi.fn(),
  closeStockCount: vi.fn(),
  fetchStockCounts: vi.fn(async () => stato.storico),
  fetchLoadMovementsSince: vi.fn(async () => []),
}))

import StockCountPanel from '../../src/components/StockCountPanel.jsx'

// Le righe della conta sono fatte di pezzi (DEP · ACQ · CONS · a
// settimana): il testo si legge tutto insieme, non elemento per elemento.
const scritto = (re) => expect(document.body.textContent).toMatch(re)

beforeEach(() => {
  stato.aperta = null
  stato.storico = []
})

describe('la conta aperta', () => {
  it('accanto al consumo dice quanto fa a settimana', async () => {
    stato.aperta = {
      id: 'c1',
      started_at: APERTA,
      lines: [
        // DEP 2000 − RIM 500 = 1500 ml consumati in quattordici giorni.
        // (ACQ lo ricalcola il pannello dai carichi del periodo: qui zero.)
        { item_id: 'a', name: 'Gin Mare', unit: 'ml', package_size: 1000, cost: 10, vat: 0, dep: 2000, rim: 500 },
      ],
    }
    render(<StockCountPanel />)
    expect(await screen.findByText(/Conta aperta/)).toBeInTheDocument()
    // 1500 ml in 14 giorni: 750 ml a settimana, che si scrivono «75 cl» —
    // e non un divisore fisso.
    scritto(/75 cl a settimana/)
    // E il periodo si legge in settimane, che è come si ragiona al banco.
    scritto(/2 settimane/)
  })

  // UN CONSUMO INVENTATO MANDA A ORDINARE MERCE CHE NON SERVE: una conta
  // appena aperta non ha ancora niente da dire, e non lo dice.
  it('appena aperta il numero non c’è, invece di essercene uno finto', async () => {
    stato.aperta = {
      id: 'c1',
      started_at: new Date().toISOString(),
      lines: [
        { item_id: 'a', name: 'Gin Mare', unit: 'ml', package_size: 1000, cost: 10, vat: 0, dep: 2000, rim: 1900 },
      ],
    }
    render(<StockCountPanel />)
    expect(await screen.findByText(/Conta aperta/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/a settimana/)
  })
})

describe('una conta già chiusa', () => {
  it('si riapre e ridice il consumo a settimana coi suoi giorni', async () => {
    stato.storico = [
      {
        id: 'v1',
        status: 'closed',
        started_at: '2026-06-07T00:00:00.000Z',
        closed_at: '2026-06-21T00:00:00.000Z',
        totals: { cons_value: 15 },
        lines: [
          { item_id: 'a', name: 'Gin Mare', unit: 'ml', cons: 1500, cons_value: 15 },
        ],
      },
    ]
    render(<StockCountPanel />)
    // Le conte vecchie non hanno mai avuto un consumo settimanale salvato:
    // si ricalcola dalle date, che invece ce l'hanno sempre avute.
    await userEvent.click(await screen.findByText(/2026-06-07 → 2026-06-21/))
    await screen.findByText(/Dettaglio conta/)
    scritto(/75 cl a settimana/)
  })
})
