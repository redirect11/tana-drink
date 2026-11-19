// @vitest-environment happy-dom
'use strict'

// STATISTICHE E BILANCIO IN INGLESE NON HANNO ITALIANO A SCHERMO (REQ-UI-039).
//
// Daniele, 17/11/2026: la lingua del gestionale la sceglie chi ci lavora.
// Le statistiche e il bilancio sono le schermate del gestore — tabelle,
// didascalie, spiegazioni a scomparsa — e con la lingua inglese non deve
// restarci una parola d'italiano: né un testo passato da `tr` che non trova
// la sua traduzione, né uno che `tr` non l'ha mai visto.
//
// Si aprono così come le vede il gestore, coi casi che mostrano più testo:
// la lista delle chiusure col calendario aperto, le statistiche di una
// serata e quelle di un periodo personalizzato, il rendiconto di una
// chiusura nelle sue due viste, il bilancio del mese con l'extra del minimo,
// «Acquisti × Fatturato», «Venduto × Incassato» e il riepilogo dell'ordine
// ai fornitori. I dati finti non hanno parole italiane: «Negroni»,
// «Spritz», «Nova».
//
// Anche i nomi di mesi e giorni e le scorciatoie del periodo, che vengono
// da src/lib (periodo.js, periodiBilancio.js, bilancioMesi.js, stats.js),
// sono tradotti: qui non si mette da parte niente.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { italianoRimasto } from '../helpers/nienteItaliano.js'

// Le date attorno a oggi: le statistiche guardano gli ultimi giorni, e una
// data fissa uscirebbe dalla finestra col passare dei mesi.
const ISTANTE = (giorni, ora) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + giorni)
  d.setUTCHours(ora, 0, 0, 0)
  return d.toISOString()
}

const ORDINI = [
  {
    id: 'o1',
    daily_number: 1,
    customer_name: 'Mario',
    status: 'pagato',
    payment_status: 'pagato',
    payment_method: 'carta',
    service_mode: 'tavolo',
    created_at: ISTANTE(-2, 19),
    paid_at: ISTANTE(-2, 19),
    total: 30,
    discount_amount: 3,
    order_items: [
      { drink_id: 'd1', name: 'Negroni', qty: 2, unit_price: 10 },
      { drink_id: 'd2', name: 'Spritz', qty: 2, unit_price: 6.5 },
    ],
    payments: [{ method: 'carta', amount: 30, at: ISTANTE(-2, 19) }],
  },
  {
    id: 'o2',
    daily_number: 2,
    status: 'pagato',
    payment_status: 'pagato',
    payment_method: 'banco',
    service_mode: 'banco',
    created_at: ISTANTE(-2, 22),
    paid_at: ISTANTE(-2, 22),
    total: 20,
    discount_amount: 0,
    order_items: [{ drink_id: 'd1', name: 'Negroni', qty: 2, unit_price: 10 }],
    payments: [{ method: 'banco', amount: 20, at: ISTANTE(-2, 22) }],
  },
]
const SESSIONI = [
  { id: 's1', status: 'closed', opened_at: ISTANTE(-2, 17), closed_at: ISTANTE(-1, 1), snapshot: { incassato: 50, nPagati: 2 } },
]
const DRINK = [
  {
    id: 'd1',
    name: 'Negroni',
    category: 'COCKTAIL',
    recipe_items: [{ inventory_item_id: 'gin', unit: 'ml', qty: 30 }],
  },
  // Senza ricetta: il costo è incompleto, e compaiono le avvertenze.
  { id: 'd2', name: 'Spritz', category: 'APERITIF' },
]
const PRODOTTI = [{ id: 'gin', name: 'Gin', unit: 'ml', package_size: 700, cost: 21, vat: 22 }]
const MACRO = [{ id: 'm1', name: 'Spirits', pesi_voci: { d1: 100 }, pesi_prodotti: { gin: 100 } }]
const IMPOSTAZIONI = { business_day_cutoff_hour: 5, sale_vat: 10, orario_apertura: '19:00', orario_chiusura: '02:00' }

vi.mock('../../src/lib/api.js', () => ({
  DEFAULT_SETTINGS: { business_day_cutoff_hour: 5, sale_vat: 10 },
  settingsIniziali: () => ({ business_day_cutoff_hour: 5, sale_vat: 10 }),
  subscribeSettings: (cb) => {
    cb(IMPOSTAZIONI)
    return () => {}
  },
  fetchOrdersBetween: async () => ORDINI,
  fetchVenditeStoriche: async () => [],
  fetchSerateStoriche: async () => [],
  fetchDrinks: async () => DRINK,
  fetchInventoryItems: async () => PRODOTTI,
  fetchStockMovementsSince: async () => [],
  fetchCashSessions: async () => SESSIONI,
  fetchMacroCategories: async () => MACRO,
  fetchPurchaseOrders: async () => [],
  fetchCarichiBetween: async () => [],
  fetchSupplierInvoices: async () => [],
  fetchAltreSpese: async () => [],
  fetchFoglioMese: async () => null,
  subscribeStaffRates: () => () => {},
  subscribeStaffHoursRange: () => () => {},
  subscribeStaffShiftsRange: () => () => {},
  // L'extra del minimo sul primo del mese: il giorno si tocca e si apre il
  // dialogo per scriverlo.
  subscribeMinimiExtra: (mese, cb) => {
    cb({ [`${mese}-01`]: 400 })
    return () => {}
  },
  salvaExtraMinimo: () => {},
}))
// Il calendario dei periodi chiede i giorni di servizio: nessuno.
vi.mock('../../src/lib/giorniDiServizio.js', () => ({ fetchGiorniDiServizio: async () => new Set() }))

const { impostaLingua } = await import('../../src/lib/lingua.js')
const { subscribeSottosezioni } = await import('../../src/lib/sottosezioni.js')
const { default: StatsTab } = await import('../../src/components/StatsTab.jsx')
const { default: RendicontoSerata } = await import('../../src/components/RendicontoSerata.jsx')
const { default: BilancioTab } = await import('../../src/components/BilancioTab.jsx')
const { default: AcquistiFatturato } = await import('../../src/components/AcquistiFatturato.jsx')
const { default: MacroMonthlyTab } = await import('../../src/components/MacroMonthlyTab.jsx')
const { default: RiepilogoOrdini } = await import('../../src/components/RiepilogoOrdini.jsx')
const { default: SelettorePeriodo } = await import('../../src/components/SelettorePeriodo.jsx')

afterEach(() => {
  cleanup()
  impostaLingua('it')
})

// Le sottosezioni stanno nella barra in alto (App.jsx), che qui non c'è: si
// sceglie dall'elenco che la pagina dichiara, come fa il menu.
function sottosezioni() {
  let stato = { voci: [] }
  const stop = subscribeSottosezioni((s) => {
    stato = s
  })
  return {
    get voci() {
      return stato.voci.map((v) => v.label)
    },
    vai: (id) => act(async () => stato.scegli(id)),
    stop,
  }
}

describe('statistiche e bilancio in inglese (REQ-UI-039)', () => {
  it('le statistiche: la lista delle chiusure, una serata, un periodo personalizzato', async () => {
    impostaLingua('en')
    const user = userEvent.setup()
    const menu = sottosezioni()
    const { container } = render(<StatsTab />)

    await screen.findByText('Tap an evening to see its statistics.')
    expect(menu.voci).toEqual(['By evening', 'By period'])
    await user.click(screen.getByRole('button', { name: /Calendar/ }))
    expect(italianoRimasto(container)).toEqual([])

    // Una serata: le statistiche coi dettagli, i conti, la classifica.
    await user.click(within(container.querySelector('.inv-list')).getAllByRole('button')[0])
    await screen.findByText(/^Evening of /)
    expect(screen.getByText('Sales ranking')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])

    // Il periodo: le pastiglie, poi «Personalizzato» col calendario aperto.
    await menu.vai('periodo')
    await screen.findByRole('button', { name: '10 days' })
    expect(italianoRimasto(container)).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Custom' }))
    await user.click(screen.getByRole('button', { name: 'Calendar for start' }))
    expect(screen.getByText(/^From .* on \w+day /)).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
    menu.stop()
  })

  it('il rendiconto di una chiusura, a card, a tabella e cumulativo', async () => {
    impostaLingua('en')
    const user = userEvent.setup()
    const { container } = render(
      <RendicontoSerata
        session={SESSIONI[0]}
        orders={ORDINI}
        drinksById={Object.fromEntries(DRINK.map((d) => [d.id, d]))}
        itemsById={Object.fromEntries(PRODOTTI.map((p) => [p.id, p]))}
        recap={{ byMethod: { carta: 30, banco: 20 } }}
        onClose={() => {}}
      />
    )
    expect(screen.getByText('Till closure report')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
    // La tabella con un conto aperto sui suoi prodotti.
    await user.click(container.querySelector('.rend-riga'))
    expect(italianoRimasto(container)).toEqual([])
    // A card, con un conto aperto.
    await user.click(screen.getByRole('button', { name: /List/ }))
    await user.click(container.querySelector('.rend-card-head'))
    expect(italianoRimasto(container)).toEqual([])
    // Il cumulativo per prodotto.
    await user.click(screen.getByRole('button', { name: /Cumulative sales/ }))
    expect(italianoRimasto(container)).toEqual([])
  })

  it('il bilancio del mese, con l’extra del minimo aperto', async () => {
    impostaLingua('en')
    const user = userEvent.setup()
    const menu = sottosezioni()
    const { container } = render(<BilancioTab />)
    expect(menu.voci).toEqual(['Months', 'Purchases × Revenue', 'Sold × Takings'])
    await screen.findByText(/Σ The month/)
    expect(italianoRimasto(container)).toEqual([])
    await user.click(screen.getAllByRole('button', { name: /^Minimum extra, / })[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
    menu.stop()
  })

  it('acquisti e fatturato, al lordo e al netto', async () => {
    impostaLingua('en')
    const user = userEvent.setup()
    const { container } = render(<AcquistiFatturato />)
    await screen.findByText('Spirits')
    expect(italianoRimasto(container)).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Net of VAT' }))
    expect(italianoRimasto(container)).toEqual([])
  })

  it('venduto e incassato per macro', async () => {
    impostaLingua('en')
    const { container } = render(<MacroMonthlyTab />)
    await screen.findByText('Spirits')
    expect(screen.getAllByText('Share').length).toBeGreaterThan(0)
    expect(italianoRimasto(container)).toEqual([])
  })

  it('il riepilogo dell’ordine ai fornitori, da confermare e confermato', () => {
    impostaLingua('en')
    const fetta = (chiave, nome) => ({
      chiave,
      supplier_name: nome,
      righe: [{ key: `${chiave}-1`, item_name: 'Campari', qty: 2, pezzi: 2, unit_cost: 10, totale: 20 }],
      totali: { pieces: 2, gross: 20 },
    })
    const { container } = render(
      <RiepilogoOrdini fette={[fetta('a', 'Nova'), fetta('b', null)]} confermati={{ b: { bozza: true } }} />
    )
    expect(screen.getByText('Order summary')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  // Le scorciatoie del periodo («Ultimi 30 giorni»…) le scrive
  // lib/periodo.js già nella lingua in uso.
  it('il calendario del periodo, aperto', async () => {
    impostaLingua('en')
    const user = userEvent.setup()
    const oggi = new Date().toISOString().slice(0, 10)
    const { container } = render(
      <SelettorePeriodo periodo={{ da: oggi, a: oggi, completo: true }} onChange={() => {}} oggi={oggi} servizio={new Set()} />
    )
    expect(screen.getByRole('button', { name: /Today/ })).toBeInTheDocument()
    await user.click(container.querySelector('.periodo-apri'))
    expect(screen.getByRole('button', { name: 'Clear the date filter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Last 30 days' })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })
})
