// @vitest-environment happy-dom
'use strict'

// LA PRIMA PAGINA (REQ-FLOTTA-002): cosa fa il prodotto, i piani coi
// prezzi, il tasto per registrarsi. Tono del mestiere, niente urla.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'
import Home from '../src/pages/Home.jsx'
import { PIANI, MODULI } from '../src/lib/piani.js'
import { NOME_PRODOTTO } from '../src/lib/prodotto.js'

const FUTURO = { v7_startTransition: true, v7_relativeSplatPath: true }

describe('la prima pagina', () => {
  it('dice il prodotto, i piani coi prezzi e i moduli', () => {
    render(
      <MemoryRouter future={FUTURO}>
        <Home utente={null} />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(NOME_PRODOTTO)
    for (const p of Object.values(PIANI)) {
      const scheda = screen.getByRole('article', { name: `Piano ${p.nome}` })
      expect(scheda).toHaveTextContent(`${p.prezzo} €`)
    }
    for (const m of MODULI) expect(screen.getByText(m.nome)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Registra il tuo locale/ })).toHaveAttribute('href', '/registrati')
    // Lo scontrino non è fiscale: si dice subito, non nel contratto.
    expect(screen.getByText(/non è uno scontrino fiscale/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/sblocca|acquista ora|scopri/i)
  })

  it('a chi è già dentro mostra la dashboard, non la registrazione', () => {
    render(
      <MemoryRouter future={FUTURO}>
        <Home utente={{ uid: 'u1' }} />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByRole('link', { name: /Registra/ })).toBeNull()
  })
})
