// @vitest-environment happy-dom
'use strict'

// LA PORTA DELLA DEMO (REQ-FLOTTA-019): si sceglie il ruolo, una fascia
// dice sempre che è una demo, e «Ricomincia da capo» chiede conferma prima
// di buttare il lavoro fatto.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'
import { creaAuthDemo } from '../../src/demo/accesso.js'

let auth
vi.mock('../../src/lib/firebaseClient.js', () => ({
  get auth() {
    return auth
  },
}))
const prossima = vi.fn()
vi.mock('../../src/demo/sessione.js', () => ({ prossimaSessione: (...a) => prossima(...a) }))

const { default: PortaDemo } = await import('../../src/demo/PortaDemo.jsx')

beforeEach(() => {
  localStorage.clear()
  auth = creaAuthDemo()
  prossima.mockClear()
})

const mostra = () =>
  render(
    <MemoryRouter>
      <PortaDemo>
        <p>LE PAGINE DELL’APP</p>
      </PortaDemo>
    </MemoryRouter>
  )

describe('la porta della demo', () => {
  it('prima si sceglie il ruolo; poi si entra nell’app', async () => {
    const user = userEvent.setup()
    mostra()
    expect(screen.getByRole('heading', { name: 'Prova l’app' })).toBeInTheDocument()
    expect(screen.queryByText('LE PAGINE DELL’APP')).toBeNull()
    await user.click(screen.getByRole('button', { name: /^Titolare/ }))
    expect(screen.getByText('LE PAGINE DELL’APP')).toBeInTheDocument()
    expect(auth.currentUser.uid).toBe('demo-admin')
  })

  it('la fascia dice sempre che è una demo, e da lì si cambia ruolo', async () => {
    const user = userEvent.setup()
    auth.scegliRuolo('bartender')
    mostra()
    const fascia = screen.getByRole('region', { name: 'Demo' })
    expect(fascia).toHaveTextContent('Demo con dati di prova')
    expect(fascia).toHaveTextContent('quello che fai resta in questo browser')
    await user.click(screen.getByRole('button', { name: /Cambia ruolo/ }))
    expect(screen.getByRole('heading', { name: 'Prova l’app' })).toBeInTheDocument()
    expect(auth.currentUser).toBeNull()
  })

  it('«Ricomincia da capo» chiede conferma, e si può annullare', async () => {
    const user = userEvent.setup()
    auth.scegliRuolo('admin')
    const via = vi.fn()
    const vero = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...vero, origin: 'http://demo', assign: via } })
    mostra()
    await user.click(screen.getByRole('button', { name: /Ricomincia da capo/ }))
    expect(screen.getByRole('region', { name: 'Demo' })).toHaveTextContent('si perde quello che hai fatto')
    await user.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(prossima).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /Ricomincia da capo/ }))
    await act(() => user.click(screen.getByRole('button', { name: 'Ricomincia' })))
    expect(prossima).toHaveBeenCalledTimes(1)
    expect(via).toHaveBeenCalledWith('http://demo/')
    Object.defineProperty(window, 'location', { configurable: true, value: vero })
  })
})
