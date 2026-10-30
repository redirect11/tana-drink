// @vitest-environment happy-dom
'use strict'

// GLI SPECIAL A SCORRIMENTO, STILE «NOTTE» (REQ-MENU-021). L'utente,
// 30/10/2026: «mi piacciono le animazioni di scroll di Mùn rooftop.
// Possiamo usarle per scrollare gli item special, nel menu special». Una
// scena per drink, col fondo del suo colore; il movimento è in più, e senza
// le scene si leggono lo stesso.

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'
import SpecialScorrevoli from '../../src/components/SpecialScorrevoli.jsx'

const VOCI = [
  {
    id: 'b',
    name: 'Basiliconiglio',
    price: 9,
    description: 'Il basilico fresco rincorre il Bianconiglio.',
    ingredienti: 'Gin, basilico fresco, lime',
    illustrazione: { bicchiere: 'basso', colore: 'verde', decorazione: 'menta' },
  },
  { id: 't', name: 'Ora del tè', price: 8, illustrazione: { bicchiere: 'tazza', colore: 'ambra', decorazione: 'agrume' } },
]

let osservatori = []
class FintoOsservatore {
  constructor(cb) {
    this.cb = cb
    this.visti = []
    osservatori.push(this)
  }
  observe(el) {
    this.visti.push(el)
  }
  disconnect() {}
}
afterEach(() => {
  osservatori = []
  delete globalThis.IntersectionObserver
})

const mostra = (props = {}) =>
  render(
    <MemoryRouter>
      <SpecialScorrevoli
        voci={VOCI}
        titolo="Special"
        sottotitolo="Alice nel Paese delle Meraviglie"
        linkMenu="/menu?tavolo=5"
        tastiOrdine={(d) => <button className="btn small">Aggiungi {d.name}</button>}
        {...props}
      />
    </MemoryRouter>
  )

describe('gli Special a scorrimento', () => {
  it('una scena per drink: disegno, nome, descrizione, ingredienti, prezzo e il tasto per ordinare', () => {
    mostra()
    const scena = document.getElementById('speciale-b')
    expect(scena).toHaveAttribute('aria-label', 'Basiliconiglio')
    expect(within(scena).getByRole('heading', { name: 'Basiliconiglio' })).toBeInTheDocument()
    expect(scena.querySelector('img').getAttribute('src')).toMatch(/^data:image\/svg\+xml/)
    expect(scena).toHaveTextContent('Il basilico fresco rincorre il Bianconiglio.')
    expect([...scena.querySelectorAll('.notte-ingredienti span')].map((s) => s.textContent)).toEqual(['Gin', 'basilico fresco', 'lime'])
    expect(scena).toHaveTextContent('9,00')
    expect(within(scena).getByRole('button', { name: 'Aggiungi Basiliconiglio' })).toBeInTheDocument()
    // Il numero dice dove si è nella sequenza.
    expect(scena.querySelector('.notte-numero')).toHaveTextContent('01 / 02')
  })

  it('il nome va a capo solo fra le parole', () => {
    mostra()
    const parole = document.getElementById('speciale-t').querySelectorAll('.notte-parola')
    expect([...parole].map((p) => p.textContent)).toEqual(['Ora', 'del', 'tè'])
  })

  it('l’apertura riporta al menù intero con lo stesso tavolo, e in fondo c’è l’indice', () => {
    mostra()
    expect(screen.getByRole('link', { name: /Tutto il menù/ })).toHaveAttribute('href', '/menu?tavolo=5')
    const indice = screen.getByRole('navigation', { name: 'Tutti gli Special' })
    const righe = within(indice).getAllByRole('link')
    expect(righe.map((a) => a.getAttribute('href'))).toEqual(['#speciale-b', '#speciale-t'])
    expect(righe[0]).toHaveTextContent('Basiliconiglio')
  })

  it('il fondale prende il colore della scena al centro dello schermo, e lo lascia fuori dalle scene', () => {
    globalThis.IntersectionObserver = FintoOsservatore
    mostra()
    const [o] = osservatori
    const fondale = document.querySelector('.notte-fondale')
    const scena = document.getElementById('speciale-b')
    act(() => o.cb([{ isIntersecting: true, target: scena }]))
    // Verde del disegno (#a9d3a0), spento nel fondo del tema.
    expect(fondale).toHaveAttribute('data-tinta', '#a9d3a0')
    act(() => o.cb([{ isIntersecting: true, target: document.querySelector('.notte-indice') }]))
    expect(fondale).not.toHaveAttribute('data-tinta')
  })

  it('senza tasti (solo menù) le scene si guardano e basta', () => {
    mostra({ tastiOrdine: () => null })
    expect(screen.queryByRole('button', { name: /Aggiungi/ })).toBeNull()
  })
})
