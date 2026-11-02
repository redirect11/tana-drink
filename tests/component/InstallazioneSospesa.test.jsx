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
  it('senza uno stato scritto l’installazione è attiva', () => {
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

  // Prima diceva «30 giorni»; dal REQ-LIC-009 i giorni li decide la regia
  // (90) e la data vera la dice l'avviso della cancellazione: qui non si
  // promettono giorni che possono essere sbagliati.
  it('chiusa: lo dice, e che i dati restano fino alla cancellazione', () => {
    render(<InstallazioneSospesa licenza={{ stato: 'chiusa' }} venue={{ venue_name: 'Bar Mario' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Installazione chiusa')
    expect(screen.getByText(/fino alla loro cancellazione/)).toBeInTheDocument()
    expect(screen.queryByText(/30 giorni/)).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  // REQ-LIC-009: passata `valida_fino` senza il Free, anche senza rete.
  it('scaduta: lo dice, con la data e dove rinnovarla', () => {
    render(
      <InstallazioneSospesa
        licenza={{ stato: 'scaduta', scaduta_il: '2026-11-30T04:00:00Z', regia_url: 'https://drink-regia.web.app/area' }}
        venue={{ venue_name: 'Bar Mario' }}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Licenza scaduta')
    expect(screen.getByRole('alert')).toHaveTextContent(/dal 30\/11\/2026/)
    expect(screen.getByRole('link', { name: /pagina del prodotto/ })).toHaveAttribute('href', 'https://drink-regia.web.app/area')
  })

  // BUG-125: nessuna licenza, né della regia né della build, e il server
  // lo ha confermato. Non è una sospensione: non c'è niente da pagare.
  it('non attivata: lo dice, senza parlare di abbonamenti', () => {
    render(<InstallazioneSospesa licenza={{ stato: 'non_attivata' }} venue={{ venue_name: 'Bar Mario' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Installazione non attivata')
    expect(screen.getByRole('alert')).toHaveTextContent(/Bar Mario/)
    expect(screen.getByText(/si apre da sola/)).toBeInTheDocument()
    expect(screen.queryByText(/abbonamento/)).toBeNull()
  })
})
