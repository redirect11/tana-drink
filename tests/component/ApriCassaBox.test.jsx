// @vitest-environment happy-dom
'use strict'

// APRIRE LA CASSA DA DOVE CI SI TROVA. A inizio serata la cassa si apre e
// basta: mandare chi sta al banco nel flusso di cassa per premere un tasto
// e tornare indietro sono tre passaggi per una cosa che ne vale uno.
// «Annulla» lascia tutto com'è — aprire una serata per sbaglio, col fondo
// sbagliato, si sistema solo chiudendo e riaprendo.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/lib/api.js', () => ({
  openCashSession: vi.fn(() => Promise.resolve()),
  // Le associazioni per account stanno qui: la cassa le legge dalla cache,
  // senza aspettare la rete.
  settingsIniziali: () => stato.impostazioni,
  subscribeSettings: (cb) => {
    cb(stato.impostazioni)
    return () => {}
  },
}))
vi.mock('../../src/lib/toast.js', () => ({ toastError: vi.fn() }))

// L'elenco degli admin arriva da una Cloud Function: qui si comanda cosa
// sa il tablet, perché è proprio quello che decide se la domanda compare.
const stato = { staff: [], impostazioni: {} }
vi.mock('../../src/lib/staffApi.js', () => ({
  staffFromCache: () => stato.staff,
  listStaff: vi.fn(async () => stato.staff),
}))

import ApriCassaBox from '../../src/components/ApriCassaBox.jsx'
import { openCashSession } from '../../src/lib/api.js'

const FLAVIO = { uid: 'u-flavio', email: 'flavio@bar.it', name: 'Flavio', role: 'admin' }
const VITTORIO = { uid: 'u-vittorio', email: 'vittorio@bar.it', name: 'Vittorio', role: 'admin' }

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  localStorage.clear()
  stato.staff = []
  stato.impostazioni = {}
})

describe('il box «apri la cassa»', () => {
  it('apre con il fondo scritto, e poi si chiude', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ApriCassaBox cutoffHour={5} by={{ uid: 'u1' }} onClose={onClose} />)
    await user.type(screen.getByLabelText(/Fondo cassa/), '50')
    await user.click(screen.getByRole('button', { name: /^Apri cassa$/ }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(openCashSession).toHaveBeenCalledWith({ by: { uid: 'u1' }, fondo: 50, cutoffHour: 5 })
  })

  it('il fondo è facoltativo: non tutti lo mettono', async () => {
    const user = userEvent.setup()
    render(<ApriCassaBox cutoffHour={5} by={null} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /^Apri cassa$/ }))
    await waitFor(() => expect(openCashSession).toHaveBeenCalled())
    expect(openCashSession.mock.calls[0][0].fondo).toBe(0)
  })

  // LE ASSOCIAZIONI SONO PER ACCOUNT (Daniele, 19/09/2026): col login di
  // Flavio si sceglie fra chi è associato a lui, e col login di un altro
  // l'elenco è un altro.
  it('con le associazioni, l’elenco è quello dell’account collegato', async () => {
    stato.staff = [FLAVIO, VITTORIO, { uid: 'u-dani', email: 'd@bar.it', name: 'Daniele', role: 'admin' }]
    stato.impostazioni = { admin_associati: { 'u-flavio': ['u-vittorio'] } }
    render(<ApriCassaBox cutoffHour={5} by={{ uid: 'u-flavio', email: 'flavio@bar.it' }} onClose={vi.fn()} />)
    expect(screen.getByText('Chi apre la cassa?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vittorio' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Flavio' })).toBeInTheDocument()
    // Daniele non è associato a Flavio: col suo login non c'è.
    expect(screen.queryByRole('button', { name: 'Daniele' })).toBeNull()
  })

  // ── E CHI LA APRE? (REQ-STAFF-016) ──────────────────────────────
  // «Ad ogni apertura di cassa verrà chiesto se sta aprendo Flavio o
  // Vittorio» (Flavio, 11/09/2026). Il tablet resta collegato con un
  // account solo; la serata la firma chi c'è davvero.
  it('con più admin chiede chi apre, e la serata la firma lui', async () => {
    const user = userEvent.setup()
    stato.staff = [FLAVIO, VITTORIO]
    render(<ApriCassaBox cutoffHour={5} by={{ uid: 'u-flavio', email: 'flavio@bar.it' }} onClose={vi.fn()} />)
    expect(screen.getByText('Chi apre la cassa?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Vittorio' }))
    await user.click(screen.getByRole('button', { name: /^Apri cassa$/ }))
    await waitFor(() => expect(openCashSession).toHaveBeenCalled())
    expect(openCashSession.mock.calls[0][0].by).toEqual({
      uid: 'u-vittorio',
      email: 'vittorio@bar.it',
      name: 'Vittorio',
    })
  })

  // NON SI RICHIEDE OGNI SERA DA CAPO: il tablet si ricorda chi ci
  // lavorava, ed è la risposta già pronta alla riapertura.
  it('e se lo ricorda: la volta dopo è già scelto lui', async () => {
    const user = userEvent.setup()
    stato.staff = [FLAVIO, VITTORIO]
    const by = { uid: 'u-flavio', email: 'flavio@bar.it' }
    render(<ApriCassaBox cutoffHour={5} by={by} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Vittorio' }))
    await user.click(screen.getByRole('button', { name: /^Apri cassa$/ }))
    await waitFor(() => expect(openCashSession).toHaveBeenCalled())

    cleanup()
    vi.clearAllMocks()
    render(<ApriCassaBox cutoffHour={5} by={by} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Vittorio' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: /^Apri cassa$/ }))
    await waitFor(() => expect(openCashSession).toHaveBeenCalled())
    expect(openCashSession.mock.calls[0][0].by.name).toBe('Vittorio')
  })

  // Con un admin solo la domanda non ha senso: una risposta sola, chiesta
  // ogni sera, è un tocco in più per niente.
  it('con un admin solo non chiede niente', async () => {
    const user = userEvent.setup()
    stato.staff = [FLAVIO, { uid: 'u-giulia', name: 'Giulia', role: 'bartender' }]
    const by = { uid: 'u-flavio', email: 'flavio@bar.it' }
    render(<ApriCassaBox cutoffHour={5} by={by} onClose={vi.fn()} />)
    expect(screen.queryByText('Chi apre la cassa?')).toBeNull()
    await user.click(screen.getByRole('button', { name: /^Apri cassa$/ }))
    await waitFor(() => expect(openCashSession).toHaveBeenCalled())
    expect(openCashSession.mock.calls[0][0].by).toBe(by)
  })

  // L'ELENCO NON PUÒ FAR ASPETTARE L'APERTURA: arriva da una Cloud
  // Function, e con la rete che non passa non arriverebbe mai. Quello che
  // il tablet sa già basta per aprire.
  it('la cassa si apre anche se l’elenco degli admin non arriva', async () => {
    const { listStaff } = await import('../../src/lib/staffApi.js')
    listStaff.mockImplementationOnce(() => new Promise(() => {}))
    stato.staff = [FLAVIO, VITTORIO]
    const user = userEvent.setup()
    render(<ApriCassaBox cutoffHour={5} by={{ uid: 'u-flavio' }} onClose={vi.fn()} />)
    expect(screen.getByText('Chi apre la cassa?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Apri cassa$/ }))
    await waitFor(() => expect(openCashSession).toHaveBeenCalled())
  })

  it('«Annulla» lascia la cassa chiusa', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ApriCassaBox cutoffHour={5} by={null} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /Annulla/ }))
    expect(openCashSession).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
