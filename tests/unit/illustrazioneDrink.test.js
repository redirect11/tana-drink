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

// IL SEGNO A INCISIONE (REQ-MENU-024): lo stesso drink, disegnato per lo
// stile «Giornale». L'utente, 02/11/2026: «immagini diverse da quelle
// proposte per la tana». Un solo inchiostro, niente acquerello né colore,
// una cornice da lastra; il colore del drink diventa tratteggio più fitto.
describe('il segno a incisione', () => {
  const s = { bicchiere: 'coppa', colore: 'ambra', decorazione: 'agrume' }

  it('niente acquerello e nessun colore oltre l’inchiostro', () => {
    const svg = svgDrink(s, { segno: 'incisione' })
    expect(svg).not.toMatch(/feTurbulence|mix-blend-mode|feGaussianBlur/)
    const colori = new Set([...svg.matchAll(/(?:fill|stroke)="(#[0-9a-f]{6})"/gi)].map((m) => m[1].toLowerCase()))
    expect([...colori]).toEqual(['#eee8da'])
  })

  it('ha la cornice della lastra, e sul fondo chiaro l’inchiostro scuro', () => {
    const svg = svgDrink(s, { segno: 'incisione', chiaro: true })
    expect(svg).toMatch(/<rect x="14" y="14" width="372" height="372"/)
    expect(svg).toContain('#1b1814')
  })

  it('un drink più scuro è un tratteggio più fitto', () => {
    const passo = (colore) => Number(/pattern id="h" width="([\d.]+)"/.exec(svgDrink({ ...s, colore }, { segno: 'incisione' }))[1])
    expect(passo('rosso')).toBeLessThan(passo('giallo'))
  })

  it('il segno di partenza resta quello di prima, e i due non si confondono nella memoria', () => {
    expect(svgDrink(s)).toMatch(/feTurbulence/)
    expect(urlDrink(s, { segno: 'incisione' })).not.toBe(urlDrink(s))
    expect(urlDrink(s, { segno: 'inventato' })).toBe(urlDrink(s))
  })
})
