// @vitest-environment happy-dom
'use strict'

// LO STILE «CARTE» (REQ-MENU-029): l'idea di Flavio, il menù come un mazzo
// di carte francesi. «Con le carte che si alzano quando le selezioni»
// (06/11/2026). Quello che promette a tutti gli stili strutturati — ogni
// voce col suo prezzo, i tasti del menù, niente database — lo prova
// stiliStrutturati.test.jsx; qui i gesti del mazzo.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'
import MenuCarte from '../../src/components/MenuCarte.jsx'

const voce = (id, name, price) => ({ id, name, price, description: `Descrizione di ${name}`, ingredients: [] })
const SEZIONI = [
  { id: 's1', nome: 'Signature', vista: 'piena', gruppo: 'Cocktail', voci: [voce('tana', 'Tana', 10)] },
  { id: 's2', nome: 'Grandi classici', vista: 'piena', gruppo: 'Cocktail', voci: [voce('negroni', 'Negroni', 8)] },
  { id: 's3', nome: 'Gin', vista: 'piena', gruppo: 'Distillati', voci: [voce('hendricks', 'Hendrick’s', 9)] },
]
const SPECIALI = [voce('velluto', 'Velluto Bianco', 9)]

function mostra(extra = {}) {
  const p = {
    // Nel menù gli Special sono del carosello (MenuPage): allo stile
    // arrivano solo sulla pagina Special.
    sezioni: SEZIONI,
    speciali: [],
    immagine: () => null,
    apri: vi.fn(),
    tastiOrdine: (d) => <button type="button">Aggiungi {d.name}</button>,
    special: { titolo: 'Special della sera' },
    ...extra,
  }
  render(
    <MemoryRouter>
      <MenuCarte {...p} />
    </MemoryRouter>
  )
  return p
}

const mazzo = () => within(screen.getByRole('navigation', { name: 'Le carte del menù' }))
const aperta = () => screen.getAllByRole('region').find((r) => !r.hidden)

describe('il mazzo', () => {
  it('una carta per sezione, nell’ordine del menù: angolo, nome e seme grande', () => {
    mostra()
    expect(mazzo().getAllByRole('button').map((b) => b.textContent)).toEqual(['A♥︎Signature♥︎', '2♥︎Grandi classici♥︎', 'A♣︎Gin♣︎'])
  })

  // Il mazzo coperto sono carte intere sul dorso, non una fascia che copre
  // le altre a metà: «le carte devono essere intere, adesso sono tagliate,
  // non sembra un mazzo» (l'utente, 06/11/2026).
  it('a inizio fila il mazzo coperto, quattro carte sul dorso, che chi legge lo schermo salta', () => {
    mostra()
    const coperto = document.querySelector('.k-fila > .k-coperto')
    expect(coperto).toHaveAttribute('aria-hidden', 'true')
    expect(coperto.querySelectorAll('.k-dorso')).toHaveLength(4)
    expect(document.querySelector('.k-fila').firstElementChild).toBe(coperto)
  })

  it('all’apertura è alzata e aperta la prima sezione', () => {
    mostra()
    expect(mazzo().getByRole('button', { name: 'Signature' })).toHaveAttribute('aria-pressed', 'true')
    expect(aperta()).toHaveAccessibleName('Signature')
    expect(within(aperta()).getByRole('button', { name: 'Tana' })).toBeInTheDocument()
  })

  it('toccando una carta si alza lei, e sotto si apre la sua sezione', async () => {
    mostra()
    await userEvent.setup().click(mazzo().getByRole('button', { name: 'Gin' }))
    expect(mazzo().getByRole('button', { name: 'Gin' })).toHaveAttribute('aria-pressed', 'true')
    expect(mazzo().getByRole('button', { name: 'Signature' })).toHaveAttribute('aria-pressed', 'false')
    expect(aperta()).toHaveAccessibleName('Gin')
    expect(within(aperta()).getByText('Distillati')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tana' })).toBeNull()
  })

  // Le carte chiuse restano nella pagina: un tocco, e non si aspetta niente.
  it('le carte chiuse ci sono già, nascoste', () => {
    mostra()
    expect(screen.getAllByRole('region', { hidden: true })).toHaveLength(3)
    expect(screen.getByText('Negroni')).not.toBeVisible()
  })

  it('il seme della carta aperta è quello del suo gruppo', async () => {
    mostra()
    expect(aperta()).toHaveAttribute('data-seme', 'cuori')
    await userEvent.setup().click(mazzo().getByRole('button', { name: 'Gin' }))
    expect(aperta()).toHaveAttribute('data-seme', 'fiori')
  })

  it('dalla carta aperta si torna al mazzo', async () => {
    mostra()
    const nav = screen.getByRole('navigation', { name: 'Le carte del menù' })
    nav.scrollIntoView = vi.fn()
    await userEvent.setup().click(within(aperta()).getByRole('button', { name: 'Le carte ↑' }))
    expect(nav.scrollIntoView).toHaveBeenCalled()
  })

  it('sulla pagina Special: solo il Jolly, aperto, senza mazzo', () => {
    mostra({ soloSpeciali: true, speciali: SPECIALI })
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.getAllByRole('region', { hidden: true })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Velluto Bianco' })).toBeVisible()
  })

  it('senza sezioni né Special non disegna niente', () => {
    const { container } = render(<MenuCarte sezioni={[]} speciali={[]} immagine={() => null} apri={vi.fn()} tastiOrdine={() => null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
