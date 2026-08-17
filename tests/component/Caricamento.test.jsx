// @vitest-environment happy-dom
'use strict'

// UNA SCRITTA FERMA SU UNA PAGINA VUOTA non si distingue da un'app che si è
// piantata: chi guarda non sa se aspettare o ricaricare. Le bollicine
// dicono la stessa cosa e dicono anche che qualcosa si sta muovendo.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import Caricamento from '../../src/components/Caricamento.jsx'

describe('l’attesa', () => {
  it('dice cosa sta aspettando, non «loading»', () => {
    render(<Caricamento testo="Apro la cassa…" />)
    expect(screen.getByText('Apro la cassa…')).toBeInTheDocument()
  })

  it('lo annuncia anche a chi non vede lo schermo', () => {
    render(<Caricamento />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
