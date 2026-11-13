// @vitest-environment happy-dom
'use strict'

// ── UN'ICONA, NEI DUE TEMI (REQ-UI-031) ──────────────────────────────────
//
// Flavio, 07/11/2026: icone monocrome, «in un solo colore», tutte della
// stessa misura; il colore solo dove dice qualcosa (verde, giallo, rosso
// degli stati). Qui si prova cosa disegna <Icona> nei due temi, e la scelta
// del tema in Impostazioni → Aspetto.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import Icona from '../../src/components/Icona.jsx'
import { TemaIcone } from '../../src/lib/temaIcone.js'

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

// ── FASE 3: I SEGNALI E I MESSAGGI ───────────────────────────────────────
// Le notifiche a comparsa, le etichette che arrivano come testo, i campi
// di ricerca: seguono il tema «Segnali e messaggi», separato dagli altri.
describe('le etichette che arrivano come testo', () => {
  it('l’emoji in testa si disegna nel tema, il resto resta testo', async () => {
    const { ConIcona } = await import('../../src/components/Icona.jsx')
    const { container } = render(
      <TemaIcone.Provider value={{ tasti: 'silhouette' }}>
        <ConIcona testo="🧾 Da fare" />
      </TemaIcone.Provider>
    )
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.textContent).toBe(' Da fare')
  })

  it('in Emoji torna com’era', async () => {
    const { ConIcona } = await import('../../src/components/Icona.jsx')
    const { container } = render(
      <TemaIcone.Provider value={{ tasti: 'emoji' }}>
        <ConIcona testo="🧾 Da fare" />
      </TemaIcone.Provider>
    )
    expect(container.textContent).toBe('🧾 Da fare')
  })

  it('un testo senza icona esce com’è', async () => {
    const { ConIcona } = await import('../../src/components/Icona.jsx')
    const { container } = render(<ConIcona testo="Aperti" />)
    expect(container.textContent).toBe('Aperti')
  })
})

describe('le notifiche a comparsa', () => {
  // Le notifiche vivono in un deposito del modulo, che resta fra una prova
  // e l'altra: con lo stesso id ognuna prende il posto della precedente.
  async function mostra(tema, messaggio, opzioni = {}) {
    const { default: Toasts } = await import('../../src/components/Toasts.jsx')
    const { showToast } = await import('../../src/lib/toast.js')
    const vista = render(
      <TemaIcone.Provider value={{ segnali: tema }}>
        <Toasts />
      </TemaIcone.Provider>
    )
    act(() => {
      showToast(messaggio, { id: 'prova', ...opzioni })
    })
    return vista
  }

  it('l’icona del tipo, nel tema dei segnali', async () => {
    const { container, unmount } = await mostra('silhouette', 'Avanzamento non riuscito', { kind: 'error' })
    expect(container.querySelector('.toast svg')).not.toBeNull()
    expect(container.querySelector('.toast').textContent).toBe('Avanzamento non riuscito')
    unmount()
  })

  it('l’icona chiesta, se quella del tipo non basta', async () => {
    const { container, unmount } = await mostra('emoji', 'Chiamata inviata al bancone', { icona: 'chiama-bancone' })
    expect(container.querySelector('.toast').textContent).toBe('📟Chiamata inviata al bancone')
    unmount()
  })

  it('un messaggio scritto con l’emoji davanti non la mostra due volte', async () => {
    const { container, unmount } = await mostra('silhouette', '⚠️ Stampa non riuscita', { kind: 'error' })
    expect(container.querySelector('.toast').textContent).toBe('Stampa non riuscita')
    expect(container.querySelectorAll('.toast svg')).toHaveLength(1)
    unmount()
  })
})

describe('i campi di ricerca', () => {
  // La lente nel testo di prova solo in «Emoji»: un disegno, dentro un
  // segnaposto, non entra.
  it('seguono il tema dei segnali', async () => {
    const { useTestoConIcona } = await import('../../src/lib/temaIcone.js')
    function Campo() {
      const testoConIcona = useTestoConIcona()
      return <input placeholder={testoConIcona('cerca', 'Cerca prodotto…')} />
    }
    for (const [tema, atteso] of [['emoji', '🔍 Cerca prodotto…'], ['silhouette', 'Cerca prodotto…']]) {
      const { unmount } = render(
        <TemaIcone.Provider value={{ segnali: tema }}>
          <Campo />
        </TemaIcone.Provider>
      )
      expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', atteso)
      unmount()
    }
  })
})
