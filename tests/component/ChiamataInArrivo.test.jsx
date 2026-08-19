// @vitest-environment happy-dom
'use strict'

// LA CHIAMATA DAL BANCONE NON PUÒ ABITARE IN UNA SCHERMATA SOLA (BUG-037).
// Il cerca-persone stava dentro la sezione «Da servire»: l'ascolto e il
// riquadro erano montati solo lì. Con l'app in secondo piano la notifica di
// sistema arrivava, ma chi riapriva il telefono si ritrovava sulla coda —
// dove la chiamata non c'era — e la trovava solo andando a mano su «Da
// servire». Il gesto di chi aveva chiamato si perdeva.
// Adesso il riquadro sta in cima all'app: c'è già al rientro, su qualunque
// schermata.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

// Le chiamate in sospeso di chi è collegato: il test le pilota da qui.
let chiamate = []
let emetti = null

const ackStaffCall = vi.fn(() => Promise.resolve())
const notify = vi.fn(() => Promise.resolve())

vi.mock('../../src/lib/api.js', () => ({
  subscribeMyCalls: (uid, cb) => {
    emetti = cb
    cb(chiamate)
    return () => {
      emetti = null
    }
  },
  ackStaffCall: (...a) => ackStaffCall(...a),
}))
vi.mock('../../src/lib/notify.js', () => ({ notify: (...a) => notify(...a) }))
vi.mock('../../src/lib/firebaseClient.js', () => ({ auth: { currentUser: { uid: 'u1' } } }))

import ChiamataInArrivo from '../../src/components/ChiamataInArrivo.jsx'

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  chiamate = []
  emetti = null
})

describe('la chiamata dal bancone', () => {
  it('c’è già al rientro, senza dover navigare da nessuna parte', async () => {
    // È il caso del difetto: l'app si riapre e la chiamata era già lì.
    chiamate = [{ id: 'c1', from_name: 'Flavio', message: 'Vieni al banco' }]
    render(<ChiamataInArrivo ruolo="bartender" />)
    expect(await screen.findByText(/Chiamata dal bancone/i)).toBeInTheDocument()
    expect(screen.getByText(/Vieni al banco/)).toBeInTheDocument()
    expect(screen.getByText(/Flavio/)).toBeInTheDocument()
  })

  it('vale per chi sta in sala come per chi sta al banco', async () => {
    chiamate = [{ id: 'c1' }]
    render(<ChiamataInArrivo ruolo="staff" />)
    expect(await screen.findByText(/Chiamata dal bancone/i)).toBeInTheDocument()
  })

  it('al cliente non si presenta: non è roba sua', async () => {
    chiamate = [{ id: 'c1' }]
    render(<ChiamataInArrivo ruolo={null} />)
    await waitFor(() => expect(screen.queryByText(/Chiamata dal bancone/i)).toBeNull())
  })

  it('arrivando mentre si lavora, si presenta da sola', async () => {
    render(<ChiamataInArrivo ruolo="bartender" />)
    await waitFor(() => expect(emetti).toBeTruthy())
    await act(async () => emetti([{ id: 'c2', message: 'Al tavolo 4' }]))
    expect(await screen.findByText(/Al tavolo 4/)).toBeInTheDocument()
    // E fa rumore: la notifica di sistema porta lo stesso tag della push,
    // così le due non si sdoppiano sullo schermo.
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining('Chiamata dal bancone'),
      'Al tavolo 4',
      expect.objectContaining({ tag: 'staff-call' })
    )
  })

  it('rispondendo sparisce subito, senza aspettare la rete', async () => {
    // Chi risponde deve tornare al lavoro nell'istante in cui tocca: la
    // scrittura va per conto suo (e la lista si svuota da sé).
    const user = userEvent.setup()
    chiamate = [{ id: 'c1', message: 'Vieni' }]
    render(<ChiamataInArrivo ruolo="bartender" />)
    await user.click(await screen.findByRole('button', { name: /Rispondo/ }))
    expect(ackStaffCall).toHaveBeenCalledWith('c1')
    await act(async () => emetti([]))
    await waitFor(() => expect(screen.queryByText(/Chiamata dal bancone/i)).toBeNull())
  })
})
