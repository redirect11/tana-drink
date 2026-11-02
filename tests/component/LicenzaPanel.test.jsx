// @vitest-environment happy-dom
'use strict'

// ── LA SOTTOSEZIONE LICENZA (REQ-LIC-007) ─────────────────────────────
//
// In sola lettura: piano, stato, validità, chi la gestisce,
// il numero dei moduli inclusi (l'elenco è nelle Funzioni premium) e i
// limiti. Il tasto verso la regia c'è solo se la licenza dice dov'è: quella
// della Tana, scritta a mano nel suo `licenza/attuale`, non lo dice.

import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import LicenzaPanel from '../../src/components/LicenzaPanel.jsx'
import { CON_LICENZA } from '../helpers/licenza.js'

afterEach(cleanup)

describe('la licenza della Tana', () => {
  it('mostra stato, validità e moduli, senza tasto verso la regia', () => {
    render(<LicenzaPanel settings={CON_LICENZA} />)
    expect(screen.getByRole('heading', { name: 'Licenza' })).toBeInTheDocument()
    expect(screen.getByText('Attiva')).toBeInTheDocument()
    expect(screen.getByText('Senza scadenza')).toBeInTheDocument()
    // I moduli si contano: l'elenco è nelle Funzioni premium, sotto.
    expect(screen.getByText('10 su 10')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Gestisci la licenza' })).not.toBeInTheDocument()
    // Senza piano scritto la riga non c'è, invece di un «Piano: —».
    expect(screen.queryByText('Piano')).not.toBeInTheDocument()
  })
})

describe('una licenza della regia', () => {
  const settings = {
    licenza: {
      piano: 'free',
      stato: 'attiva',
      valida_fino: '2099-11-30T12:00:00Z',
      moduli: { menu_tavoli: true },
      limiti: { prodotti_max: 30, sconti: false },
      regia_url: 'https://drink-regia.web.app/area',
    },
  }

  it('mostra piano, validità, limiti e il tasto per gestirla', () => {
    render(<LicenzaPanel settings={settings} />)
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('Valida fino al 30 novembre 2099')).toBeInTheDocument()
    expect(screen.getByText('Prodotti a listino: al massimo 30')).toBeInTheDocument()
    expect(screen.getByText('Sconti sul conto non consentiti')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gestisci la licenza' })).toHaveAttribute(
      'href',
      'https://drink-regia.web.app/area'
    )
  })

  // REQ-LIC-009: passata la scadenza la licenza o si ferma o diventa Free,
  // secondo `alla_scadenza`. Il riquadro dice quale, con la data.
  it('scaduta verso il Free: attiva, col piano Free, e la data della scadenza', () => {
    const licenza = { ...settings.licenza, piano: 'completo', valida_fino: '2020-01-31T12:00:00Z', alla_scadenza: 'free' }
    render(<LicenzaPanel settings={{ licenza }} />)
    expect(screen.getByText('Scaduta il 31 gennaio 2020')).toBeInTheDocument()
    expect(screen.getByText('Attiva')).toBeInTheDocument()
    expect(screen.getByText('Free')).toBeInTheDocument()
  })

  it('scaduta e basta: lo stato lo dice', () => {
    const licenza = { ...settings.licenza, valida_fino: '2020-01-31T12:00:00Z', alla_scadenza: 'ferma' }
    render(<LicenzaPanel settings={{ licenza }} />)
    expect(screen.getByText('Scaduta')).toBeInTheDocument()
  })
})
