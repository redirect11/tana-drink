// @vitest-environment happy-dom
'use strict'

// LA CHIUSURA DI CASSA E LA SUA STAMPA — il gesto più scoperto della cassa.
//
// Flavio, 28/08/2026: «quando fanno la chiusura cassa, la stampante non
// stampa lo scontrino di chiusura molto spesso». E i fatti che ha dato,
// che valgono più di qualunque lettura del codice: la stampante durante la
// serata stampa SEMPRE — comande e scontrini escono anche nelle sere lente,
// con mezz'ora fra un ordine e l'altro — e la RISTAMPA della stessa
// chiusura, dalla lista delle serate, esce subito.
//
// Quel gesto, fino a qui, non aveva UN SOLO TEST. È l'unico della cassa
// completamente scoperto, ed è dove il difetto è saltato fuori: non è un
// caso, è la regola che questo progetto si è dato — quello che non è
// provato è quello che si rompe in silenzio.
//
// Questi due test non sanno ancora QUAL È il difetto: pinzano le due
// promesse che la chiusura fa oggi, e che nessuno verificava.
//   1. chiudere cassa CHIEDE la stampa, coi dati della serata appena finita;
//   2. se la stampa fallisce, la cassa resta chiusa lo stesso E il
//      fallimento si DICE — non sparisce in silenzio.
// Se un domani qualcuno tocca quella sequenza, questi due diventano rossi
// prima che se ne accorga il banco.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const SESSIONE = {
  id: 'sessione-di-stasera',
  status: 'open',
  opened_at: '2026-08-27T17:00:00.000Z',
  opening_float: 50,
}

// Due conti pagati e nessuno aperto: la cassa si può chiudere. Con un conto
// ancora da incassare la chiusura è BLOCCATA, e sarebbe un altro test.
const CONTI = [
  {
    id: 'c1',
    status: 'chiuso',
    payment_status: 'pagato',
    payment_method: 'banco',
    total: 30,
    closed_in_session: SESSIONE.id,
    paid_at: '2026-08-27T20:00:00.000Z',
    created_at: '2026-08-27T19:50:00.000Z',
    comande: [],
  },
  {
    id: 'c2',
    status: 'chiuso',
    payment_status: 'pagato',
    payment_method: 'carta',
    total: 20,
    closed_in_session: SESSIONE.id,
    paid_at: '2026-08-27T21:00:00.000Z',
    created_at: '2026-08-27T20:50:00.000Z',
    comande: [],
  },
]

const chiusa = vi.fn()

// `api.js` si finge per intero: importarlo davvero vorrebbe dire parlare
// con Firestore al primo istante, e qui si prova una schermata, non la rete.
const IMPOSTAZIONI = { business_day_cutoff_hour: 5 }

vi.mock('../../src/lib/api.js', () => {
  return {
    DEFAULT_SETTINGS: IMPOSTAZIONI,
    subscribeSettings: (cb) => {
      cb(IMPOSTAZIONI)
      return () => {}
    },
    subscribeOpenCashSession: (cb) => {
      cb(SESSIONE)
      return () => {}
    },
    subscribeActiveOrders: (cb) => {
      cb(CONTI)
      return () => {}
    },
    openCashSession: vi.fn(),
    // Local-first: la chiusura non restituisce niente e non si aspetta.
    closeCashSession: (...a) => chiusa(...a),
  }
})

const stampaChiusura = vi.fn()
vi.mock('../../src/lib/printer.js', () => ({
  printChiusuraCassa: (...a) => stampaChiusura(...a),
}))

const avvisoErrore = vi.fn()
vi.mock('../../src/lib/toast.js', () => ({
  toastError: (...a) => avvisoErrore(...a),
  toastSuccess: vi.fn(),
}))

vi.mock('../../src/lib/firebaseClient.js', () => ({
  isFirebaseConfigured: true,
  auth: { currentUser: { email: 'flavio@tana.it', uid: 'u1' } },
  db: {},
}))

const { default: CashFlow } = await import('../../src/components/CashFlow.jsx')

const tastoChiudi = () => screen.findByRole('button', { name: /Chiudi cassa/i })

describe('la chiusura di cassa chiede la stampa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stampaChiusura.mockResolvedValue(undefined)
  })

  // IL PRIMO: che la stampa venga CHIESTA, e coi dati giusti.
  //
  // Sembra ovvio, ed è esattamente per questo che non era provato. Se un
  // giorno quella riga si perde in un rimaneggiamento della schermata, la
  // cassa continua a chiudersi e nessuno se ne accorge fino a quando
  // qualcuno, a fine serata, resta senza il suo foglio.
  it('chiudendo cassa parte lo scontrino di chiusura, con la serata dentro', async () => {
    const user = userEvent.setup()
    render(<CashFlow />)
    await user.click(await tastoChiudi())

    await waitFor(() => expect(stampaChiusura).toHaveBeenCalledTimes(1))
    const [recap, sessione] = stampaChiusura.mock.calls[0]
    // La serata è quella appena chiusa, non un'altra.
    expect(sessione.id).toBe(SESSIONE.id)
    // E il riepilogo porta i soldi veri: cinquanta incassati, due conti.
    expect(recap.incassato).toBe(50)
    expect(recap.nPagati).toBe(2)
    // La cassa si chiude comunque, e con lo stesso riepilogo che si stampa:
    // il foglio in mano e quello in archivio devono raccontare la stessa
    // serata.
    expect(chiusa).toHaveBeenCalledTimes(1)
    expect(chiusa.mock.calls[0][1].snapshot).toEqual(recap)
  })

  // IL SECONDO: che una stampa fallita NON sia silenziosa.
  //
  // È la promessa scritta nel commento del codice — «se la stampante non
  // risponde la cassa resta comunque chiusa» — e la sua metà mancante: se
  // resta chiusa ma nessuno dice che il foglio non è uscito, chi sta al
  // banco lo scopre solo cercandolo. La chiusura è l'unica stampa che non
  // si può rifare a memoria: le comande si riscrivono, lo scontrino si
  // ristampa dal conto, ma il foglio di chiusura è la fotografia di una
  // serata finita.
  it('se la stampa fallisce la cassa resta chiusa, ma il fallimento si dice', async () => {
    stampaChiusura.mockRejectedValue(new Error('stampante spenta'))
    const user = userEvent.setup()
    render(<CashFlow />)
    await user.click(await tastoChiudi())

    // La cassa è chiusa: una stampante spenta non deve tenere aperta la
    // serata.
    await waitFor(() => expect(chiusa).toHaveBeenCalledTimes(1))
    // E il banco lo viene a sapere, col motivo dentro.
    await waitFor(() => expect(avvisoErrore).toHaveBeenCalledTimes(1))
    expect(String(avvisoErrore.mock.calls[0][0])).toMatch(/stampante spenta/)
  })
})
