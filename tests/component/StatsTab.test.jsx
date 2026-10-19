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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

// LO STORICO DI TILLER (REQ-STAT-006): vuoto, tranne dove una prova lo
// riempie. Sta fuori dal mock perché lo si cambia prova per prova.
const tiller = vi.hoisted(() => ({ serate: [], giornate: [] }))

vi.mock('../../src/lib/api.js', () => ({
  fetchOrdersBetween: vi.fn(async () => ordini),
  fetchVenditeStoriche: vi.fn(async () => tiller.giornate),
  fetchSerateStoriche: vi.fn(async () => tiller.serate),
  fetchDrinks: vi.fn(async () => [
    { id: 'd1', name: 'Negroni', category: 'COCKTAIL' },
    { id: 'd2', name: 'Amaro della casa', category: 'AMARI' },
  ]),
  fetchCashSessions: vi.fn(async () => sessioni),
  subscribeSettings: (cb) => {
    // L'orario del locale (REQ-CASSA-015): da qui partono le fasce orarie.
    cb({ business_day_cutoff_hour: 5, orario_apertura: '19:00', orario_chiusura: '02:00' })
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
    // Le righe dell'elenco, non i comandi sopra (il calendario, REQ-STAT-007).
    const righe = within(document.querySelector('.inv-list')).getAllByRole('button')
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

// Il periodo personalizzato si sceglie da «Personalizzato», con data e ora
// (REQ-STAT-003): prima le date stavano sempre sotto le pastiglie.
async function personalizzato(dalle, alle) {
  fireEvent.click(await screen.findByRole('button', { name: 'Personalizzato' }))
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Inizio'), { target: { value: dalle } })
    fireEvent.change(screen.getByLabelText('Fine'), { target: { value: alle } })
  })
}

describe('Statistiche per periodo', () => {
  beforeEach(() => vi.clearAllMocks())

  // LE PASTIGLIE DELLA SERATA NON CI SONO PIÙ: hanno una sottosezione tutta
  // loro, e tenerne una copia qui sarebbe lo stesso posto raggiunto in due
  // modi che si contraddicono.
  it('ha le scorciatoie e «Personalizzato», e non ha più la tendina delle serate', async () => {
    const m = menu()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await m.vai('periodo')
    expect(await screen.findByText(paragrafo(/dal \d\d\/\d\d\/\d{4} al \d\d\/\d\d\/\d{4}/i))).toBeTruthy()
    // LE DATE SOLO IN «PERSONALIZZATO» (Flavio, 24/09/2026: «dovrebbe
    // apparire 7, 10, 20, 30, 60 giorni e in più il tab personalizzato»).
    // Sotto le pastiglie si leggevano come un ritocco di quelle.
    expect(screen.queryByLabelText('Inizio')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Personalizzato' }))
    // E UNA COPPIA SOLA IN TUTTA LA SCHERMATA (19/09/2026): il «venduto
    // nella fascia oraria» ne aveva un'altra, e chi le trovava non sapeva
    // quale delle due comandasse.
    expect(screen.getAllByLabelText(/^(Inizio|Fine)$/)).toHaveLength(2)
    // Le pastiglie restano, ma adesso contano GIORNI e non giornate lavorate:
    // riempiono lo stesso intervallo delle due caselle, e due comandi che
    // riempiono la stessa cosa non possono contare in due modi diversi.
    expect(screen.getByRole('button', { name: '7 giorni' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /ultima chiusura/i })).toBeNull()
    expect(screen.queryByLabelText(/scegli la serata/i)).toBeNull()
    m.stop()
  })

  // LA FASCIA ORARIA PARTE DALL'ORARIO DEL LOCALE (REQ-CASSA-015), non da
  // un orario scritto nel codice; poi si cambia a mano mentre si guarda.
  it('la fascia oraria parte dall’orario di apertura e chiusura', async () => {
    const m = menu()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await m.vai('periodo')
    const dalle = await screen.findAllByLabelText('Dalle')
    expect(dalle[0]).toHaveValue('19:00')
    expect(screen.getAllByLabelText('alle')[0]).toHaveValue('02:00')
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
    // Due giornate intere: dalle 05:00 del 07 alle 05:00 del 09.
    await personalizzato('2026-08-07T05:00', '2026-08-09T05:00')
    expect(
      await screen.findByText(
        paragrafo(/dalle 05:00 di venerdì 07\/08\/2026 alle 05:00 di domenica 09\/08\/2026: 2 giornate con ordini/i)
      )
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
    await personalizzato('2026-08-08T05:00', '2026-08-09T05:00')
    expect(
      await screen.findByText(
        paragrafo(/dalle 05:00 di sabato 08\/08\/2026 alle 05:00 di domenica 09\/08\/2026: 1 giornata con ordini/i)
      )
    ).toBeTruthy()
    // Fuori la serata del 07/08, coi suoi 999 €.
    expect(kpi('Incasso')).toBe('150,00 €')
    m.stop()
  })

  // ── L'ORA DI INIZIO E DI FINE (REQ-STAT-003) ──────────────────────
  // Flavio, 24/09/2026: «oltre alla data di inizio e fine ci deve essere
  // anche l'orario di inizio e di fine, è importante perché la mia
  // giornata è a cavallo tra due giorni». Nei dati di prova la serata del
  // 08/08 ha un conto alle 21:00 (100 €) e uno all'01:30 di notte (50 €).
  it('con le ore si taglia dentro la serata', async () => {
    const m = menu()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await m.vai('periodo')
    await personalizzato('2026-08-08T20:00', '2026-08-09T01:00')
    expect(kpi('Incasso')).toBe('100,00 €')
    m.stop()
  })

  it('e si guarda anche solo la notte, oltre la mezzanotte', async () => {
    const m = menu()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await m.vai('periodo')
    await personalizzato('2026-08-09T00:00', '2026-08-09T05:00')
    expect(kpi('Incasso')).toBe('50,00 €')
    m.stop()
  })

  // Si parte da quello che si stava guardando, scritto all'ora: gli stessi
  // numeri, e da lì si ritocca.
  it('«Personalizzato» parte dal periodo che si stava guardando', async () => {
    const m = menu()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await m.vai('periodo')
    fireEvent.click(await screen.findByRole('button', { name: '7 giorni' }))
    fireEvent.click(screen.getByRole('button', { name: 'Personalizzato' }))
    expect(screen.getByLabelText('Inizio').value).toMatch(/T05:00$/)
    expect(screen.getByLabelText('Fine').value).toMatch(/T05:00$/)
    m.stop()
  })

  it('con la fine prima dell’inizio lo dice, invece di mostrare numeri', async () => {
    const m = menu()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await m.vai('periodo')
    await personalizzato('2026-08-09T05:00', '2026-08-08T05:00')
    expect(await screen.findByText(/L’ora di fine deve venire dopo quella di inizio/)).toBeTruthy()
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
    await personalizzato('2026-08-08T05:00', '2026-08-09T05:00')
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
    await personalizzato('2026-08-08T05:00', '2026-08-09T05:00')
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
    const righe = within(document.querySelector('.inv-list')).getAllByRole('button')
    expect(righe[0].textContent).toMatch(/in corso/)
    expect(righe[0].textContent).toMatch(/09\/08/)
  })
})

// LE SERATE DI TILLER (REQ-STAT-006). L'utente, 10/10/2026: i dati di
// Tiller «devono essere visibili anche tramite le schermate attuali». Ogni
// giornata di Tiller è una serata dell'elenco, dopo le chiusure dell'app.
describe('Statistiche per serata: le giornate di Tiller', () => {
  beforeEach(() => {
    tiller.serate = [
      { giorno: '2024-06-01', aperto: '2024-06-01T19:00:00.000Z', chiuso: '2024-06-01T23:20:00.000Z', incassato: 18, conti: 2 },
    ]
    tiller.giornate = [
      {
        giorno: '2024-06-01',
        conti: [
          {
            id: 'T1',
            aperto: '2024-06-01T19:00:00.000Z',
            chiuso: '2024-06-01T19:30:00.000Z',
            righe: [{ nome: 'CERES', qty: 3, prezzo: 4, sconto: 0, incasso: 12 }],
          },
          {
            id: 'T2',
            aperto: '2024-06-01T22:00:00.000Z',
            chiuso: '2024-06-01T23:20:00.000Z',
            righe: [{ nome: 'NEGRONI', qty: 1, prezzo: 6, sconto: 0, incasso: 6 }],
          },
        ],
      },
    ]
  })
  afterEach(() => {
    tiller.serate = []
    tiller.giornate = []
  })

  it('stanno nell’elenco, segnate «Tiller», coi numeri della giornata', async () => {
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    const riga = (await screen.findByText('Tiller')).closest('button')
    expect(riga.textContent.replace(/\s+/g, ' ')).toMatch(/2 conti/)
    expect(riga.textContent).toMatch(/18,00/)
  })

  it('aperta, mostra le statistiche dei suoi conti', async () => {
    const user = userEvent.setup()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await user.click((await screen.findByText('Tiller')).closest('button'))
    expect(await screen.findByText(paragrafo(/battuta su Tiller/i))).toBeTruthy()
    expect((await screen.findAllByText(/18,00/)).length).toBeGreaterThan(0)
  })
})

// LA RICERCA PER DATA NELLE SERATE (REQ-STAT-007). L'utente, 11/10/2026: un
// calendario compatto che scorre i mesi e colora i giorni col servizio e
// senza, più una casella per scrivere la data a mano.
describe('Statistiche per serata: la ricerca per data', () => {
  beforeEach(() => vi.clearAllMocks())

  it('scrivendo la data di una serata, si apre quella serata', async () => {
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-08-08' } })
    expect(await screen.findByText(paragrafo(/dall’apertura alla chiusura della cassa/i))).toBeTruthy()
  })

  it('un giorno senza servizio lo dice', async () => {
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-08-01' } })
    expect(screen.getByRole('status')).toHaveTextContent(/Nessun servizio/)
  })

  it('il calendario scorre i mesi e colora i giorni col servizio e senza', async () => {
    const user = userEvent.setup()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await user.click(screen.getByRole('button', { name: /Calendario/ }))
    for (let i = 0; i < 36 && !screen.queryByText('agosto 2026'); i++) {
      await user.click(screen.getByRole('button', { name: 'Mese precedente' }))
    }
    expect(screen.getByRole('button', { name: '2026-08-08, servizio' })).toHaveClass('servizio')
    expect(screen.getByRole('button', { name: '2026-08-01, nessun servizio' })).toHaveClass('senza')
    // Toccare un giorno col servizio apre la sua serata.
    await user.click(screen.getByRole('button', { name: '2026-08-07, servizio' }))
    expect(await screen.findByText(paragrafo(/dall’apertura alla chiusura della cassa/i))).toBeTruthy()
  })
})

// L'utente, 11/10/2026: «incasso per giornata nelle statistiche per serata
// è inutile» — una serata è una giornata sola, e quei grafici ripetono
// l'incasso. Nel periodo restano.
describe('i grafici per giornata', () => {
  beforeEach(() => vi.clearAllMocks())

  it('non ci sono nella serata', async () => {
    const user = userEvent.setup()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await user.click(rigaSerata(/08\/08/))
    await screen.findByText(paragrafo(/dall’apertura alla chiusura della cassa/i))
    expect(screen.queryByText(/Incasso per giornata/)).toBeNull()
    expect(screen.queryByText('Incasso / giornata')).toBeNull()
    expect(screen.getByText(/Incasso per fascia oraria/)).toBeInTheDocument()
  })

  it('e ci sono nel periodo', async () => {
    const m = menu()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await m.vai('periodo')
    expect(await screen.findByText(/📈 Incasso per giornata/)).toBeInTheDocument()
    m.stop()
  })
})

// «Inizio» e «Fine» di «Personalizzato» aprono il calendario dell'app, non
// quello del browser («qua vedo ancora il calendario vecchio», l'utente,
// 11/10/2026). Toccato un giorno, l'ora scritta resta.
describe('Personalizzato: il calendario dell’app su inizio e fine', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toccato un giorno nella griglia, cambia la data e resta l’ora', async () => {
    const user = userEvent.setup()
    const m = menu()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await m.vai('periodo')
    fireEvent.click(await screen.findByRole('button', { name: 'Personalizzato' }))
    const inizio = screen.getByLabelText('Inizio')
    expect(inizio.value).toMatch(/T05:00$/)
    await user.click(screen.getByRole('button', { name: 'Calendario per inizio' }))
    const giorno = inizio.value.slice(0, 10)
    const primo = `${giorno.slice(0, 7)}-01`
    const dentroIlMese = screen.queryByRole('button', { name: new RegExp(`^${primo}`) })
    if (dentroIlMese) await user.click(dentroIlMese)
    expect(screen.getByLabelText('Inizio').value).toMatch(/T05:00$/)
    if (dentroIlMese) expect(screen.getByLabelText('Inizio').value.slice(0, 10)).toBe(primo)
    m.stop()
  })
})

// «VENDUTO NELLA FASCIA ORARIA» A CATEGORIE APRIBILI. Flavio, 13/10/2026:
// «mi porta prima le categorie e poi i singoli prodotti, però tutti
// mischiati … tu metti solo le categorie, poi ci metti la freccina che se
// voglio si spacchetta e vedo tutti i prodotti del menu all'interno della
// categoria».
describe('Venduto nella fascia oraria: le categorie si aprono sui loro prodotti', () => {
  it('chiuse di partenza, con dentro i prodotti della categoria e basta', async () => {
    const m = menu()
    render(<StatsTab />)
    await screen.findByText(/tocca una serata/i)
    await m.vai('periodo')
    // La finestra dei dati di prova, come negli altri test del periodo.
    await personalizzato('2026-08-07T05:00', '2026-08-09T05:00')
    const titolo = await screen.findByText(/Venduto nella fascia oraria/)
    const scheda = titolo.closest('.card')
    const categorie = [...scheda.querySelectorAll('details.fascia-categoria')]
    // In ordine d'incasso: i Negroni valgono più degli amari.
    expect(categorie.map((d) => d.querySelector('summary').textContent)).toEqual([
      expect.stringMatching(/^COCKTAIL/),
      expect.stringMatching(/^AMARI/),
    ])
    expect(categorie.every((d) => !d.open)).toBe(true)
    // Dentro gli amari c'è solo l'amaro; niente elenco unico «Prodotti venduti».
    expect(categorie[1].textContent).toMatch(/Amaro della casa/)
    expect(categorie[1].textContent).not.toMatch(/Negroni/)
    expect(categorie[0].textContent).toMatch(/Negroni/)
    expect(within(scheda).queryByText(/Prodotti venduti/)).toBeNull()
    m.stop()
  })
})
