'use strict'

// IL DISEGNO DI UN DRINK, COMPOSTO (REQ-MENU-018). L'utente, 29/10/2026:
// «le immagini dei drink dovrebbero rappresentare i drink proprio. Dei
// bicchieri di tipo diverso con decorazioni», col segno «ispirato ai
// disegni originali del libro di Alice» — le incisioni di Tenniel, col
// tratteggio per le ombre.

import { describe, it, expect } from 'vitest'
import {
  BICCHIERI,
  COLORI,
  DECORAZIONI,
  sceltaIllustrazione,
  svgDrink,
  urlDrink,
} from '../../src/lib/illustrazioneDrink.js'

describe('la scelta', () => {
  it('tiene i tre valori conosciuti', () => {
    expect(sceltaIllustrazione({ bicchiere: 'flute', colore: 'pesca', decorazione: 'scorza' })).toEqual({
      bicchiere: 'flute',
      colore: 'pesca',
      decorazione: 'scorza',
    })
  })

  it('un valore sconosciuto ricade sul primo della sua lista, invece di rompere il disegno', () => {
    expect(sceltaIllustrazione({ bicchiere: 'boccale', colore: 'oro', decorazione: 'drago' })).toEqual({
      bicchiere: 'coppa',
      colore: 'rosa',
      decorazione: 'nessuna',
    })
  })

  it('senza una scelta non c’è disegno', () => {
    expect(sceltaIllustrazione(null)).toBeNull()
    expect(sceltaIllustrazione('stregatto')).toBeNull()
    expect(urlDrink(null)).toBeNull()
  })
})

describe('il disegno', () => {
  it('ogni bicchiere con ogni decorazione è un SVG valido', () => {
    for (const b of BICCHIERI) {
      for (const d of DECORAZIONI) {
        const svg = svgDrink({ bicchiere: b.id, colore: 'rosa', decorazione: d.id })
        expect(svg, `${b.id} + ${d.id}`).toMatch(/^<svg [^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/)
        expect(svg.trim().endsWith('</svg>'), `${b.id} + ${d.id}`).toBe(true)
        expect(svg).not.toMatch(/undefined|NaN/)
      }
    }
  })

  it('ha il tratteggio delle incisioni: ombre a linee e liquido a righe', () => {
    const svg = svgDrink({ bicchiere: 'coppa', colore: 'rosso', decorazione: 'cuori' })
    expect(svg).toMatch(/<pattern id="d"/)
    expect(svg).toMatch(/<pattern id="x"/)
    expect(svg).toMatch(/fill="url\(#o\)"/)
  })

  it('il colore del drink è quello scelto', () => {
    for (const c of COLORI) {
      expect(svgDrink({ bicchiere: 'alto', colore: c.id, decorazione: 'nessuna' })).toContain(c.hex)
    }
  })

  it('sui temi scuri il tratto è chiaro, sui temi chiari è scuro', () => {
    const s = { bicchiere: 'martini', colore: 'viola', decorazione: 'ciliegia' }
    expect(svgDrink(s)).toContain('stroke="#f4f0e8"')
    expect(svgDrink(s, { chiaro: true })).toContain('stroke="#1f1b24"')
  })

  it('il cartellino scrive «BEVIMI» nel colore del tratto', () => {
    expect(svgDrink({ bicchiere: 'tazza', colore: 'ambra', decorazione: 'bevimi' }, { chiaro: true })).toMatch(
      /fill="#1f1b24">BEVIMI</
    )
  })

  it('come indirizzo da <img> è un data: URL, e la stessa scelta si disegna una volta', () => {
    const s = { bicchiere: 'balloon', colore: 'verde', decorazione: 'cannuccia' }
    const a = urlDrink(s)
    expect(a.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    expect(urlDrink({ ...s })).toBe(a)
    expect(urlDrink(s, { chiaro: true })).not.toBe(a)
  })
})
