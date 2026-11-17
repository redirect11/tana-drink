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
import { nelGestionale } from '../../src/lib/prodotto.js'

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
})

describe('dove si firma il prodotto', () => {
  it('nel gestionale: coda e sezioni, conto, profilo di chi lavora', () => {
    for (const p of ['/bar', '/pos', '/profilo-staff']) expect(nelGestionale(p), p).toBe(true)
  })

  it('non nelle pagine dei clienti, anche quando le apre il personale', () => {
    for (const p of ['/', '/menu', '/menu/special', '/ordine/abc', '/ordini', '/accedi', '/profilo', '/barca']) {
      expect(nelGestionale(p), p).toBe(false)
    }
  })
})
