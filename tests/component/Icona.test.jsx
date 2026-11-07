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

// Il contesto porta il tema di ogni gruppo; le prove dicono quello della
// navigazione, che è il gruppo di partenza di <Icona>.
const nelTema = (tema, nodo) => render(<TemaIcone.Provider value={{ navigazione: tema }}>{nodo}</TemaIcone.Provider>)

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

describe('i gruppi', () => {
  it('ogni icona segue il tema del suo gruppo, non degli altri', () => {
    const { container } = render(
      <TemaIcone.Provider value={{ navigazione: 'silhouette', tasti: 'emoji' }}>
        <Icona nome="cassa" />
        <Icona nome="elimina" gruppo="tasti" />
      </TemaIcone.Provider>
    )
    expect(container.querySelectorAll('svg')).toHaveLength(1)
    expect(container.textContent).toBe('🗑')
  })
})

describe('la scelta in Aspetto', () => {
  // L'utente, 07/11/2026: un selettore per gruppo.
  it('un selettore per gruppo, di partenza Silhouette; ognuno salva la sua chiave', async () => {
    const { default: ThemeSettings } = await import('../../src/components/ThemeSettings.jsx')
    const onSave = vi.fn()
    render(<ThemeSettings settings={{ theme_staff: { preset: 'tana-scuro' } }} onSave={onSave} />)
    for (const gruppo of ['Navigazione', 'Tasti e stati', 'Segnali e messaggi']) {
      expect(screen.getByRole('button', { name: `${gruppo}: Silhouette` })).toHaveAttribute('aria-pressed', 'true')
    }
    await userEvent.click(screen.getByRole('button', { name: 'Tasti e stati: Emoji' }))
    expect(onSave).toHaveBeenCalledWith({ tema_icone_tasti: 'emoji' })
    await userEvent.click(screen.getByRole('button', { name: 'Segnali e messaggi: Emoji' }))
    expect(onSave).toHaveBeenCalledWith({ tema_icone_segnali: 'emoji' })
  })
})
