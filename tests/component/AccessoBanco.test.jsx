// @vitest-environment happy-dom
'use strict'

// L'ACCESSO AL BANCO (REQ-FLOTTA-030). L'utente vuole che il titolare entri
// anche con Google; e chi arriva dall'area clienti della regia senza
// riuscire a entrare deve leggere perché, sopra il modulo di sempre.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'

const filo = vi.hoisted(() => ({ popup: null }))

vi.mock('../../src/lib/firebaseClient.js', () => ({
  isFirebaseConfigured: true,
  auth: { currentUser: null },
  db: {},
}))
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb(null)
    return () => {}
  },
  signInWithEmailAndPassword: vi.fn(async () => ({})),
  signInWithPopup: vi.fn((...a) => filo.popup(...a)),
  GoogleAuthProvider: class GoogleAuthProvider {},
  signOut: vi.fn(),
}))
vi.mock('../../src/lib/api.js', () => ({
  segnalaPresenza: vi.fn(),
  subscribePresenze: (cb) => {
    cb([])
    return () => {}
  },
  DEFAULT_SETTINGS: {},
  settingsIniziali: () => ({}),
  subscribeSettings: (cb) => {
    cb({})
    return () => {}
  },
  saveStaffToken: vi.fn(() => Promise.resolve()),
  rimuoviStaffToken: vi.fn(() => Promise.resolve()),
  clockOut: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../src/lib/push.js', () => ({ getPushToken: vi.fn(async () => null) }))
vi.mock('../../src/lib/staffApi.js', () => ({ preloadStaff: vi.fn() }))

import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import BartenderPage from '../../src/pages/BartenderPage.jsx'

const mostra = (entrata = '/bar') =>
  render(
    <MemoryRouter initialEntries={[entrata]}>
      <BartenderPage />
    </MemoryRouter>
  )

beforeEach(() => {
  vi.clearAllMocks()
  filo.popup = async () => ({})
})

describe('l’accesso al banco', () => {
  it('si entra anche con Google', async () => {
    const user = userEvent.setup()
    mostra()
    await user.click(await screen.findByRole('button', { name: 'Entra con Google' }))
    expect(signInWithPopup).toHaveBeenCalledTimes(1)
    expect(signInWithPopup.mock.calls[0][1]).toBeInstanceOf(GoogleAuthProvider)
  })

  // Sui progetti della regia il fornitore Google va acceso a mano: spento,
  // lo si dice, e resta email e password.
  it('con Google spento lo dice; chiudere la finestra non è un errore', async () => {
    const user = userEvent.setup()
    filo.popup = async () => {
      throw Object.assign(new Error('x'), { code: 'auth/operation-not-allowed' })
    }
    mostra()
    await user.click(await screen.findByRole('button', { name: 'Entra con Google' }))
    expect(await screen.findByText(/L’accesso con Google non è attivo per questo locale/)).toBeInTheDocument()

    filo.popup = async () => {
      throw Object.assign(new Error('x'), { code: 'auth/popup-closed-by-user' })
    }
    await user.click(screen.getByRole('button', { name: 'Entra con Google' }))
    expect(screen.queryByText(/non è attivo/)).toBeNull()
  })

  it('chi arriva dall’area clienti senza entrare legge perché, sopra il modulo', async () => {
    mostra({ pathname: '/bar', state: { avvisoAccesso: 'Il collegamento dall’area clienti è scaduto.' } })
    expect(await screen.findByRole('status')).toHaveTextContent('Il collegamento dall’area clienti è scaduto.')
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })
})
