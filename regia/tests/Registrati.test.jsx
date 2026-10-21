// @vitest-environment happy-dom
'use strict'

// LA REGISTRAZIONE (REQ-FLOTTA-003): nome del locale, email, password; lo
// slug si vede mentre si scrive, perché è l'indirizzo che l'app avrà.

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

describe('registrarsi', () => {
  it('mostra l’indirizzo che l’app avrà, e spiega un nome che non va', async () => {
    const user = userEvent.setup()
    mostra()
    await user.type(screen.getByLabelText('Nome del locale'), 'Bar Mario')
    expect(screen.getByText(/bar-mario\./)).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Nome del locale'))
    await user.type(screen.getByLabelText('Nome del locale'), 'Bar')
    expect(screen.getByText(/Troppo corto/)).toBeInTheDocument()
  })

  it('crea l’account e porta alla dashboard', async () => {
    const user = userEvent.setup()
    db.registra.mockResolvedValue({ slug: 'bar-mario' })
    mostra()
    await user.type(screen.getByLabelText('Nome del locale'), 'Bar Mario')
    await user.type(screen.getByLabelText('Email'), 'mario@example.it')
    await user.type(screen.getByLabelText(/Password/), 'segretissima')
    await user.click(screen.getByRole('button', { name: /Crea l’account/ }))
    expect(db.registra).toHaveBeenCalledWith({ email: 'mario@example.it', password: 'segretissima', nomeLocale: 'Bar Mario', contatto: '' })
    expect(await screen.findByText('DASHBOARD')).toBeInTheDocument()
  })

  it('un errore di Firebase si legge in italiano', async () => {
    const user = userEvent.setup()
    db.registra.mockRejectedValue({ code: 'auth/email-already-in-use' })
    mostra()
    await user.type(screen.getByLabelText('Nome del locale'), 'Bar Mario')
    await user.type(screen.getByLabelText('Email'), 'mario@example.it')
    await user.type(screen.getByLabelText(/Password/), 'segretissima')
    await user.click(screen.getByRole('button', { name: /Crea l’account/ }))
    expect(await screen.findByText(/ha già un account/)).toBeInTheDocument()
  })
})
