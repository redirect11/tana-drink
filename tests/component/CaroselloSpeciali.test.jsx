// @vitest-environment happy-dom
'use strict'

// IL CAROSELLO DEGLI SPECIAL (REQ-MENU-018). L'utente, 29/10/2026: «serve
// un carosello vero che fa lo slide delle immagini dei drink con nome e
// descrizione». Una slide alla volta, che va avanti da sola finché nessuno
// la tocca, coi pallini per sceglierla.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'
import CaroselloSpeciali from '../../src/components/CaroselloSpeciali.jsx'

const VOCI = [
  { id: 'a', name: 'Regina di cuori', price: 9, description: 'Rosso come le rose dipinte.', illustrazione: { bicchiere: 'coppa', colore: 'rosso', decorazione: 'cuori' } },
  { id: 'b', name: 'Ora del tè', price: 8, description: 'Sempre le sei.', illustrazione: { bicchiere: 'tazza', colore: 'ambra', decorazione: 'agrume' } },
  { id: 'c', name: 'Blukalif', price: 9, image_url: 'https://esempio/blu.jpg' },
]
const mostra = (voci = VOCI) =>
  render(
    <MemoryRouter>
      <CaroselloSpeciali voci={voci} link={(d) => `/menu/special#speciale-${d.id}`} />
    </MemoryRouter>
  )
const pallini = () => within(screen.getByRole('group', { name: 'Scegli lo special' })).getAllByRole('button')
const corrente = () => pallini().findIndex((b) => b.getAttribute('aria-current') === 'true')

beforeEach(() => {
  vi.useFakeTimers()
  window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })
})
afterEach(() => vi.useRealTimers())

describe('il carosello degli special', () => {
  it('una slide per drink, con disegno, nome, descrizione e prezzo, che porta al menù Special', () => {
    mostra()
    const slide = document.querySelectorAll('.carosello-slide')
    expect(slide).toHaveLength(3)
    expect(slide[0]).toHaveAttribute('href', '/menu/special#speciale-a')
    expect(slide[0]).toHaveTextContent('Regina di cuori')
    expect(slide[0]).toHaveTextContent('Rosso come le rose dipinte.')
    expect(slide[0]).toHaveTextContent('9,00')
    // Il disegno composto, o la foto se c'è.
    expect(slide[0].querySelector('img').getAttribute('src')).toMatch(/^data:image\/svg\+xml/)
    expect(slide[2].querySelector('img')).toHaveAttribute('src', 'https://esempio/blu.jpg')
  })

  // REQ-MENU-019: anche gli ingredienti, sotto la descrizione.
  it('sotto la descrizione gli ingredienti, quando ci sono', () => {
    mostra([{ ...VOCI[0], ingredienti: 'Vodka, lampone, lime' }, VOCI[1]])
    const slide = document.querySelectorAll('.carosello-slide')
    expect(slide[0].querySelector('.carosello-ingredienti')).toHaveTextContent('Vodka · lampone · lime')
    expect(slide[1].querySelector('.carosello-ingredienti')).toBeNull()
  })

  it('va avanti da solo, e dall’ultima torna alla prima', () => {
    mostra()
    expect(corrente()).toBe(0)
    act(() => vi.advanceTimersByTime(5000))
    expect(corrente()).toBe(1)
    act(() => vi.advanceTimersByTime(10000))
    expect(corrente()).toBe(0)
  })

  it('i pallini scelgono la slide, e chi tocca ferma lo scorrimento automatico', () => {
    mostra()
    fireEvent.click(pallini()[2])
    expect(corrente()).toBe(2)
    act(() => vi.advanceTimersByTime(15000))
    expect(corrente()).toBe(2)
  })

  it('con «riduci movimento» non scorre da solo', () => {
    window.matchMedia = (q) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })
    mostra()
    act(() => vi.advanceTimersByTime(15000))
    expect(corrente()).toBe(0)
  })

  it('con un solo special niente pallini', () => {
    mostra([VOCI[0]])
    expect(screen.queryByRole('group', { name: 'Scegli lo special' })).toBeNull()
  })
})
