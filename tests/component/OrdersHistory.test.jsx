// @vitest-environment happy-dom
'use strict'

// STORICO ORDINI CON I CONTI DI TILLER (REQ-STAT-006). L'utente, 10/10/2026:
// «i dati devono essere visibili anche tramite le schermate attuali». Scelto
// un periodo, i conti di Tiller di quei giorni stanno nella stessa lista,
// segnati «Tiller» e in sola lettura: non c'è un conto dell'app da aprire.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))

// Il selettore delle date ha le sue prove: qui basta un tasto che sceglie il
// 1° giugno 2024.
vi.mock('../../src/components/SelettorePeriodo.jsx', () => ({
  default: ({ onChange }) => (
    <button type="button" onClick={() => onChange({ da: '2024-06-01', a: '2024-06-01', completo: true })}>
      SCEGLI 1 GIUGNO 2024
    </button>
  ),
}))

const filo = vi.hoisted(() => ({ impostazioni: {}, conti: [] }))
vi.mock('../../src/lib/api.js', () => ({
  DEFAULT_SETTINGS: { business_day_cutoff_hour: 5 },
  subscribeSettings: (cb) => {
    cb({ business_day_cutoff_hour: 5, ...filo.impostazioni })
    return () => {}
  },
  subscribeOrdersHistory: (cb) => {
    cb(filo.conti)
    return () => {}
  },
  fetchOrdersRange: vi.fn(async () => []),
  // Per i colori del calendario (REQ-STAT-007).
  fetchCashSessions: async () => [],
  fetchSerateStoriche: async () => [],
  fetchVenditeStoriche: vi.fn(async () => [
    {
      giorno: '2024-06-01',
      conti: [
        {
          id: 'T1',
          aperto: '2024-06-01T20:00:00.000Z',
          chiuso: '2024-06-01T20:30:00.000Z',
          righe: [{ nome: 'GIN TONIC', qty: 2, prezzo: 6, sconto: 0, incasso: 12, nota: null }],
        },
      ],
    },
  ]),
}))
vi.mock('../../src/lib/printer.js', () => ({ printScontrino: vi.fn(() => Promise.resolve()) }))
vi.mock('../../src/lib/toast.js', () => ({ toastSuccess: vi.fn(), toastError: vi.fn() }))

import OrdersHistory from '../../src/components/OrdersHistory.jsx'

describe('storico ordini e conti di Tiller', () => {
  it('scelto un periodo, i conti di Tiller ci sono, segnati e in sola lettura', async () => {
    const user = userEvent.setup()
    render(<OrdersHistory />)
    await user.click(screen.getByRole('button', { name: 'SCEGLI 1 GIUGNO 2024' }))
    const riga = await screen.findByRole('button', { name: /Tiller/ })
    expect(riga).toHaveTextContent('12,00')
    // Niente ristampa: lo scontrino l'ha fatto Tiller.
    expect(screen.queryByTitle('Ristampa scontrino')).toBeNull()
    // Toccandola si leggono le righe, senza aprire un conto dell'app.
    await user.click(riga)
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByText(/2 × GIN TONIC/)).toBeInTheDocument()
    expect(screen.getByText(/Battuto su Tiller/)).toBeInTheDocument()
  })

  // I conti di Tiller li batteva il locale: non sono «dai clienti».
  it('non fanno comparire il filtro dei conti dai clienti', async () => {
    const user = userEvent.setup()
    render(<OrdersHistory />)
    await user.click(screen.getByRole('button', { name: 'SCEGLI 1 GIUGNO 2024' }))
    await screen.findByRole('button', { name: /Tiller/ })
    expect(screen.queryByRole('button', { name: /Dai clienti/ })).toBeNull()
  })
})

// LO STORICO DEL PIANO FREE (REQ-LIC-003, `limiti.storico_giorni`): i conti
// chiusi più vecchi di sette giorni non si vedono — restano nel database —
// e la pagina lo dice. Un conto ancora APERTO si vede di qualunque giorno:
// è lavoro da finire, non storico. Senza limiti si vede tutto.
describe('lo storico del piano Free', () => {
  const giorniFa = (n) => new Date(Date.now() - n * 86400000).toISOString()
  beforeEach(() => {
    filo.conti = [
      { id: 'r', daily_number: 11, payment_status: 'pagato', status: 'pagato', created_at: giorniFa(2), total: 5 },
      { id: 'v', daily_number: 22, payment_status: 'pagato', status: 'pagato', created_at: giorniFa(20), total: 5 },
      { id: 'a', daily_number: 33, payment_status: 'non_richiesto', status: 'aperto', created_at: giorniFa(20), total: 5 },
    ]
  })

  it('mostra gli ultimi sette giorni, e i conti ancora aperti', async () => {
    filo.impostazioni = { licenza: { piano: 'free', limiti: { storico_giorni: 7 } } }
    render(<OrdersHistory />)
    expect(await screen.findByText('#11')).toBeInTheDocument()
    expect(screen.getByText('#33')).toBeInTheDocument()
    expect(screen.queryByText('#22')).toBeNull()
    expect(screen.getByText('Nel piano Free lo storico mostra gli ultimi 7 giorni.')).toBeInTheDocument()
  })

  it('senza limiti nella licenza si vede tutto, come sempre', async () => {
    filo.impostazioni = {}
    render(<OrdersHistory />)
    expect(await screen.findByText('#22')).toBeInTheDocument()
    expect(screen.getByText('#11')).toBeInTheDocument()
    expect(screen.queryByText(/Nel piano Free/)).toBeNull()
  })
})
