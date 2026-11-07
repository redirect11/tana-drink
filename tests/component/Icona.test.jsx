// @vitest-environment happy-dom
'use strict'

// ── UN'ICONA, NEI DUE TEMI (REQ-UI-031) ──────────────────────────────────
//
// Flavio, 07/11/2026: icone monocrome, «in un solo colore», tutte della
// stessa misura; il colore solo dove dice qualcosa (verde, giallo, rosso
// degli stati). Qui si prova cosa disegna <Icona> nei due temi, e la scelta
// del tema in Impostazioni → Aspetto.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import Icona, { TemaIcone } from '../../src/components/Icona.jsx'

const nelTema = (tema, nodo) => render(<TemaIcone.Provider value={tema}>{nodo}</TemaIcone.Provider>)

describe('<Icona>', () => {
  it('in Silhouette è un disegno a tratto, del colore del testo, e nascosto ai lettori di schermo', () => {
    const { container } = nelTema('silhouette', <Icona nome="cassa" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg.getAttribute('stroke')).toBe('currentColor')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(container.textContent).toBe('')
  })

  it('di partenza, senza tema dichiarato, è Silhouette', () => {
    const { container } = render(<Icona nome="magazzino" />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('in Emoji rimette l’emoji di prima', () => {
    const { container } = nelTema('emoji', <Icona nome="cassa" />)
    expect(container.querySelector('svg')).toBeNull()
    expect(container.textContent).toBe('💶')
  })

  it('un’emoji vecchia si disegna già nel tema scelto', () => {
    const { container } = nelTema('silhouette', <Icona nome="🗑️" />)
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.textContent).toBe('')
  })

  it('i pallini degli stati restano colorati in tutti e due i temi', () => {
    for (const tema of ['silhouette', 'emoji']) {
      const { container, unmount } = nelTema(tema, <Icona nome="verde" />)
      expect(container.querySelector('.icona-pallino-verde'), tema).not.toBeNull()
      unmount()
    }
  })

  it('quello che non è un’icona conosciuta esce com’è, invece di sparire', () => {
    const { container } = nelTema('silhouette', <Icona nome="▦" />)
    expect(container.textContent).toBe('▦')
  })
})

describe('la scelta in Aspetto', () => {
  it('di partenza è Silhouette, e toccando Emoji si salva', async () => {
    const { default: ThemeSettings } = await import('../../src/components/ThemeSettings.jsx')
    const onSave = vi.fn()
    render(<ThemeSettings settings={{ theme_staff: { preset: 'tana-scuro' } }} onSave={onSave} />)
    expect(screen.getByRole('button', { name: /Silhouette/ })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: /Emoji/ }))
    expect(onSave).toHaveBeenCalledWith({ tema_icone: 'emoji' })
  })
})
