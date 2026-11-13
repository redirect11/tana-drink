// @vitest-environment happy-dom
'use strict'

// L'INSTALLAZIONE SOSPESA O CHIUSA (REQ-FLOTTA-008): «serve un modo per
// eliminare/fermare l'app deployata (ad esempio se non arriva il pagamento
// mensile)». La licenza lo dice e l'app si ferma spiegando perché, senza
// toccare i dati.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Il pannello dei dati legge il database: qui basta sapere se c'è, e se è
// la sola esportazione.
vi.mock('../../src/components/BackupPanel.jsx', () => ({
  default: ({ soloEsporta }) => <div>PANNELLO DATI{soloEsporta ? ' (solo esportazione)' : ''}</div>,
}))

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

// LA SCHERMATA DEL TITOLARE (REQ-LIC-018): solo lui legge il motivo, va al
// rinnovo e scarica i suoi dati.
describe('la schermata del titolare', () => {
  it('sospesa: dice il locale, il motivo, la data e dove riattivare', () => {
    render(
      <InstallazioneSospesa
        ruolo="admin"
        licenza={{ stato: 'sospesa', motivo: 'pagamento non ricevuto', dal: '2026-10-22T06:00:00Z', regia_url: 'https://drink-regia.web.app' }}
        venue={{ venue_name: 'Bar Mario' }}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Installazione sospesa')
    expect(screen.getByRole('alert')).toHaveTextContent(/Bar Mario/)
    expect(screen.getByRole('alert')).toHaveTextContent(/pagamento non ricevuto/)
    expect(screen.getByRole('alert')).toHaveTextContent(/22\/10\/2026/)
    expect(screen.getByRole('link', { name: 'Riattiva il locale' })).toHaveAttribute('href', 'https://drink-regia.web.app')
    expect(screen.getByText(/non sono andati persi/)).toBeInTheDocument()
    // I suoi dati si scaricano, ma il ripristino (che scrive) qui non c'è.
    expect(screen.getByText('PANNELLO DATI (solo esportazione)')).toBeInTheDocument()
  })

  // La pagina del rinnovo nell'area del titolare (campo nuovo della regia):
  // se c'è vince, se no si va dove si andava prima.
  it('il rinnovo va a `rinnovo_url`, se la regia lo scrive', () => {
    render(
      <InstallazioneSospesa
        ruolo="admin"
        licenza={{ stato: 'sospesa', regia_url: 'https://drink-regia.web.app', rinnovo_url: 'https://drink-regia.web.app/area/rinnovo' }}
        venue={{ venue_name: 'Bar Mario' }}
      />
    )
    expect(screen.getByRole('link', { name: 'Riattiva il locale' })).toHaveAttribute('href', 'https://drink-regia.web.app/area/rinnovo')
  })

  // Prima diceva «30 giorni»; dal REQ-LIC-009 i giorni li decide la regia
  // (90) e la data vera la dice l'avviso della cancellazione: qui non si
  // promettono giorni che possono essere sbagliati.
  // Un locale chiuso non si riapre da solo: niente «Riattiva», anche se la
  // regia scrive gli indirizzi; i dati si scaricano fino alla cancellazione.
  it('chiusa: lo dice, che i dati restano fino alla cancellazione, e non offre il rinnovo', () => {
    render(
      <InstallazioneSospesa
        ruolo="admin"
        licenza={{ stato: 'chiusa', regia_url: 'https://drink-regia.web.app', rinnovo_url: 'https://drink-regia.web.app/area/rinnovo' }}
        venue={{ venue_name: 'Bar Mario' }}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Installazione chiusa')
    expect(screen.getByText(/fino alla loro cancellazione/)).toBeInTheDocument()
    expect(screen.queryByText(/30 giorni/)).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('PANNELLO DATI (solo esportazione)')).toBeInTheDocument()
  })

  // REQ-LIC-009: passata `valida_fino` senza il Free, anche senza rete.
  it('scaduta: lo dice, con la data e dove rinnovarla', () => {
    render(
      <InstallazioneSospesa
        ruolo="admin"
        licenza={{ stato: 'scaduta', scaduta_il: '2026-11-30T04:00:00Z', regia_url: 'https://drink-regia.web.app/area' }}
        venue={{ venue_name: 'Bar Mario' }}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Licenza scaduta')
    expect(screen.getByRole('alert')).toHaveTextContent(/dal 30\/11\/2026/)
    expect(screen.getByRole('link', { name: 'Riattiva il locale' })).toHaveAttribute('href', 'https://drink-regia.web.app/area')
  })

  // BUG-125: nessuna licenza, né della regia né della build, e il server
  // lo ha confermato. Non è una sospensione: non c'è niente da pagare.
  it('non attivata: lo dice, senza parlare di abbonamenti', () => {
    render(<InstallazioneSospesa ruolo="admin" licenza={{ stato: 'non_attivata' }} venue={{ venue_name: 'Bar Mario' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Installazione non attivata')
    expect(screen.getByRole('alert')).toHaveTextContent(/Bar Mario/)
    expect(screen.getByText(/si apre da sola/)).toBeInTheDocument()
    expect(screen.queryByText(/abbonamento/)).toBeNull()
  })

  // REQ-FLOTTA-026: la presentazione alla regia non è l'attivazione, e qui
  // non ha un tasto (docs/presentazione-alla-regia.md): su un'installazione
  // nuova nessuno è collegato, e la licenza c'è prima dell'app.
  it('non attivata: nessun «Riprova», e l’attivazione dalla pagina del prodotto', () => {
    render(<InstallazioneSospesa ruolo="admin" licenza={{ stato: 'non_attivata', regia_url: 'https://drink-regia.web.app' }} venue={{}} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('link', { name: 'Vai alla pagina del prodotto' })).toHaveAttribute('href', 'https://drink-regia.web.app')
  })
})

// IL PUBBLICO E IL PERSONALE (REQ-LIC-018, Daniele 13/11/2026: «chi entra nel
// locale non deve leggere che il titolare non ha pagato»).
describe('chi non è il titolare', () => {
  const SOSPESA = { stato: 'sospesa', motivo: 'pagamento non ricevuto', dal: '2026-10-22T06:00:00Z', regia_url: 'https://drink-regia.web.app' }

  it('il pubblico legge solo che il menù non è disponibile', () => {
    render(<InstallazioneSospesa licenza={SOSPESA} venue={{ venue_name: 'Bar Mario' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Il menù di Bar Mario non è disponibile in questo momento.')
    for (const parola of [/pagamento/i, /abbonamento/i, /sospes/i, /motivo/i, /licenza/i]) {
      expect(screen.getByRole('alert')).not.toHaveTextContent(parola)
    }
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByText(/PANNELLO DATI/)).toBeNull()
  })

  it('il personale legge che il locale è fermo e a chi chiedere, senza motivo', () => {
    for (const ruolo of ['bartender', 'staff']) {
      const { unmount } = render(<InstallazioneSospesa ruolo={ruolo} licenza={SOSPESA} venue={{ venue_name: 'Bar Mario' }} />)
      expect(screen.getByRole('alert')).toHaveTextContent('Il locale è momentaneamente fermo: per informazioni rivolgersi al titolare.')
      expect(screen.getByRole('alert')).not.toHaveTextContent(/pagamento/i)
      expect(screen.queryByRole('link')).toBeNull()
      expect(screen.queryByText(/PANNELLO DATI/)).toBeNull()
      unmount()
    }
  })
})
