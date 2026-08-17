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

vi.mock('../../src/lib/api.js', () => ({ openCashSession: vi.fn(() => Promise.resolve()) }))
vi.mock('../../src/lib/toast.js', () => ({ toastError: vi.fn() }))

import ApriCassaBox from '../../src/components/ApriCassaBox.jsx'
import { openCashSession } from '../../src/lib/api.js'

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
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

  it('«Annulla» lascia la cassa chiusa', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ApriCassaBox cutoffHour={5} by={null} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /Annulla/ }))
    expect(openCashSession).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
