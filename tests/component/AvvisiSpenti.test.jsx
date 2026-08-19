// @vitest-environment happy-dom
'use strict'

// GLI AVVISI SPENTI DEVONO TORNARE A FARSI VIVI. Il permesso lo chiede il
// browser una volta sola, con una finestrella in alto: chi sta lavorando la
// scarta senza leggerla e da quel momento quel tablet non suona più —
// nessuno se ne accorge finché non manca un ordine. Perciò l'avviso non ha
// un «non mostrare più»: finché sono spenti resta lì, e ogni volta che si
// rifiuta per sbaglio ricompare.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

let stato = 'da-permettere'
let permesso = false

vi.mock('../../src/lib/push.js', () => ({
  statoPush: () => Promise.resolve(stato),
  getPushToken: () => Promise.resolve('tok'),
}))
vi.mock('../../src/lib/notify.js', () => ({
  ensureNotificationPermission: () => Promise.resolve(permesso),
}))
vi.mock('../../src/lib/api.js', () => ({ saveStaffToken: vi.fn(() => Promise.resolve()) }))
vi.mock('../../src/lib/dispositivo.js', () => ({ idDispositivo: () => 'dev1' }))
vi.mock('../../src/lib/firebaseClient.js', () => ({ auth: { currentUser: { uid: 'u1' } } }))

import AvvisiSpenti from '../../src/components/AvvisiSpenti.jsx'
import { saveStaffToken } from '../../src/lib/api.js'

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  stato = 'da-permettere'
  permesso = false
})

describe('l’avviso «gli avvisi sono spenti»', () => {
  it('lo vede chi lavora, quando il permesso manca', async () => {
    render(<AvvisiSpenti ruolo="bartender" />)
    expect(await screen.findByText(/avvisi sono spenti/i)).toBeInTheDocument()
  })

  it('al cliente non si dice niente: non è roba sua', async () => {
    render(<AvvisiSpenti ruolo={null} />)
    await waitFor(() => expect(screen.queryByText(/avvisi sono spenti/i)).toBeNull())
  })

  it('rifiutando per sbaglio, l’avviso RESTA e insiste', async () => {
    const user = userEvent.setup()
    render(<AvvisiSpenti ruolo="bartender" />)
    await user.click(await screen.findByRole('button', { name: /Attiva/ }))
    expect(await screen.findByText(/Riprova/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Attiva/ })).toBeInTheDocument()
  })

  it('attivandoli sparisce, e il dispositivo si registra subito', async () => {
    const user = userEvent.setup()
    render(<AvvisiSpenti ruolo="bartender" />)
    const tasto = await screen.findByRole('button', { name: /Attiva/ })
    permesso = true
    stato = 'ok'
    await user.click(tasto)
    await waitFor(() => expect(screen.queryByText(/avvisi sono spenti/i)).toBeNull())
    expect(saveStaffToken).toHaveBeenCalledWith('u1', 'tok', 'dev1')
  })

  it('se il browser li ha bloccati si spiega dove riaccenderli, senza tasto', async () => {
    // Da lì l'app non può più chiedere: chiederlo di nuovo non farebbe
    // comparire niente, e sembrerebbe un tasto rotto.
    stato = 'negato'
    render(<AvvisiSpenti ruolo="bartender" />)
    expect(await screen.findByText(/impostazioni/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Attiva/ })).toBeNull()
  })
})
