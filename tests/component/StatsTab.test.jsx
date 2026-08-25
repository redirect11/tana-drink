// @vitest-environment happy-dom
'use strict'

// STATISTICHE: DUE SOTTOSEZIONI. «Per serata» — la lista delle chiusure di
// cassa, e toccandone una si aprono le statistiche di quella serata — e «Per
// periodo», le ultime N giornate. La prima è quella di partenza: «è la cosa
// principale che si vuole vedere, il resto dei filtri sono secondari»
// (l'utente, 22/08/2026).
//
// La serata è la finestra di una chiusura di cassa: scavalca la mezzanotte e
// quindi non coincide con la giornata solare.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
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
    snapshot: { incassato: 150, nPagati: 2 },
  },
  {
    id: 's1',
    status: 'closed',
    opened_at: '2026-08-07T17:00:00.000Z',
    closed_at: '2026-08-07T23:00:00.000Z',
    snapshot: { incassato: 999, nPagati: 1 },
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
  settingsIniziali: () => ({ business_day_cutoff_hour: 5 }),
}))
const { default: StatsTab } = await import('../../src/components/StatsTab.jsx')
const { subscribeSottosezioni } = await import('../../src/lib/sottosezioni.js')

// La didascalia è composta da più pezzi (numero e parentesi condizionale),
// quindi si cerca sul testo completo del paragrafo.
const paragrafo = (re) => (_, el) =>
  el?.tagName === 'P' && re.test((el.textContent || '').replace(/\s+/g, ' '))

// Le sottosezioni vivono nella barra in alto (App.jsx), che qui non c'è: si
// ascolta l'elenco dichiarato dalla pagina e si chiama la sua `scegli`, che
// è quello che fa il menu quando ci si tocca sopra.
function menu() {
  let stato = { voci: [] }
  const stop = subscribeSottosezioni((s) => {
    stato = s
  })
  return {
    get voci() {
      return stato.voci
    },
    vai: async (id) => {
      await act(async () => stato.scegli(id))
    },
    stop,
  }
}

// La riga della lista: il tasto che porta il giorno della serata.
const rigaSerata = (re) => screen.getByRole('button', { name: re })

describe('Statistiche: le due sottosezioni', () => {
  beforeEach(() => vi.clearAllMocks())

  it('dichiara «Per serata» e «Per periodo», e parte dalla serata', async () => {
    const m = menu()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    expect(m.voci.map((v) => v.id)).toEqual(['serate', 'periodo'])
    expect(m.voci[0].label).toBe('Per serata')
    m.stop()
  })
})

describe('Statistiche per serata: la lista delle chiusure', () => {
  beforeEach(() => vi.clearAllMocks())

  // LA LISTA È LA SCHERMATA DI PARTENZA. Prima si apriva dritti sull'ultima
  // chiusura e per cambiarla c'era una tendina: confrontare due sabati
  // voleva dire aprirla, scegliere, leggere, riaprirla.
  it('si apre sull’elenco, la serata più recente in cima', async () => {
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    const righe = screen.getAllByRole('button')
    expect(righe[0].textContent).toMatch(/08\/08/)
    expect(righe[1].textContent).toMatch(/07\/08/)
    // Niente statistiche finché non si sceglie: la lista è la schermata.
    expect(screen.queryByText(/scontrino medio/i)).toBeNull()
  })

  // I TRE NUMERI IN RIGA: incasso, conti, scontrino medio. Con l'incasso da
  // solo due serate non si confrontano — la stessa cifra fatta da venti
  // conti o da cinque è un'altra serata.
  it('ogni riga porta incasso, conti e scontrino medio', async () => {
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    const riga = rigaSerata(/08\/08/).textContent.replace(/\s+/g, ' ')
    expect(riga).toMatch(/2 conti/)
    expect(riga).toMatch(/75,00.*medio/)
    expect(riga).toMatch(/150,00/)
  })

  it('un tocco sulla riga apre le statistiche di quella serata', async () => {
    const user = userEvent.setup()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await user.click(rigaSerata(/08\/08/))
    expect(
      await screen.findByText(paragrafo(/dall’apertura alla chiusura della cassa/i))
    ).toBeTruthy()
    // 100 + 50 della serata dell'8; i 999 della sera prima restano fuori.
    expect(screen.getAllByText(/150,00/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/999,00/)).toBeNull()
  })

  it('e da lì si torna alla lista con «← Chiusure»', async () => {
    const user = userEvent.setup()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await user.click(rigaSerata(/08\/08/))
    await screen.findByText(paragrafo(/dall’apertura alla chiusura della cassa/i))
    await user.click(screen.getByRole('button', { name: /chiusure/i }))
    expect(await screen.findByText(/tocca una serata/i)).toBeTruthy()
    // Una sola via d'uscita: tornati alla lista, non ne resta un'altra in giro.
    expect(screen.queryByRole('button', { name: /chiusure/i })).toBeNull()
  })
})

describe('Statistiche per periodo', () => {
  beforeEach(() => vi.clearAllMocks())

  // LE PASTIGLIE DELLA SERATA NON CI SONO PIÙ: hanno una sottosezione tutta
  // loro, e tenerne una copia qui sarebbe lo stesso posto raggiunto in due
  // modi che si contraddicono.
  it('ha le giornate e non ha più «Ultima chiusura» né la tendina delle serate', async () => {
    const m = menu()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await m.vai('periodo')
    expect(await screen.findByText(paragrafo(/ultime \d+ giornate/i))).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ultime 7' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /ultima chiusura/i })).toBeNull()
    expect(screen.queryByLabelText(/scegli la serata/i)).toBeNull()
    m.stop()
  })

  it('si sceglie un periodo e la didascalia lo dice', async () => {
    const user = userEvent.setup()
    const m = menu()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await m.vai('periodo')
    await user.click(await screen.findByRole('button', { name: 'Ultime 7' }))
    // Nei dati di prova ci sono 2 giornate: la didascalia dice quante ne ha.
    expect(await screen.findByText(paragrafo(/ultime 2 giornate/i))).toBeTruthy()
    m.stop()
  })

  // Tornando alla serata si RIPARTE DALLA LISTA: il dettaglio si era chiuso
  // apposta, e riaprirlo da sé vorrebbe dire non sapere più cosa fa la
  // freccia in cima.
  it('tornando a «Per serata» si riparte dalla lista', async () => {
    const user = userEvent.setup()
    const m = menu()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await user.click(rigaSerata(/08\/08/))
    await screen.findByText(paragrafo(/dall’apertura alla chiusura della cassa/i))
    await m.vai('periodo')
    await waitFor(() => expect(screen.getByText(paragrafo(/ultime \d+ giornate/i))).toBeTruthy())
    await m.vai('serate')
    expect(await screen.findByText(/tocca una serata/i)).toBeTruthy()
    m.stop()
  })
})

describe('Statistiche: la cassa ancora aperta', () => {
  beforeEach(() => vi.clearAllMocks())

  // C'È, ED È LA PRIMA RIGA. Mentre si lavora è la serata che interessa di
  // più: i suoi numeri sono quelli di adesso, e la riga lo dice invece di
  // far credere a una serata già chiusa.
  it('sta in cima alla lista, marcata «in corso»', async () => {
    const api = await import('../../src/lib/api.js')
    api.fetchCashSessions.mockResolvedValueOnce([
      { id: 's3', status: 'open', opened_at: '2026-08-09T17:00:00.000Z', closed_at: null, snapshot: {} },
      ...sessioni,
    ])
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    const righe = screen.getAllByRole('button')
    expect(righe[0].textContent).toMatch(/in corso/)
    expect(righe[0].textContent).toMatch(/09\/08/)
  })
})
