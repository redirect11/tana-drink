// @vitest-environment happy-dom
'use strict'

// IL BACKOFFICE (REQ-FLOTTA-005): tutti i clienti con piano, stato,
// progetto e versione; quello che chiede attenzione sta in cima; da qui si
// rilancia un'attivazione fallita e si segna un piano a mano.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'

const db = vi.hoisted(() => ({
  elencoClienti: vi.fn(),
  elencoIstanze: vi.fn(),
  elencoRichieste: vi.fn(),
  segnaPiano: vi.fn(async () => {}),
  rilanciaAttivazione: vi.fn(async () => {}),
}))
vi.mock('../src/lib/db.js', () => db)

import Backoffice from '../src/pages/Backoffice.jsx'

const FUTURO = { v7_startTransition: true, v7_relativeSplatPath: true }
const mostra = () =>
  render(
    <MemoryRouter future={FUTURO}>
      <Backoffice />
    </MemoryRouter>
  )

beforeEach(() => {
  vi.clearAllMocks()
  db.elencoClienti.mockResolvedValue([
    { uid: 'a', slug: 'bar-attivo', nome_locale: 'Bar Attivo', email: 'a@x.it', piano: 'completo', creato_il: '2026-10-01' },
    { uid: 'b', slug: 'bar-rotto', nome_locale: 'Bar Rotto', email: 'b@x.it', piano: 'base', creato_il: '2026-10-02' },
    { uid: 'c', slug: 'bar-nuovo', nome_locale: 'Bar Nuovo', email: 'c@x.it', creato_il: '2026-10-03' },
  ])
  db.elencoIstanze.mockResolvedValue({
    'bar-attivo': { stato: 'attiva', progetto: 'drink-bar-attivo', versione: 'v1.10.0' },
    'bar-rotto': { stato: 'errore', errore: 'quota progetti' },
  })
  db.elencoRichieste.mockResolvedValue({})
})

describe('il backoffice', () => {
  it('elenca i clienti, prima chi ha un problema', async () => {
    mostra()
    const righe = await screen.findAllByRole('row')
    const nomi = righe.slice(1).map((r) => within(r).getByRole('cell', { name: /Bar/ }).textContent)
    expect(nomi[0]).toMatch(/Bar Rotto/)
    expect(nomi[2]).toMatch(/Bar Attivo/)
    const attivo = righe.find((r) => r.textContent.includes('Bar Attivo'))
    expect(attivo).toHaveTextContent('Completo · 69 €')
    expect(attivo).toHaveTextContent('drink-bar-attivo')
    expect(attivo).toHaveTextContent('v1.10.0')
  })

  it('un’attivazione fallita si rilancia', async () => {
    const user = userEvent.setup()
    mostra()
    await user.click(await screen.findByRole('button', { name: 'Rilancia' }))
    expect(db.rilanciaAttivazione).toHaveBeenCalledWith('bar-rotto')
  })

  it('un piano si segna a mano, finché non c’è Stripe', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'prompt').mockReturnValue('base')
    mostra()
    const nuovo = (await screen.findAllByRole('row')).find((r) => r.textContent.includes('Bar Nuovo'))
    await user.click(within(nuovo).getByRole('button', { name: 'Piano a mano' }))
    expect(db.segnaPiano).toHaveBeenCalledWith('c', { piano: 'base', moduli: [], terminali: 1 })
  })
})
