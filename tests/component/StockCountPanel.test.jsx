// @vitest-environment happy-dom
'use strict'

// L'INVENTARIO DI MAGAZZINO, e il consumo A SETTIMANA (REQ-MAG-024).
//
// Si chiama inventario, non «conta» (Daniele, 17/09/2026: «conta è
// fuorviante»); e chiuso uno ne parte subito un altro, perché il consumo
// che interessa è quello FRA due inventari (Flavio, stesso giorno).
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

const stato = { aperta: null, storico: [], impostazioni: {}, movimenti: [] }

vi.mock('../../src/lib/api.js', () => ({
  subscribeSettings: (cb) => {
    cb(stato.impostazioni)
    return () => {}
  },
  settingsIniziali: () => stato.impostazioni,
  fetchInventoryItems: vi.fn(async () => []),
  getOpenStockCount: vi.fn(async () => stato.aperta),
  startStockCount: vi.fn(),
  salvaRimanenza: vi.fn(),
  closeStockCount: vi.fn(),
  fetchStockCounts: vi.fn(async () => stato.storico),
  fetchStockMovementsSince: vi.fn(async () => stato.movimenti),
}))

import StockCountPanel from '../../src/components/StockCountPanel.jsx'

// Le righe della conta sono fatte di pezzi (DEP · ACQ · CONS · a
// settimana): il testo si legge tutto insieme, non elemento per elemento.
const scritto = (re) => expect(document.body.textContent).toMatch(re)

beforeEach(() => {
  vi.clearAllMocks()
  stato.aperta = null
  stato.storico = []
  stato.impostazioni = {}
  stato.movimenti = []
})

describe('l’inventario in corso', () => {
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
    expect(await screen.findByText(/Inventario in corso/)).toBeInTheDocument()
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
    expect(await screen.findByText(/Inventario in corso/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/a settimana/)
  })

  // Flavio, 17/09/2026: «quando faccio un altro inventario, lui mi chiude
  // l'inventario precedente e mi dice: hai fatto l'inventario da TOT a
  // TOT». Il periodo che conta è quello fra due chiusure: se dopo la
  // chiusura non ripartisse niente, il prossimo inventario partirebbe da
  // giacenze vecchie di un mese.
  it('chiuso, ne riapre subito un altro dalle giacenze allineate', async () => {
    const api = await import('../../src/lib/api.js')
    const gin = { id: 'a', name: 'Gin Mare', unit: 'pz', package_size: 700, stock: 3, cost: 10, vat: 22 }
    api.fetchInventoryItems.mockResolvedValue([gin])
    stato.aperta = {
      id: 'c1',
      started_at: APERTA,
      lines: [{ item_id: 'a', name: 'Gin Mare', unit: 'pz', package_size: 700, cost: 10, vat: 22, dep: 5, rim: null }],
    }
    render(<StockCountPanel />)
    await screen.findByText(/Inventario in corso/)
    await userEvent.type(screen.getByPlaceholderText(/RIM/), '3')
    await userEvent.click(screen.getByRole('button', { name: /Chiudi l’inventario/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Chiudi l’inventario' }))
    expect(api.closeStockCount).toHaveBeenCalledTimes(1)
    // IL NUOVO NASCE DENTRO LA CHIUSURA, nello stesso pacchetto (BUG-110):
    // fino al 22/09/2026 lo apriva `startStockCount` dopo, con una seconda
    // scrittura e una rilettura delle giacenze — due passi in più che una
    // chiusura interrotta poteva lasciare a metà.
    expect(api.closeStockCount.mock.calls[0][1].riapri).toEqual([gin])
    expect(api.startStockCount).not.toHaveBeenCalled()
    api.fetchInventoryItems.mockResolvedValue([])
  })

  // Daniele, 17/09/2026: «metti una impostazione per l'apertura automatica,
  // così può decidere se aprire a mano o in automatico». Spenta, dopo la
  // chiusura non riparte niente, e il tasto per aprirne uno torna.
  it('con la riapertura spenta, chiuso resta chiuso', async () => {
    const api = await import('../../src/lib/api.js')
    stato.impostazioni = { inventario_riapre_da_solo: false }
    api.fetchInventoryItems.mockResolvedValue([{ id: 'a', name: 'Gin Mare', unit: 'pz', stock: 3 }])
    stato.aperta = {
      id: 'c1',
      started_at: APERTA,
      lines: [{ item_id: 'a', name: 'Gin Mare', unit: 'pz', package_size: 700, cost: 10, vat: 22, dep: 5, rim: null }],
    }
    render(<StockCountPanel />)
    await screen.findByText(/Inventario in corso/)
    await userEvent.type(screen.getByPlaceholderText(/RIM/), '3')
    await userEvent.click(screen.getByRole('button', { name: /Chiudi l’inventario/ }))
    // La conferma non promette un inventario nuovo che non partirà.
    expect(document.body.textContent).not.toMatch(/Ne parte subito uno nuovo/)
    await userEvent.click(await screen.findByRole('button', { name: 'Chiudi l’inventario' }))
    expect(api.closeStockCount).toHaveBeenCalledTimes(1)
    expect(api.closeStockCount.mock.calls[0][1].riapri).toBe(null)
    expect(api.startStockCount).not.toHaveBeenCalled()
    api.fetchInventoryItems.mockResolvedValue([])
  })

  it('e con la riapertura spenta il tasto dice che il prossimo lo apri tu', async () => {
    stato.impostazioni = { inventario_riapre_da_solo: false }
    render(<StockCountPanel />)
    expect(await screen.findByRole('button', { name: /Apri l’inventario/ })).toBeInTheDocument()
    expect(document.body.textContent).toMatch(/il prossimo lo apri tu/)
    expect(document.body.textContent).not.toMatch(/ne parte subito un altro/)
  })

  it('senza nessun inventario si apre il primo, e si dice che poi non finisce più', async () => {
    render(<StockCountPanel />)
    expect(await screen.findByRole('button', { name: /Apri l’inventario/ })).toBeInTheDocument()
    expect(document.body.textContent).toMatch(/ne parte subito un altro/)
  })
})

// BUG-111, la foto di Flavio del 22/09/2026: «DEP −0,1 · ACQ 0,2» sul 400
// Conigli, dove lo 0,2 era la rettifica di un inventario. Gli acquisti sono
// solo merce comprata; la modifica del contenuto reale sposta il DEP.
describe('DEP e ACQ di un inventario aperto', () => {
  it('ACQ solo dagli acquisti, e il contenuto reale corretto sposta il DEP', async () => {
    stato.aperta = {
      id: 'c1',
      started_at: APERTA,
      lines: [
        { item_id: 'gin', name: '400 Conigli Gin', unit: 'pz', package_size: 500, cost: 28, vat: 22, dep: -0.1, rim: null },
        { item_id: 'lete', name: 'Acqua Lete', unit: 'pz', package_size: 500, cost: 0.17, vat: 22, dep: 66, rim: null },
      ],
    }
    stato.movimenti = [
      { item_id: 'gin', type: 'load', qty: 0.2, unit: 'pz', reason: 'conta' },
      { item_id: 'lete', type: 'unload', qty: 39, unit: 'pz', reason: 'rettifica' },
      { item_id: 'lete', type: 'load', qty: 6, unit: 'pz', reason: 'ordine fornitore' },
    ]
    render(<StockCountPanel />)
    await screen.findByText(/Inventario in corso/)
    const riga = (nome) => screen.getByText(nome).closest('.inv-row').textContent
    expect(riga('400 Conigli Gin')).toMatch(/DEP -0,1 pz · ACQ 0 pz/)
    expect(riga('Acqua Lete')).toMatch(/DEP 27 pz · ACQ 6 pz/)
  })
})

// BUG-110: il 21/09/2026 i numeri di un inventario intero stavano solo
// sullo schermo, e con la chiusura interrotta sono spariti.
describe('le rimanenze mentre si conta', () => {
  it('si salvano da sole, senza un tasto da ricordarsi', async () => {
    const api = await import('../../src/lib/api.js')
    stato.aperta = {
      id: 'c1',
      started_at: APERTA,
      lines: [{ item_id: 'a', name: 'Jagermeister', unit: 'pz', package_size: 1000, cost: 13.8, vat: 22, dep: 3.2, rim: null }],
    }
    render(<StockCountPanel />)
    await screen.findByText(/Inventario in corso/)
    expect(screen.queryByRole('button', { name: /Salva bozza/ })).toBeNull()
    const campo = screen.getByPlaceholderText(/RIM/)
    await userEvent.type(campo, '0.9')
    // Uscendo dal campo si salva subito, senza aspettare che il dito si fermi.
    await userEvent.tab()
    expect(api.salvaRimanenza).toHaveBeenLastCalledWith('c1', 'a', '0.9')
  })
})

describe('un inventario già chiuso', () => {
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
    // Le date si leggono come si scrivono, «dal 07/06/2026 al 21/06/2026»:
    // è la frase con cui Flavio descrive l'inventario, «da TOT a TOT».
    await userEvent.click(await screen.findByText(/dal 07\/06\/2026 al 21\/06\/2026/))
    await screen.findByText(/Inventario dal 07\/06\/2026 al 21\/06\/2026/)
    scritto(/75 cl a settimana/)
  })
})
