// @vitest-environment happy-dom
'use strict'

// STATISTICHE: DUE SOTTOSEZIONI. «Per serata» — la lista delle chiusure di
// cassa, e toccandone una si aprono le statistiche di quella serata — e «Per
// periodo», un intervallo di date. La prima è quella di partenza: «è la cosa
// principale che si vuole vedere, il resto dei filtri sono secondari»
// (l'utente, 22/08/2026).
//
// IL PERIODO SI SCEGLIE CON DUE DATE (REQ-STAT-002). Prima era un contatore
// di giornate all'indietro, e con quello giugno non si guarda: si guarda
// «gli ultimi 108 giorni», che è un'altra domanda (Flavio, 17/09/2026).
//
// La serata è la finestra di una chiusura di cassa: scavalca la mezzanotte e
// quindi non coincide con la giornata solare.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, act, within } from '@testing-library/react'
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
    order_items: [
      { drink_id: 'd1', name: 'Negroni', qty: 5, unit_price: 10 },
      // Tanti pezzi, pochi euro: è la voce che vince la classifica dei pezzi
      // e perde quella dell'incasso.
      { drink_id: 'd2', name: 'Amaro della casa', qty: 20, unit_price: 1 },
    ],
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
  fetchDrinks: vi.fn(async () => [
    { id: 'd1', name: 'Negroni', category: 'COCKTAIL' },
    { id: 'd2', name: 'Amaro della casa', category: 'AMARI' },
  ]),
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

// Le righe della classifica, colonna per colonna: sono `span` attaccati e
// nel testo grezzo finirebbero incollati.
const classifica = (card) =>
  [...card.querySelectorAll('.inv-row-main')].map((r) =>
    [...r.querySelectorAll(':scope > span')]
      .map((s) => s.textContent.replace(/[\u00a0\u202f]/g, ' ').trim())
      .filter(Boolean)
      .join(' ')
  )

// L'incasso del periodo è il KPI in cima. La stessa cifra compare anche
// nella classifica e nei dettagli — è lo stesso denaro contato in un altro
// modo — quindi va chiesto il riquadro, non il testo.
// Lo spazio prima dell'euro è UNIFICATORE (U+00A0): quello che esce da
// `toLocaleString` non è lo spazio che si batte sulla tastiera, e senza
// normalizzarlo due cifre identiche non risultano uguali.
const kpi = (label) =>
  screen
    .getByText(label, { selector: '.kpi-label' })
    .closest('.kpi-card')
    ?.querySelector('.kpi-value')
    ?.textContent.replace(/[\u00a0\u202f]/g, ' ')

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
  it('ha le due date, le scorciatoie, e non ha più la tendina delle serate', async () => {
    const m = menu()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await m.vai('periodo')
    expect(await screen.findByText(paragrafo(/dal \d\d\/\d\d\/\d{4} al \d\d\/\d\d\/\d{4}/i))).toBeTruthy()
    expect(screen.getByLabelText('Dal')).toBeTruthy()
    expect(screen.getByLabelText('Al')).toBeTruthy()
    // Le date della fascia oraria sono un'altra cosa e hanno un'altra
    // etichetta: due uguali a schermo si scambiano per la stessa.
    expect(screen.getByLabelText('Dal giorno')).toBeTruthy()
    // Le pastiglie restano, ma adesso contano GIORNI e non giornate lavorate:
    // riempiono lo stesso intervallo delle due caselle, e due comandi che
    // riempiono la stessa cosa non possono contare in due modi diversi.
    expect(screen.getByRole('button', { name: '7 giorni' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /ultima chiusura/i })).toBeNull()
    expect(screen.queryByLabelText(/scegli la serata/i)).toBeNull()
    m.stop()
  })

  // È LA RICHIESTA DI FLAVIO: «un inizio periodo, fine periodo … così riesco
  // a vedere realmente la fascia di periodo che mi interessa, così come può
  // essere il giugno». Qui si sceglie la finestra dei dati di prova.
  it('si scrivono le due date e si guarda quell’intervallo', async () => {
    const m = menu()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await m.vai('periodo')
    await screen.findByLabelText('Dal giorno')
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Dal'), { target: { value: '2026-08-07' } })
      fireEvent.change(screen.getByLabelText('Al'), { target: { value: '2026-08-08' } })
    })
    expect(
      await screen.findByText(paragrafo(/dal 07\/08\/2026 al 08\/08\/2026: 2 giornate con ordini su 2/i))
    ).toBeTruthy()
    // 999 + 150: dentro ci sono tutte e due le serate dei dati di prova.
    expect(kpi('Incasso')).toBe('1.149,00 €')
    m.stop()
  })

  // Un giorno solo è un periodo come un altro, e la didascalia lo dice al
  // singolare invece di scrivere «1 giornate».
  it('e restringendo a una sola giornata resta quella', async () => {
    const m = menu()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await m.vai('periodo')
    await screen.findByLabelText('Dal giorno')
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Dal'), { target: { value: '2026-08-08' } })
      fireEvent.change(screen.getByLabelText('Al'), { target: { value: '2026-08-08' } })
    })
    expect(
      await screen.findByText(paragrafo(/dal 08\/08\/2026 al 08\/08\/2026: 1 giornata con ordini su 1/i))
    ).toBeTruthy()
    // Fuori la serata del 07/08, coi suoi 999 €.
    expect(kpi('Incasso')).toBe('150,00 €')
    m.stop()
  })

  // ── LA CLASSIFICA DEL VENDUTO (REQ-STAT-002) ──────────────────────
  // «Una classifica di quello che piaceva, che me li metti in ordine, in modo
  // tale capisco cosa ho venduto di più» (Flavio, 17/09/2026). I grafici che
  // c'erano già mostrano i primi dieci: la domanda riguarda anche la coda.
  it('elenca tutte le voci battute, dalla più venduta', async () => {
    const m = menu()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await m.vai('periodo')
    await screen.findByLabelText('Dal')
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Dal'), { target: { value: '2026-08-08' } })
      fireEvent.change(screen.getByLabelText('Al'), { target: { value: '2026-08-08' } })
    })
    const lista = (await screen.findByText('🏆 Classifica del venduto')).closest('.card')
    // Venti amari battono quindici negroni, a pezzi.
    expect(classifica(lista)).toEqual(['1 Amaro della casa 20 pz 20,00 €', '2 Negroni 15 pz 150,00 €'])
    m.stop()
  })

  // DUE CLASSIFICHE, NON UNA: venti amari da un euro battono quindici
  // negroni a pezzi e perdono a incasso, e sono due risposte diverse alla
  // stessa serata.
  it('e si può ordinare per incasso invece che per pezzi', async () => {
    const user = userEvent.setup()
    const m = menu()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await m.vai('periodo')
    await screen.findByLabelText('Dal')
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Dal'), { target: { value: '2026-08-08' } })
      fireEvent.change(screen.getByLabelText('Al'), { target: { value: '2026-08-08' } })
    })
    const lista = (await screen.findByText('🏆 Classifica del venduto')).closest('.card')
    await user.click(within(lista).getByRole('button', { name: 'Ordina per incasso' }))
    expect(classifica(lista)).toEqual(['1 Negroni 15 pz 150,00 €', '2 Amaro della casa 20 pz 20,00 €'])
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
    await waitFor(() => expect(screen.getByText(paragrafo(/giornate con ordini/i))).toBeTruthy())
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
