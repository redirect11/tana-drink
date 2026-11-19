// @vitest-environment happy-dom
// IL MARCHIO DEL PRODOTTO NEL GESTIONALE (REQ-UI-035).
//
// Daniele, 17/11/2026: nel gestionale, in alto, il marchio LIME -
// SmartOrders al posto del nome del locale; le pagine dei clienti restano
// del locale. Il logo è quello della regia, copiato com'è.
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import MarchioLime from '../../src/components/MarchioLime.jsx'
import { readFileSync } from 'node:fs'
import { nelGestionale } from '../../src/lib/sezioni.js'

describe('il marchio LIME - SmartOrders', () => {
  it('dice «Lime» e la qualifica, e il logo è solo decorativo', () => {
    const { container } = render(<MarchioLime />)
    expect(container).toHaveTextContent('Lime SmartOrders')
    expect(screen.getByText('SmartOrders')).toHaveClass('marchio-lime-qualifica')
    const logo = container.querySelector('svg')
    expect(logo).toHaveAttribute('aria-hidden', 'true')
    // La fetta della regia: buccia, polpa, otto spicchi e quello staccato.
    expect(logo.querySelectorAll('line')).toHaveLength(8)
  })

  // È la stessa fetta del logo della demo (clienti/demo/public/favicon.svg),
  // copiata anche lei dalla regia (REQ-DEV-025): se una cambia e l'altra no,
  // la barra del gestionale e la demo mostrerebbero due loghi diversi.
  it('è lo stesso disegno del logo della demo', () => {
    const { container } = render(<MarchioLime />)
    const forme = (radice) =>
      [...radice.querySelectorAll('circle, line, path')].map((n) =>
        [n.tagName.toLowerCase(), ...['cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'd', 'fill'].map((a) => n.getAttribute(a))].join('|')
      )
    const demo = new DOMParser().parseFromString(
      readFileSync('clienti/demo/public/favicon.svg', 'utf8'),
      'image/svg+xml'
    )
    expect(forme(container.querySelector('svg'))).toEqual(forme(demo))
  })
})

// Dove porta il logo in alto: nel gestionale alla coda, altrove alla home
// del locale. Dove si firma il prodotto lo dice marchioDelProdottoInAlto.
describe('che cos’è il gestionale', () => {
  it('coda e sezioni, conto, profilo di chi lavora', () => {
    for (const p of ['/bar', '/pos', '/profilo-staff']) expect(nelGestionale(p), p).toBe(true)
  })

  it('non le pagine dei clienti, anche quando le apre il personale', () => {
    for (const p of ['/', '/menu', '/menu/special', '/ordine/abc', '/ordini', '/accedi', '/profilo', '/barca']) {
      expect(nelGestionale(p), p).toBe(false)
    }
  })
})
