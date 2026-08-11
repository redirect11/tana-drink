// @vitest-environment happy-dom
'use strict'

// La convenzione delle sottosezioni: una fila di tasti sotto al titolo, il
// pannello si apre lì. Vale per tutte le pagine, quindi il comportamento va
// fissato una volta sola — se cambia qui, cambia ovunque.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import SectionPanels from '../../src/components/SectionPanels.jsx'

const PANNELLI = [
  { id: 'a', label: '➕ Nuovo turno', render: () => <div>FORM TURNO</div> },
  { id: 'b', label: '💶 Paghe orarie', desc: 'Tariffa per persona.', render: () => <div>PAGHE</div> },
]

describe('sottosezioni di una pagina', () => {
  it('parte tutto chiuso: la pagina non nasce già piena di roba', () => {
    render(<SectionPanels panels={PANNELLI} />)
    expect(screen.queryByText('FORM TURNO')).toBeNull()
    expect(screen.queryByText('PAGHE')).toBeNull()
  })

  it('il tasto apre il suo pannello, e il secondo tocco lo chiude', async () => {
    render(<SectionPanels panels={PANNELLI} />)
    const tasto = screen.getByRole('button', { name: /Nuovo turno/ })
    await userEvent.click(tasto)
    expect(screen.getByText('FORM TURNO')).toBeInTheDocument()
    expect(tasto).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(tasto)
    expect(screen.queryByText('FORM TURNO')).toBeNull()
  })

  it('uno alla volta: aprirne un altro chiude il primo', async () => {
    render(<SectionPanels panels={PANNELLI} />)
    await userEvent.click(screen.getByRole('button', { name: /Nuovo turno/ }))
    await userEvent.click(screen.getByRole('button', { name: /Paghe orarie/ }))
    expect(screen.queryByText('FORM TURNO')).toBeNull()
    expect(screen.getByText('PAGHE')).toBeInTheDocument()
    expect(screen.getByText('Tariffa per persona.')).toBeInTheDocument()
  })

  it('la ✕ chiude il pannello aperto', async () => {
    render(<SectionPanels panels={PANNELLI} />)
    await userEvent.click(screen.getByRole('button', { name: /Paghe orarie/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    expect(screen.queryByText('PAGHE')).toBeNull()
  })

  it('il contenuto si monta solo quando serve (niente lavoro a vuoto)', async () => {
    let montato = 0
    render(
      <SectionPanels
        panels={[{ id: 'x', label: 'Apri', render: () => { montato++; return <div>C</div> } }]}
      />
    )
    expect(montato).toBe(0)
    await userEvent.click(screen.getByRole('button', { name: 'Apri' }))
    expect(montato).toBeGreaterThan(0)
  })
})
