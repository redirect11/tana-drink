// @vitest-environment happy-dom
// @livello integrazione
// LA PAGINA NON CADE COL TRADUTTORE DEL BROWSER (REQ-CLI-010).
//
// Il traduttore di Chrome sostituisce i testi della pagina con un <font>
// che porta la traduzione: il nodo originale esce dalla pagina. React se lo
// ricorda, e quando vuole toglierlo il browser risponde NotFoundError — la
// pagina bianca. Qui un componente vero, un testo che sparisce accanto a un
// altro, e il «traduttore» che ha già sostituito il nodo.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useState } from 'react'
import { proteggiDalTraduttore } from '../../src/lib/traduttoreBrowser.js'

// Quello che fa il traduttore a un nodo di testo.
function traduci(nodo) {
  const font = document.createElement('font')
  font.textContent = `EN ${nodo.nodeValue}`
  nodo.parentNode.replaceChild(font, nodo)
}

let mostra
function Riga() {
  const [conNota, setConNota] = useState(true)
  mostra = setConNota
  return (
    <p>
      Totale{conNota && ' con servizio'}
      <strong>7,00 €</strong>
    </p>
  )
}

const nodoCon = (radice, testo) => {
  const giro = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT)
  while (giro.nextNode()) if (giro.currentNode.nodeValue === testo) return giro.currentNode
  return null
}

// In sviluppo ogni gesto saltato lo dice in console: qui si ascolta e basta.
// (guardiaConsole.js: chi si aspetta un avviso lo dichiara, test per test.)
let avvisi
beforeEach(() => {
  avvisi = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('il traduttore non fa cadere la pagina', () => {
  // PRIMA della protezione, ed è il motivo per cui c'è: il primo caso di
  // questo file gira senza, gli altri la accendono (una volta accesa resta).
  // Sul DOM e non su React: un React fatto cadere resta rotto per i casi
  // dopo. È la chiamata con cui React toglie un testo che sparisce.
  it('senza protezione, togliere un testo che il traduttore ha spostato è un errore', () => {
    const p = document.createElement('p')
    const testo = document.createTextNode('Totale')
    p.appendChild(testo)
    traduci(testo)
    expect(() => p.removeChild(testo)).toThrow()
  })

  it('con la protezione, un testo tradotto che sparisce non fa cadere React', () => {
    proteggiDalTraduttore()
    const { container } = render(<Riga />)
    traduci(nodoCon(container, ' con servizio'))
    expect(() => act(() => mostra(false))).not.toThrow()
    // Il resto della riga è ancora lì e vivo, e chi sviluppa lo sa.
    expect(avvisi).toHaveBeenCalled()
    expect(container.querySelector('strong').textContent).toBe('7,00 €')
  })

  it('inserire accanto a un testo spostato non fa cadere React', () => {
    proteggiDalTraduttore()
    function Lista() {
      const [prima, setPrima] = useState(false)
      mostra = setPrima
      return (
        <p>
          {prima && <em>nuovo</em>}
          Ordine
        </p>
      )
    }
    const { container } = render(<Lista />)
    traduci(nodoCon(container, 'Ordine'))
    expect(() => act(() => mostra(true))).not.toThrow()
    // e l'elemento nuovo c'è, in fondo invece che perso
    expect(container.querySelector('em')?.textContent).toBe('nuovo')
  })

  // LA REGOLA PER I TESTI CHE CAMBIANO: l'unico figlio del suo elemento.
  // React allora riscrive tutto il contenuto dell'elemento, traduzione
  // compresa, e a schermo c'è il testo nuovo (che il traduttore ritraduce).
  // Accostato ad altri nodi, invece, resta fermo.
  it('un testo che cambia, unico figlio del suo elemento, non resta vecchio', () => {
    let cambia
    function Stato() {
      const [s, setS] = useState('Ordine ricevuto')
      cambia = setS
      return (
        <p>
          🍹 <span>{s}</span> <em>{s}</em>
          {'!'}
        </p>
      )
    }
    const { container } = render(<Stato />)
    traduci(nodoCon(container.querySelector('span'), 'Ordine ricevuto'))
    act(() => cambia('Pronto al servizio'))
    expect(container.querySelector('span').textContent).toBe('Pronto al servizio')
  })

  it('accostato ad altri nodi, invece, resta fermo: è il difetto', () => {
    let cambia
    function Stato() {
      const [s, setS] = useState('Ordine ricevuto')
      cambia = setS
      return <p>🍹 {s}</p>
    }
    const { container } = render(<Stato />)
    traduci(nodoCon(container, 'Ordine ricevuto'))
    act(() => cambia('Pronto al servizio'))
    expect(container.querySelector('p').textContent).toBe('🍹 EN Ordine ricevuto')
  })

  it('fuori dalla traduzione non cambia niente', () => {
    proteggiDalTraduttore()
    proteggiDalTraduttore() // una volta sola, anche chiamata due volte
    const p = document.createElement('p')
    const a = document.createElement('span')
    const b = document.createElement('span')
    p.appendChild(a)
    p.insertBefore(b, a)
    expect([...p.children]).toEqual([b, a])
    expect(p.removeChild(a)).toBe(a)
    expect([...p.children]).toEqual([b])
  })
})
