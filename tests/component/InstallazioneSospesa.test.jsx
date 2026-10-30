// @vitest-environment happy-dom
'use strict'

// L'INSTALLAZIONE SOSPESA O CHIUSA (REQ-FLOTTA-008): «serve un modo per
// eliminare/fermare l'app deployata (ad esempio se non arriva il pagamento
// mensile)». La licenza lo dice e l'app si ferma spiegando perché, senza
// toccare i dati.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import InstallazioneSospesa from '../../src/components/InstallazioneSospesa.jsx'
import { installazioneBloccata, statoLicenza, STATI_LICENZA } from '../../src/lib/licenza.js'

describe('la licenza', () => {
  it('senza niente scritto l’installazione è attiva: la Tana non ha una licenza e lavora', () => {
    expect(statoLicenza({})).toBe(STATI_LICENZA.ATTIVA)
    expect(statoLicenza(null)).toBe(STATI_LICENZA.ATTIVA)
    expect(installazioneBloccata({ licenza: { moduli: { conta: true } } })).toBe(false)
  })

  it('sospesa o chiusa bloccano; uno stato ignoto no', () => {
    expect(installazioneBloccata({ licenza: { stato: 'sospesa' } })).toBe(true)
    expect(installazioneBloccata({ licenza: { stato: 'chiusa' } })).toBe(true)
    expect(installazioneBloccata({ licenza: { stato: 'boh' } })).toBe(false)
  })
})

describe('la schermata', () => {
  it('sospesa: dice il locale, il motivo, la data e dove riattivare', () => {
    render(
      <InstallazioneSospesa
        licenza={{ stato: 'sospesa', motivo: 'pagamento non ricevuto', dal: '2026-10-22T06:00:00Z', regia_url: 'https://drink-regia.web.app' }}
        venue={{ venue_name: 'Bar Mario' }}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Installazione sospesa')
    expect(screen.getByRole('alert')).toHaveTextContent(/Bar Mario/)
    expect(screen.getByRole('alert')).toHaveTextContent(/pagamento non ricevuto/)
    expect(screen.getByRole('alert')).toHaveTextContent(/22\/10\/2026/)
    expect(screen.getByRole('link', { name: /pagina del prodotto/ })).toHaveAttribute('href', 'https://drink-regia.web.app')
    expect(screen.getByText(/non sono andati persi/)).toBeInTheDocument()
  })

  it('chiusa: lo dice, e dice dei 30 giorni', () => {
    render(<InstallazioneSospesa licenza={{ stato: 'chiusa' }} venue={{ venue_name: 'Bar Mario' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Installazione chiusa')
    expect(screen.getByText(/30 giorni/)).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
