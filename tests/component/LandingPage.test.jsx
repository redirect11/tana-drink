// @vitest-environment happy-dom
'use strict'

// LA LANDING LEGGE IL LOCALE (REQ-VENUE-002): titolo, slogan, «chi siamo»
// e contatti vengono da venueDi(settings). Per la Tana è la pagina di
// sempre; per un locale senza testi le sezioni vuote non si vedono.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'

const stato = { impostazioni: {} }
vi.mock('../../src/lib/api.js', () => ({
  settingsIniziali: () => stato.impostazioni,
  subscribeSettings: (cb) => {
    cb(stato.impostazioni)
    return () => {}
  },
}))

import LandingPage from '../../src/pages/LandingPage.jsx'

const mostra = () =>
  render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  )

beforeEach(() => {
  stato.impostazioni = {}
})

describe('la landing', () => {
  it('per la Tana è quella di sempre', () => {
    mostra()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('La Tana del Coniglio')
    expect(screen.getByText('Cocktail bar · Nola')).toBeInTheDocument()
    expect(screen.getByText(/cocktail bar a Nola/)).toBeInTheDocument()
    expect(screen.getByText(/Nola \(NA\)/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'info@latanadelconiglio.it' })).toHaveAttribute('href', 'mailto:info@latanadelconiglio.it')
  })

  it('le impostazioni del locale vincono sulla build', () => {
    stato.impostazioni = { venue_name: 'Bar Mario', venue_tagline: 'Dal 1980', venue_about: 'Un bar di paese.', venue_city: 'Avella (AV)' }
    mostra()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bar Mario')
    expect(screen.getByText('Dal 1980')).toBeInTheDocument()
    expect(screen.getByText('Un bar di paese.')).toBeInTheDocument()
    expect(screen.getByText(/Avella/)).toBeInTheDocument()
    expect(screen.queryByText(/Tana/)).toBeNull()
  })
})
