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

const stato = { aperta: null, storico: [], impostazioni: {}, movimenti: [], articoli: [], categorie: [] }

vi.mock('../../src/lib/api.js', () => ({
  subscribeSettings: (cb) => {
    cb(stato.impostazioni)
    return () => {}
  },
  settingsIniziali: () => stato.impostazioni,
  fetchInventoryItems: vi.fn(async () => stato.articoli),
  fetchInventoryCategories: vi.fn(async () => stato.categorie),
  getOpenStockCount: vi.fn(async () => stato.aperta),
  startStockCount: vi.fn(),
  salvaRimanenza: vi.fn(),
  // Come la vera: le righe e i totali della chiusura, e il prossimo.
  closeStockCount: vi.fn(async (_id, { lines }) => ({
    lines,
    totals: { cons_value: 0, rim_value: 0, diff_value: 0, counted: 0 },
    prossimo: null,
  })),
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
  stato.articoli = []
  stato.categorie = []
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
    stato.articoli = [gin]
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
    expect(api.closeStockCount.mock.calls[0][1].riapri).toBe(true)
    expect(api.startStockCount).not.toHaveBeenCalled()
    // Passa solo quello che si è scritto, con la sua ora: la differenza la
    // calcola la chiusura, coi dati di quel momento (BUG-112).
    const [riga] = api.closeStockCount.mock.calls[0][1].lines
    expect(riga.rim).toBe('3')
    expect(riga.rim_at).toEqual(expect.any(String))
  })

  // Daniele, 17/09/2026: «metti una impostazione per l'apertura automatica,
  // così può decidere se aprire a mano o in automatico». Spenta, dopo la
  // chiusura non riparte niente, e il tasto per aprirne uno torna.
  it('con la riapertura spenta, chiuso resta chiuso', async () => {
    const api = await import('../../src/lib/api.js')
    stato.impostazioni = { inventario_riapre_da_solo: false }
    stato.articoli = [{ id: 'a', name: 'Gin Mare', unit: 'pz', stock: 3 }]
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
    expect(api.closeStockCount.mock.calls[0][1].riapri).toBe(false)
    expect(api.startStockCount).not.toHaveBeenCalled()
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

// ── DEP · ACQ · CONS · RIM, COME IL FOGLIO INV (REQ-MAG-046) ────────
// Lo schema di Flavio del 25/09/2026 sera: l'ordine consegnato e il carico
// vanno in ACQ; il contenuto reale va sulla RIM, e di conseguenza sul
// consumo; il DEP non lo sposta niente.
describe('le quattro colonne', () => {
  const JAGER = { id: 'jager', name: 'Jagermeister', unit: 'pz', package_size: 1000, content_unit: 'ml', stock: 2.8, cost: 13.8, vat: 22 }
  const aperta = () => ({
    id: 'c1',
    started_at: APERTA,
    lines: [{ item_id: 'jager', name: 'Jagermeister', unit: 'pz', package_size: 1000, cost: 13.8, vat: 22, dep: 3.2, rim: null }],
  })

  it('il consumo si vede subito, prima ancora di contare', async () => {
    stato.articoli = [JAGER]
    stato.aperta = aperta()
    stato.movimenti = [{ item_id: 'jager', type: 'unload', qty: 400, unit: 'ml', reason: 'ordine', created_at: APERTA }]
    render(<StockCountPanel />)
    await screen.findByText(/Inventario in corso/)
    const riga = screen.getByText('Jagermeister').closest('.inv-row').textContent
    expect(riga).toMatch(/DEP 3,2 pz · ACQ 0 pz · CONS 0,4 pz · RIM 2,8 pz/)
  })

  // Il 400 Conigli e l'acqua del 21/09: la rettifica della chiusura
  // interrotta, e un contenuto reale, stanno sulla RIM; DEP e ACQ restano.
  it('il contenuto reale e le rettifiche non toccano DEP e ACQ', async () => {
    stato.aperta = {
      id: 'c1',
      started_at: APERTA,
      lines: [
        { item_id: 'gin', name: '400 Conigli Gin', unit: 'pz', package_size: 500, cost: 28, vat: 22, dep: -0.1, rim: null },
        { item_id: 'lete', name: 'Acqua Lete', unit: 'pz', package_size: 500, cost: 0.17, vat: 22, dep: 66, rim: null },
      ],
    }
    stato.articoli = [
      { id: 'gin', name: '400 Conigli Gin', unit: 'pz', package_size: 500, stock: 0.1 },
      { id: 'lete', name: 'Acqua Lete', unit: 'pz', package_size: 500, stock: 33 },
    ]
    stato.movimenti = [
      { item_id: 'gin', type: 'load', qty: 0.2, unit: 'pz', reason: 'conta' },
      { item_id: 'lete', type: 'unload', qty: 39, unit: 'pz', reason: 'rettifica' },
      { item_id: 'lete', type: 'load', qty: 6, unit: 'pz', reason: 'ordine fornitore' },
    ]
    render(<StockCountPanel />)
    await screen.findByText(/Inventario in corso/)
    const riga = (nome) => screen.getByText(nome).closest('.inv-row').textContent
    expect(riga('400 Conigli Gin')).toMatch(/DEP -0,1 pz · ACQ 0 pz · CONS -0,2 pz · RIM 0,1 pz/)
    expect(riga('Acqua Lete')).toMatch(/DEP 66 pz · ACQ 6 pz · CONS 39 pz · RIM 33 pz/)
  })

  it('scritto il contato, il consumo lo segue', async () => {
    stato.articoli = [JAGER]
    stato.aperta = aperta()
    render(<StockCountPanel />)
    await screen.findByText(/Inventario in corso/)
    await userEvent.type(screen.getByLabelText('Rimanenza di Jagermeister'), '0.9')
    const riga = screen.getByText('Jagermeister').closest('.inv-row').textContent
    expect(riga).toMatch(/CONS 2,3 pz/)
    scritto(/Consumo: 38,72/)
  })

  // «Una casella vuota dove vado a confermare o a modificare il valore di
  // RIM» (Flavio, 24/09): la maggior parte dei prodotti torna, e riscriverne
  // il numero a mano è un'occasione in più per sbagliarlo.
  it('col ✓ si conferma la RIM così com’è', async () => {
    const api = await import('../../src/lib/api.js')
    stato.articoli = [JAGER]
    stato.aperta = aperta()
    render(<StockCountPanel />)
    await screen.findByText(/Inventario in corso/)
    await userEvent.click(screen.getByRole('button', { name: 'Conferma la rimanenza di Jagermeister' }))
    expect(screen.getByLabelText('Rimanenza di Jagermeister').value).toBe('2.8')
    expect(api.salvaRimanenza).toHaveBeenLastCalledWith('c1', 'jager', '2.8', expect.any(String))
  })
})

// ── PER CATEGORIE, COME GLI SCAFFALI (REQ-MAG-047) ──────────────────
// Flavio, vocale del 21/09/2026: «devo passare da un ripiano a un altro
// perché sono mischiati … a me serve in ordine alfabetico, ma per
// categorie». E: «dovrebbero sempre apparire filtri sopra dove posso
// selezionare se voglio vederli tutti oppure divisi per categoria».
describe('le categorie', () => {
  const riga = (id, name) => ({ item_id: id, name, unit: 'pz', package_size: 700, cost: 10, vat: 22, dep: 1, rim: null })
  beforeEach(() => {
    // Nell'ordine in cui le dà il magazzino (sort_order): prima gli amari.
    stato.categorie = [
      { id: 'amari', name: 'AMARI', sort_order: 0 },
      { id: 'gin', name: 'GIN', sort_order: 1 },
    ]
    stato.articoli = [
      { id: 'bombay', name: 'Bombay', unit: 'pz', category_id: 'gin', stock: 1 },
      { id: 'cynar', name: 'Cynar', unit: 'pz', category_id: 'amari', stock: 1 },
      { id: 'jager', name: 'Jagermeister', unit: 'pz', category_id: 'amari', stock: 1 },
      { id: 'acqua', name: 'Acqua', unit: 'pz', stock: 1 },
    ]
    stato.aperta = {
      id: 'c1',
      started_at: APERTA,
      lines: [riga('acqua', 'Acqua'), riga('bombay', 'Bombay'), riga('cynar', 'Cynar'), riga('jager', 'Jagermeister')],
    }
  })
  const nomi = () => [...document.querySelectorAll('.inv-name')].map((n) => n.textContent)

  it('«Tutte» li mette in fila categoria per categoria, in ordine alfabetico', async () => {
    render(<StockCountPanel />)
    await screen.findByText(/Inventario in corso/)
    expect(nomi()).toEqual(['Cynar', 'Jagermeister', 'Bombay', 'Acqua'])
  })

  it('scelta una categoria, restano solo i suoi prodotti', async () => {
    render(<StockCountPanel />)
    await screen.findByText(/Inventario in corso/)
    await userEvent.click(screen.getByRole('button', { name: /GIN/ }))
    expect(nomi()).toEqual(['Bombay'])
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
    // Con l'ora del conteggio (BUG-112).
    expect(api.salvaRimanenza).toHaveBeenLastCalledWith('c1', 'a', '0.9', expect.any(String))
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
