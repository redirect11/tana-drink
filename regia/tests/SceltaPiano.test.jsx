// @vitest-environment happy-dom
'use strict'

// LA SCELTA DEL PIANO (REQ-FLOTTA-007): il prezzo del mese si aggiorna
// mentre si sceglie, e «Vai al pagamento» chiama la Function del Checkout.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const db = vi.hoisted(() => ({ avviaPagamento: vi.fn() }))
vi.mock('../src/lib/db.js', () => db)

import SceltaPiano from '../src/pages/SceltaPiano.jsx'
import { PIANI, MODULI, TERMINALE_IN_PIU } from '../src/lib/piani.js'

beforeEach(() => vi.clearAllMocks())

describe('la scelta del piano', () => {
  it('parte dal base e il prezzo segue moduli e terminali', async () => {
    const user = userEvent.setup()
    render(<SceltaPiano cliente={{ uid: 'u1' }} />)
    expect(screen.getByTestId('prezzo-scelta')).toHaveTextContent(`${PIANI.base.prezzo} €`)
    const staff = MODULI.find((m) => m.id === 'staff')
    await user.click(screen.getByLabelText(new RegExp(staff.nome)))
    expect(screen.getByTestId('prezzo-scelta')).toHaveTextContent(`${PIANI.base.prezzo + staff.prezzo} €`)
    fireEvent.change(screen.getByLabelText(/Terminali/), { target: { value: '2' } })
    expect(screen.getByTestId('prezzo-scelta')).toHaveTextContent(`${PIANI.base.prezzo + staff.prezzo + TERMINALE_IN_PIU} €`)
  })

  it('nel completo i moduli sono inclusi e non si pagano due volte', async () => {
    const user = userEvent.setup()
    render(<SceltaPiano cliente={{ uid: 'u1' }} />)
    await user.click(screen.getByLabelText(/Completo/))
    expect(screen.getByTestId('prezzo-scelta')).toHaveTextContent(`${PIANI.completo.prezzo} €`)
    for (const m of MODULI) expect(screen.getByLabelText(new RegExp(m.nome))).toBeDisabled()
  })

  it('«Vai al pagamento» chiede la sessione e ci va; un rifiuto si legge', async () => {
    const user = userEvent.setup()
    const assign = vi.fn()
    db.avviaPagamento.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/x' })
    render(<SceltaPiano cliente={{ uid: 'u1', moduli: ['staff'] }} vai={assign} />)
    await user.click(screen.getByRole('button', { name: /Vai al pagamento/ }))
    expect(db.avviaPagamento).toHaveBeenCalledWith({ piano: 'base', moduli: ['staff'], terminali: 1 })
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/x')
  })

  it('un rifiuto della Function si legge, e si può riprovare', async () => {
    const user = userEvent.setup()
    db.avviaPagamento.mockRejectedValueOnce(new Error('Il pagamento online non è ancora attivo'))
    render(<SceltaPiano cliente={{ uid: 'u1' }} vai={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /Vai al pagamento/ }))
    expect(await screen.findByText(/non è ancora attivo/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Vai al pagamento/ })).toBeEnabled()
  })
})
