// @vitest-environment happy-dom
'use strict'

// LA LISTA DELLE CHIUSURE DI CASSA È LA LISTA DEL MAGAZZINO.
//
// «Anche qui nei rendiconti delle chiusure di cassa serve una lista fatta
// meglio, stile quella del magazzino ma con righe più alte» (l'utente,
// 22/08/2026). Prima ogni serata era una card a sé con dentro una riga
// alta quanto il suo testo: lo stesso elenco — righe uguali che si aprono
// su un dettaglio — si leggeva in tre modi diversi in tre pagine.
//
// Qui si controlla che la lista usi DAVVERO la famiglia condivisa
// (`.inv-list`, `.inv-row`, `.inv-row-main`, `.inv-row-dettaglio`): è da
// lì che le righe prendono l'altezza del bersaglio, e una lista che si
// riscrive la sua forma se la perde senza che nessuno se ne accorga.
// E che la serata IN CORSO si riconosca a colpo d'occhio, che è l'unica
// riga della lista che sta ancora cambiando.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const sessioni = [
  // La serata di stasera: aperta, senza snapshot (nasce alla chiusura).
  {
    id: 'aperta',
    status: 'open',
    opened_at: '2026-08-22T17:00:00.000Z',
  },
  {
    id: 'chiusa',
    status: 'closed',
    opened_at: '2026-08-21T17:00:00.000Z',
    closed_at: '2026-08-22T00:30:00.000Z',
    snapshot: { incassato: 1240.5, nPagati: 31, byMethod: { contanti: 1240.5 } },
  },
  // Una serata più indietro: fra questa e quella del 21 resta scoperto il
  // 20, ed è il giorno su cui si prova la ricerca a vuoto.
  {
    id: 'vecchia',
    status: 'closed',
    opened_at: '2026-08-19T17:00:00.000Z',
    closed_at: '2026-08-19T23:00:00.000Z',
    snapshot: { incassato: 420, nPagati: 12, byMethod: { contanti: 420 } },
  },
]

vi.mock('../../src/lib/api.js', () => ({
  fetchCashSessions: vi.fn(async () => sessioni),
  fetchOrdersBetween: vi.fn(async () => []),
  fetchDrinks: vi.fn(async () => []),
  fetchInventoryItems: vi.fn(async () => []),
}))
vi.mock('../../src/lib/printer.js', () => ({ printChiusuraCassa: vi.fn(async () => {}) }))

const { default: CashSessionsList } = await import('../../src/components/CashSessionsList.jsx')

describe('la lista delle chiusure di cassa', () => {
  beforeEach(() => vi.clearAllMocks())

  it('è la lista del magazzino: stesso riquadro, stessa riga toccabile', async () => {
    const { container } = render(<CashSessionsList />)
    await screen.findByText(/1\.240,50/)
    // Il riquadro unico con le righe dentro, non una card per serata.
    expect(container.querySelector('.inv-list'), 'la lista non usa più la famiglia condivisa').not.toBe(null)
    const righe = container.querySelectorAll('.inv-list > .inv-row')
    expect(righe.length).toBe(sessioni.length)
    // La riga è il bottone della famiglia: da lì scende `--riga-lista`.
    for (const riga of righe) {
      const bottone = riga.querySelector('button.inv-row-main')
      expect(bottone, 'la riga non è più un .inv-row-main: perde l’altezza del bersaglio').not.toBe(null)
    }
  })

  it('la serata in corso si riconosce senza leggere: pastiglia e striscia', async () => {
    render(<CashSessionsList />)
    const pastiglia = await screen.findByText('in corso')
    // Non è solo un colore: c'è la parola, e la pastiglia è quella verde
    // del «sta succedendo adesso» usata anche nel registro ore.
    expect(pastiglia.className).toMatch(/\bpill\b/)
    expect(pastiglia.className).toMatch(/\blive\b/)
    // E la riga porta la striscia accesa a sinistra.
    expect(pastiglia.closest('.inv-row').className).toMatch(/\bin-corso\b/)
  })

  it('e non finge un incasso a zero finché la serata è aperta', async () => {
    // Lo snapshot nasce alla chiusura: prima al suo posto usciva «0,00 €»,
    // che in una lista di soldi si legge come «stasera non è entrato
    // niente». Meglio dire che il dato non c'è ancora.
    render(<CashSessionsList />)
    const riga = (await screen.findByText('in corso')).closest('.inv-row')
    expect(riga.textContent, 'la serata in corso dichiara un incasso che non conosce').not.toMatch(
      /0,00/
    )
    expect(riga.textContent).toMatch(/—/)
  })

  it('la serata chiusa dice quanto ha fatto, e il numero pesa', async () => {
    const { container } = render(<CashSessionsList />)
    const incasso = await screen.findByText(/1\.240,50/)
    // L'incasso è il numero che si cerca: sta in coda alla riga, con
    // l'oro dei soldi e un gradino più grande del resto.
    expect(incasso.className).toMatch(/\bprice\b/)
    expect(incasso.className).toMatch(/\bcash-sess-incasso\b/)
    expect(container.querySelector('.inv-row-cifra-fantasma')).toBe(null)
  })

  it('toccando la riga il dettaglio si apre SOTTO, dentro la stessa riga', async () => {
    const user = userEvent.setup()
    const { container } = render(<CashSessionsList />)
    const riga = (await screen.findByText(/1\.240,50/)).closest('.inv-row')
    await user.click(riga.querySelector('button.inv-row-main'))
    await waitFor(() => {
      expect(riga.querySelector('.inv-row-dettaglio'), 'il dettaglio non si apre sotto la riga').not.toBe(null)
    })
    // La riga aperta si distingue, come in magazzino.
    expect(riga.className).toMatch(/\bopen\b/)
    expect(container.querySelectorAll('.inv-row-dettaglio').length).toBe(1)
  })
})

// ── NIENTE RIQUADRO, E UN SELETTORE DI DATA ──────────────────────────
//
// «Togli il box, lascia solo la lista, e aggiungi un selettore di data per
// cercare una chiusura cassa» (l'utente, 22/08/2026).
//
// Il riquadro non separava questa lista da nient'altro — è l'unica cosa
// della sottosezione — e il titolo dentro ripeteva quello della barra in
// alto. Il selettore risponde a «com'è andata il 15 agosto?» senza far
// scorrere due mesi di righe: PORTA alla serata invece di filtrare la
// lista, perché la lista serve anche a confrontare le serate fra loro e
// filtrandola ne resterebbe una sola.
describe('le chiusure di cassa senza riquadro, con la ricerca per data', () => {
  beforeEach(() => vi.clearAllMocks())

  it('non è dentro un riquadro, e non ripete il titolo della barra', async () => {
    const { container } = render(<CashSessionsList />)
    await screen.findByText(/1\.240,50/)
    expect(container.querySelector('.card'), 'la lista è tornata dentro una card').toBe(null)
    // Il titolo della pagina sta nella barra in alto (src/lib/sezioni.js):
    // qui sarebbe la stessa parola due volte, dieci pixel più sotto.
    expect(screen.queryByText(/Chiusure di cassa/)).toBe(null)
    // E la didascalia diceva quello che la riga ha già scritto sopra.
    expect(screen.queryByText(/Una riga per serata/)).toBe(null)
  })

  it('il campo data non lascia cercare nel futuro né prima della prima chiusura', async () => {
    render(<CashSessionsList />)
    const campo = await screen.findByLabelText('Cerca per data')
    expect(campo).toHaveAttribute('type', 'date')
    // I bordi sono la prima e l'ultima serata in elenco, e vengono dalle
    // sessioni già caricate: nessuna lettura in più per saperli.
    expect(campo).toHaveAttribute('min', '2026-08-19')
    expect(campo).toHaveAttribute('max', '2026-08-22')
  })

  it('cercando una data porta alla serata: la riga si accende, la lista resta intera', async () => {
    const { container } = render(<CashSessionsList />)
    const campo = await screen.findByLabelText('Cerca per data')
    fireEvent.change(campo, { target: { value: '2026-08-21' } })

    const accesa = container.querySelector('.inv-row.trovata')
    expect(accesa, 'la serata cercata non viene evidenziata').not.toBe(null)
    expect(accesa.textContent).toMatch(/1\.240,50/)
    // Non si è filtrato niente: le altre serate sono ancora lì da
    // confrontare, ed è per questo che non serve un modo per «togliere il
    // filtro».
    expect(container.querySelectorAll('.inv-list > .inv-row').length).toBe(sessioni.length)
    // E l'esito si legge, non si deduce dal colore della riga.
    expect(screen.getByRole('status').textContent).toMatch(/evidenziata nell’elenco/)
  })

  it('la serata è quella della nottata: chi cerca il 22 non trova la serata del 21', async () => {
    // La serata del 21 chiude alle 02:30 del 22 (giornata commerciale del
    // 21). Il 22 c'è la sua serata, quella ancora aperta: se il taglio
    // fosse sbagliato uscirebbe l'incasso della sera prima.
    const { container } = render(<CashSessionsList />)
    const campo = await screen.findByLabelText('Cerca per data')
    fireEvent.change(campo, { target: { value: '2026-08-22' } })
    const accesa = container.querySelector('.inv-row.trovata')
    expect(accesa.textContent).toMatch(/in corso/)
    expect(accesa.textContent).not.toMatch(/1\.240,50/)
  })

  it('un giorno senza chiusura lo dice, e non lascia la lista muta', async () => {
    // Il locale è chiuso il lunedì: capiterà spesso, e la lista non si
    // svuota — chi ha cercato vede ancora tutte le serate.
    const { container } = render(<CashSessionsList />)
    const campo = await screen.findByLabelText('Cerca per data')
    fireEvent.change(campo, { target: { value: '2026-08-20' } })

    expect(screen.getByRole('status').textContent).toMatch(
      /Nessuna chiusura di cassa registrata/
    )
    expect(container.querySelector('.inv-row.trovata')).toBe(null)
    expect(container.querySelectorAll('.inv-list > .inv-row').length).toBe(sessioni.length)
  })
})
