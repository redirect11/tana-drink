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
import MenuCarte, { partenzaDelVolo } from '../../src/components/MenuCarte.jsx'

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

  // Come nello schizzo di Flavio: «le carte che aprono il menù sono in
  // mezzo a un ventaglio di carte girate» (l'utente, 06/11/2026). Le
  // girate sono intere («le carte devono essere intere»): una sotto ogni
  // carta, e una a ogni capo.
  it('le carte stanno in mezzo a un ventaglio di girate, che chi legge lo schermo salta', () => {
    mostra()
    const fila = document.querySelector('.k-fila')
    expect(fila.querySelectorAll('.k-dorso-sotto')).toHaveLength(SEZIONI.length)
    expect(fila.firstElementChild).toHaveClass('k-dorso-primo')
    expect(fila.lastElementChild).toHaveClass('k-dorso-ultimo')
    for (const g of fila.querySelectorAll('.k-dorso')) expect(g).toHaveAttribute('aria-hidden', 'true')
  })

  // «Dietro il mazzo di carte può andare il logo della Tana del Coniglio?»
  // (06/11/2026): sulle due girate ai capi, le più in vista, il logo della
  // build.
  it('sulle girate ai capi c’è il logo del locale', () => {
    mostra()
    const loghi = [...document.querySelectorAll('.k-dorso-logo')]
    expect(loghi.map((l) => l.closest('.k-dorso').classList.contains('k-dorso-capo'))).toEqual([true, true])
    for (const l of loghi) expect(l.getAttribute('src')).toMatch(/logo\.png$/)
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

  // Il volo parte dalla carta toccata, alla sua misura: «non si vede che
  // esce dal mazzo» (l'utente, 06/11/2026), quando partiva da un punto
  // fisso. La carta sarà dove la fila la centra.
  it('il volo parte dalla carta toccata, dove la fila la centra, alla sua misura', () => {
    const rect = (left, top, width) => () => ({ left, top, width, height: 0 })
    const carta = { getBoundingClientRect: rect(500, 120, 128) }
    const ventaglio = { getBoundingClientRect: rect(0, 100, 390), scrollLeft: 0, scrollWidth: 1500, clientWidth: 390 }
    const volo = { getBoundingClientRect: rect(16, 400, 358) }
    // La carta, al centro della fila: 195; il volo ha il centro a 195.
    expect(partenzaDelVolo(carta, ventaglio, volo)).toEqual({ '--da-x': '0px', '--da-y': '-280px', '--da-scala': '0.358' })
    // In fondo alla fila non si scorre oltre: resta dov'è.
    const inFondo = { ...ventaglio, scrollLeft: 1110 }
    expect(partenzaDelVolo({ getBoundingClientRect: rect(300, 120, 128) }, inFondo, volo)['--da-x']).toBe('169px')
  })

  it('senza niente da misurare, il volo parte dall’alto', () => {
    expect(partenzaDelVolo(null, null, null)).toBeNull()
    mostra()
    expect(document.querySelector('.k-in-volo').getAttribute('style')).toBeNull()
  })

  it('senza sezioni né Special non disegna niente', () => {
    const { container } = render(<MenuCarte sezioni={[]} speciali={[]} immagine={() => null} apri={vi.fn()} tastiOrdine={() => null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
