// @vitest-environment happy-dom
'use strict'

// ── LA SOTTOSEZIONE LICENZA (REQ-LIC-007) ─────────────────────────────
//
// In sola lettura: piano, stato, validità, chi la gestisce,
// il numero dei moduli inclusi (l'elenco è nelle Funzioni premium) e i
// limiti. Il tasto verso la regia c'è solo se la licenza dice dov'è; la
// licenza scritta nell'installazione (la Tana, nei test l'app è compilata
// per lei) lo dice in una riga, e nessun tasto porta da nessuna parte.

import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import LicenzaPanel from '../../src/components/LicenzaPanel.jsx'

afterEach(cleanup)

describe('la licenza della Tana', () => {
  it('dice che è scritta nell’installazione, coi moduli, senza tasto verso la regia', () => {
    render(<LicenzaPanel settings={{}} />)
    expect(screen.getByRole('heading', { name: 'Licenza' })).toBeInTheDocument()
    expect(screen.getByText('Licenza scritta nell’installazione')).toBeInTheDocument()
    expect(screen.getByText('Senza scadenza')).toBeInTheDocument()
    // I moduli si contano: l'elenco è nelle Funzioni premium, sotto.
    expect(screen.getByText('9 su 10')).toBeInTheDocument()
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
    expect(screen.getByText('Regia')).toBeInTheDocument()
    expect(screen.getByText('Prodotti a listino: al massimo 30')).toBeInTheDocument()
    expect(screen.getByText('Sconti sul conto non consentiti')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gestisci la licenza' })).toHaveAttribute(
      'href',
      'https://drink-regia.web.app/area'
    )
  })

  it('una scadenza passata si dice, senza fermare niente', () => {
    render(<LicenzaPanel settings={{ licenza: { ...settings.licenza, valida_fino: '2020-01-31T12:00:00Z' } }} />)
    expect(screen.getByText('Scaduta il 31 gennaio 2020')).toBeInTheDocument()
    expect(screen.getByText('Attiva')).toBeInTheDocument()
  })
})
