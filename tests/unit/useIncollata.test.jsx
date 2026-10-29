// @vitest-environment happy-dom
'use strict'

// QUANDO LA FILA DELLE CATEGORIE SI APPICCICA (BUG-120). Ferma nella pagina
// non ha un fondo suo, che faceva una fascia di un altro colore; appiccicata
// sotto la barra in alto le serve, perché le card le scorrono sotto. Lo dice
// `useIncollata`, guardando un segnaposto messo subito prima della barra.

import { describe, it, expect, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { useIncollata } from '../../src/lib/useIncollata.js'

let osservatori = []
class FintoOsservatore {
  constructor(cb, opzioni) {
    this.cb = cb
    this.opzioni = opzioni
    this.chiuso = false
    osservatori.push(this)
  }
  observe(el) {
    this.el = el
  }
  disconnect() {
    this.chiuso = true
  }
  // Il segnaposto è in vista (true) o no, e a che altezza dello schermo.
  segnala(dentro, top) {
    act(() => this.cb([{ isIntersecting: dentro, boundingClientRect: { top } }]))
  }
}

function Barra({ pronta = true }) {
  const [segnaposto, incollata] = useIncollata()
  if (!pronta) return null
  return (
    <>
      <div ref={segnaposto} />
      <nav data-testid="barra" className={incollata ? 'incollata' : ''} />
    </>
  )
}

afterEach(() => {
  osservatori = []
  delete globalThis.IntersectionObserver
})

describe('useIncollata', () => {
  it('ferma nella pagina la barra non è appiccicata; lo diventa quando il segnaposto esce dall’alto', () => {
    globalThis.IntersectionObserver = FintoOsservatore
    const { getByTestId } = render(<Barra />)
    const [o] = osservatori
    // Si guarda la linea a cui la barra si ferma, sotto la barra in alto.
    expect(o.opzioni.rootMargin).toBe('-65px 0px 0px 0px')
    o.segnala(true, 300)
    expect(getByTestId('barra')).not.toHaveClass('incollata')
    o.segnala(false, -20)
    expect(getByTestId('barra')).toHaveClass('incollata')
    o.segnala(true, 120)
    expect(getByTestId('barra')).not.toHaveClass('incollata')
  })

  it('se il segnaposto è fuori dal basso la pagina non ci è ancora arrivata: non è appiccicata', () => {
    globalThis.IntersectionObserver = FintoOsservatore
    const { getByTestId } = render(<Barra />)
    osservatori[0].segnala(false, 1400)
    expect(getByTestId('barra')).not.toHaveClass('incollata')
  })

  // Nel menù la fila compare solo quando le categorie sono arrivate, dopo il
  // primo disegno. La prima versione cercava il segnaposto una volta sola,
  // quando non c'era ancora: sul telefono la barra restava trasparente
  // anche appiccicata, con le card che le passavano sotto.
  it('comincia a osservare anche se la barra compare dopo il primo disegno', () => {
    globalThis.IntersectionObserver = FintoOsservatore
    const { rerender, getByTestId } = render(<Barra pronta={false} />)
    expect(osservatori).toHaveLength(0)
    rerender(<Barra pronta />)
    expect(osservatori).toHaveLength(1)
    osservatori[0].segnala(false, -20)
    expect(getByTestId('barra')).toHaveClass('incollata')
  })

  it('smette di osservare quando la barra se ne va', () => {
    globalThis.IntersectionObserver = FintoOsservatore
    const { unmount } = render(<Barra />)
    unmount()
    expect(osservatori[0].chiuso).toBe(true)
  })

  it('senza IntersectionObserver la barra resta come ferma, senza errori', () => {
    const { getByTestId } = render(<Barra />)
    expect(getByTestId('barra')).not.toHaveClass('incollata')
  })
})
