// @vitest-environment happy-dom
'use strict'

// IL DETTAGLIO DI UN DRINK, PER IL CLIENTE (REQ-MENU-020). L'utente,
// 30/10/2026: «su qualsiasi item di menu premo non si apre un dettaglio o
// almeno una modal con il dettaglio del drink con immagine, descrizione
// lunga e ingredienti».

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import DettaglioDrink from '../../src/components/DettaglioDrink.jsx'

const BASILICO = {
  id: 'b',
  name: 'Basiliconiglio',
  price: 9,
  description:
    'Il basilico fresco rincorre il Bianconiglio: un drink verde, aromatico e dissetante, da bere prima che sia troppo tardi.',
  ingredienti: 'Gin, basilico fresco, lime',
  illustrazione: { bicchiere: 'basso', colore: 'verde', decorazione: 'menta' },
}

describe('il dettaglio del drink', () => {
  it('immagine, nome, prezzo, descrizione intera e ingredienti uno per riga', () => {
    render(<DettaglioDrink drink={BASILICO} onClose={vi.fn()} />)
    const dialogo = screen.getByRole('dialog', { name: 'Basiliconiglio' })
    expect(dialogo.querySelector('img').getAttribute('src')).toMatch(/^data:image\/svg\+xml/)
    expect(dialogo).toHaveTextContent('9,00')
    expect(screen.getByText(BASILICO.description)).toBeInTheDocument()
    const righe = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(righe).toEqual(['Gin', 'basilico fresco', 'lime'])
  })

  it('la foto, se c’è, vince sul disegno', () => {
    render(<DettaglioDrink drink={{ ...BASILICO, image_url: 'https://esempio/foto.jpg' }} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog').querySelector('img')).toHaveAttribute('src', 'https://esempio/foto.jpg')
  })

  it('senza ingredienti niente titolo vuoto, e senza immagine niente riquadro', () => {
    render(<DettaglioDrink drink={{ id: 'a', name: 'Acqua', price: 1 }} onClose={vi.fn()} />)
    expect(screen.queryByText('Ingredienti')).toBeNull()
    expect(screen.getByRole('dialog').querySelector('img')).toBeNull()
  })

  it('si chiude col tasto, toccando fuori e con Esc; toccando dentro no', () => {
    const onClose = vi.fn()
    const { container } = render(<DettaglioDrink drink={BASILICO} onClose={onClose} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    fireEvent.click(container.querySelector('.overlay'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('i tasti per ordinare ci sono solo se il menù li dà', () => {
    const { rerender } = render(<DettaglioDrink drink={BASILICO} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Aggiungi' })).toBeNull()
    rerender(<DettaglioDrink drink={BASILICO} onClose={vi.fn()} azioni={<button>Aggiungi</button>} />)
    expect(screen.getByRole('button', { name: 'Aggiungi' })).toBeInTheDocument()
  })

  it('senza drink non c’è niente', () => {
    const { container } = render(<DettaglioDrink drink={null} onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
