// @vitest-environment happy-dom
'use strict'

// UNA FUNZIONE CHE IL LOCALE NON HA (REQ-LIC-002): chi arriva al menù
// digitale di un locale col piano base — un vecchio QR, un link salvato —
// trova una frase piana e il rimando alla pagina del prodotto, non un errore.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import FunzioneNonInclusa from '../../src/components/FunzioneNonInclusa.jsx'

describe('la pagina di una funzione non inclusa', () => {
  it('dice cosa manca e rimanda alla pagina del prodotto', () => {
    render(<FunzioneNonInclusa nome="Il menù digitale" licenza={{ regia_url: 'https://drink-regia.web.app' }} />)
    expect(screen.getByRole('heading', { name: 'Il menù digitale non è attivo' })).toBeInTheDocument()
    expect(screen.getByText(/non fa parte del piano/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /pagina del prodotto/ })).toHaveAttribute('href', 'https://drink-regia.web.app')
  })

  it('senza l’indirizzo della regia non promette un tasto che non porta da nessuna parte', () => {
    render(<FunzioneNonInclusa nome="Il menù digitale" licenza={{}} />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})
