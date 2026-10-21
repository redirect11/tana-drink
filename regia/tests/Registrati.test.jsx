// @vitest-environment happy-dom
'use strict'

// LA REGISTRAZIONE IN QUATTRO PASSI (REQ-FLOTTA-003): ogni passo si
// controlla prima di andare avanti, l'errore sta accanto alla casella, lo
// slug si vede mentre si scrive il nome, e alla fine si crea l'account con
// tutti i blocchi.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'

const db = vi.hoisted(() => ({ registra: vi.fn() }))
vi.mock('../src/lib/db.js', () => db)

import Registrati from '../src/pages/Registrati.jsx'

const FUTURO = { v7_startTransition: true, v7_relativeSplatPath: true }
const mostra = () =>
  render(
    <MemoryRouter future={FUTURO} initialEntries={['/registrati']}>
      <Routes>
        <Route path="/registrati" element={<Registrati />} />
        <Route path="/dashboard" element={<div>DASHBOARD</div>} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => vi.clearAllMocks())

async function passoAccount(user) {
  await user.type(screen.getByLabelText('Email'), 'mario@example.it')
  await user.type(screen.getByLabelText(/^Password/), 'bar-mario-2026')
  await user.type(screen.getByLabelText('Ripeti la password'), 'bar-mario-2026')
  await user.click(screen.getByRole('button', { name: 'Avanti' }))
}

async function passoLocale(user) {
  await user.type(screen.getByLabelText('Nome del locale'), 'Bar Mario')
  await user.selectOptions(screen.getByLabelText('Tipo di locale'), 'bar')
  await user.type(screen.getByLabelText('Indirizzo'), 'Via Roma 1')
  await user.type(screen.getByLabelText('CAP'), '80035')
  await user.type(screen.getByLabelText('Città'), 'Nola')
  await user.type(screen.getByLabelText('Provincia'), 'na')
  await user.type(screen.getByLabelText('Telefono del locale'), '081 1234567')
  await user.click(screen.getByRole('button', { name: 'Avanti' }))
}

async function passoFatturazione(user) {
  await user.type(screen.getByLabelText('Ragione sociale'), 'Bar Mario srl')
  await user.type(screen.getByLabelText('Partita IVA'), '01234567897')
  await user.type(screen.getByLabelText('PEC'), 'bar@pec.it')
  await user.click(screen.getByRole('button', { name: 'Avanti' }))
}

describe('registrarsi', () => {
  it('non si va avanti con un passo sbagliato, e l’errore sta accanto alla casella', async () => {
    const user = userEvent.setup()
    mostra()
    await user.type(screen.getByLabelText('Email'), 'mario@example.it')
    await user.type(screen.getByLabelText(/^Password/), 'corta1')
    await user.click(screen.getByRole('button', { name: 'Avanti' }))
    expect(screen.getByText(/Almeno 10 caratteri/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Password/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByLabelText('Nome del locale')).toBeNull()
  })

  it('mostra l’indirizzo che l’app avrà mentre si scrive il nome', async () => {
    const user = userEvent.setup()
    mostra()
    await passoAccount(user)
    await user.type(screen.getByLabelText('Nome del locale'), 'Bar Mario')
    expect(screen.getByText(/bar-mario\./)).toBeInTheDocument()
  })

  it('la fattura elettronica vuole la PEC o il codice destinatario', async () => {
    const user = userEvent.setup()
    mostra()
    await passoAccount(user)
    await passoLocale(user)
    await user.type(screen.getByLabelText('Ragione sociale'), 'Bar Mario srl')
    await user.type(screen.getByLabelText('Partita IVA'), '01234567897')
    await user.click(screen.getByRole('button', { name: 'Avanti' }))
    expect(screen.getByText(/PEC o il codice destinatario/)).toBeInTheDocument()
  })

  it('senza i consensi non si crea l’account; con tutto, si crea e si va alla dashboard', async () => {
    const user = userEvent.setup()
    db.registra.mockResolvedValue({ slug: 'bar-mario' })
    mostra()
    await passoAccount(user)
    await passoLocale(user)
    await passoFatturazione(user)
    await user.type(screen.getByLabelText('Nome'), 'Mario')
    await user.type(screen.getByLabelText('Cognome'), 'Rossi')
    await user.click(screen.getByRole('button', { name: /Crea l’account/ }))
    expect(screen.getByText(/vanno accettati i termini/)).toBeInTheDocument()
    expect(db.registra).not.toHaveBeenCalled()

    await user.click(screen.getByLabelText(/accetto i/))
    await user.click(screen.getByLabelText(/informativa sulla privacy/))
    await user.click(screen.getByRole('button', { name: /Crea l’account/ }))
    expect(db.registra).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'mario@example.it',
        password: 'bar-mario-2026',
        locale: expect.objectContaining({ nome: 'Bar Mario', tipo: 'bar', cap: '80035', provincia: 'NA' }),
        fatturazione: expect.objectContaining({ ragione_sociale: 'Bar Mario srl', partita_iva: '01234567897', pec: 'bar@pec.it' }),
        referente: expect.objectContaining({ nome: 'Mario', cognome: 'Rossi', termini: true, privacy: true }),
      })
    )
    expect(await screen.findByText('DASHBOARD')).toBeInTheDocument()
  })

  it('un errore di Firebase si legge in italiano', async () => {
    const user = userEvent.setup()
    db.registra.mockRejectedValue({ code: 'auth/email-already-in-use' })
    mostra()
    await passoAccount(user)
    await passoLocale(user)
    await passoFatturazione(user)
    await user.type(screen.getByLabelText('Nome'), 'Mario')
    await user.type(screen.getByLabelText('Cognome'), 'Rossi')
    await user.click(screen.getByLabelText(/accetto i/))
    await user.click(screen.getByLabelText(/informativa sulla privacy/))
    await user.click(screen.getByRole('button', { name: /Crea l’account/ }))
    expect(await screen.findByText(/ha già un account/)).toBeInTheDocument()
  })
})
