// @vitest-environment happy-dom
'use strict'

// LO STILE «CARTE» (REQ-MENU-029): l'idea di Flavio, il menù come un mazzo
// di carte francesi. «Con le carte che si alzano quando le selezioni»
// (06/11/2026). Quello che promette a tutti gli stili strutturati — ogni
// voce col suo prezzo, i tasti del menù, niente database — lo prova
// stiliStrutturati.test.jsx; qui i gesti del mazzo.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
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

  // IL MAZZO SI APRE COME LO APRE UN CROUPIER (BUG-143, l'utente,
  // 11/11/2026: «sembra che le carte arrivino dal nulla e troppo
  // velocemente… apri il ventaglio e poi gira tutte le carte»): chiuso al
  // centro e coperto, si stende, poi le carte si girano. Il movimento è del
  // foglio di stile; qui quello che gli serve dalla pagina: quante carte ci
  // sono (per sapere dov'è il centro della fila) e il posto di ognuna.
  it('la fila dice quante carte ha, e ogni carta il suo posto', () => {
    mostra()
    const fila = document.querySelector('.k-fila')
    expect(fila.style.getPropertyValue('--n')).toBe(String(SEZIONI.length))
    expect([...fila.querySelectorAll('.k-carta')].map((c) => c.style.getPropertyValue('--i'))).toEqual(['0', '1', '2'])
    expect([...fila.querySelectorAll('.k-dorso-sotto')].map((c) => c.style.getPropertyValue('--i'))).toEqual(['0', '1', '2'])
  })

  // La prima carta si apre da sola, e aspetta che il mazzo si sia girato:
  // `k-apertura` c'è finché non se ne sceglie una. Scelta una carta, quella
  // si apre subito.
  it('la prima carta aspetta il mazzo; una carta scelta no', async () => {
    mostra()
    const tavolo = document.querySelector('.k-tavolo')
    expect(tavolo).toHaveClass('k-apertura')
    await userEvent.setup().click(mazzo().getByRole('button', { name: 'Gin' }))
    expect(tavolo).not.toHaveClass('k-apertura')
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

  // IL MAZZO RESTA AGGANCIATO IN ALTO (Flavio, 08/11/2026: «mantenere le
  // carte bloccate in alto e rimuovere il tasto che riporta alle carte»).
  // L'aggancio è CSS (position: sticky) e qui non si vede: lo prova chi
  // misura la pagina in un browser. Qui: il tasto non c'è più, il mazzo sa
  // quando è agganciato, e scegliendo una carta da agganciato si torna
  // all'inizio della carta nuova invece di leggerla a metà.
  it('il tasto per tornare alle carte non c’è più: il mazzo resta in alto', () => {
    mostra()
    expect(screen.queryByRole('button', { name: /Le carte/ })).toBeNull()
    expect(within(aperta()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Tana', 'Aggiungi Tana'])
  })
})

describe('il mazzo agganciato in alto', () => {
  // L'osservatore del browser che dice se il segnaposto del mazzo è
  // passato sotto la barra (useIncollata): qui lo si fa scattare a mano.
  let scatta
  class OsservatoreFinto {
    constructor(cb) {
      scatta = (sopra) => cb([{ isIntersecting: !sopra, boundingClientRect: { top: sopra ? -400 : 300 } }])
    }
    observe() {}
    disconnect() {}
  }
  afterEach(() => vi.unstubAllGlobals())

  function mostraAgganciabile() {
    vi.stubGlobal('IntersectionObserver', OsservatoreFinto)
    mostra()
    const segnaposto = document.querySelector('.k-mazzo-segnaposto')
    segnaposto.scrollIntoView = vi.fn()
    return segnaposto
  }

  it('agganciato prende il suo fondo, fermo nella pagina no', () => {
    mostraAgganciabile()
    const nav = screen.getByRole('navigation', { name: 'Le carte del menù' })
    expect(nav).not.toHaveClass('incollata')
    act(() => scatta(true))
    expect(nav).toHaveClass('incollata')
    act(() => scatta(false))
    expect(nav).not.toHaveClass('incollata')
  })

  it('agganciato, una carta scelta si legge dall’inizio', async () => {
    const segnaposto = mostraAgganciabile()
    act(() => scatta(true))
    await userEvent.setup().click(mazzo().getByRole('button', { name: 'Gin' }))
    expect(segnaposto.scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
    expect(within(aperta()).getByRole('heading', { name: 'Gin' })).toBeInTheDocument()
  })

  it('fermo nella pagina, scegliere una carta non sposta la pagina', async () => {
    const segnaposto = mostraAgganciabile()
    await userEvent.setup().click(mazzo().getByRole('button', { name: 'Gin' }))
    expect(segnaposto.scrollIntoView).not.toHaveBeenCalled()
  })

})

describe('le altre pagine', () => {
  it('sulla pagina Special: solo il Jolly, aperto, senza mazzo', () => {
    mostra({ soloSpeciali: true, speciali: SPECIALI })
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(document.querySelector('.k-mazzo-segnaposto')).toBeNull()
    // Senza mazzo non c'è niente da aspettare: il Jolly si apre subito.
    expect(document.querySelector('.k-tavolo')).not.toHaveClass('k-apertura')
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
