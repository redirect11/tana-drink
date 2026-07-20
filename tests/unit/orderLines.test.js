'use strict'

// Unit test delle righe d'ordine in composizione (src/lib/orderLines.js):
// niente somma automatica, unione manuale reversibile.

import { describe, it, expect } from 'vitest'
import {
  lineSignature,
  mergeLines,
  hasMergeable,
  splitLine,
  qtyByDrink,
  linesTotal,
} from '../../src/lib/orderLines.js'

const line = (over) => ({ line_id: over.line_id || 'x', drink_id: 'gin', name: 'Gin', price: 8, qty: 1, ...over })

describe('lineSignature', () => {
  it('uguale per drink/nome/prezzo/ricetta uguali, diverso se cambia qualcosa', () => {
    const a = line({})
    expect(lineSignature(a)).toBe(lineSignature(line({ line_id: 'y' }))) // qty/line_id non contano
    expect(lineSignature(a)).not.toBe(lineSignature(line({ price: 5 })))
    expect(lineSignature(a)).not.toBe(lineSignature(line({ name: 'Gin speciale' })))
    expect(lineSignature(a)).not.toBe(lineSignature(line({ custom: true })))
  })
})

describe('mergeLines / hasMergeable', () => {
  it('accorpa le righe uguali sommando le quantità', () => {
    const merged = mergeLines([line({ line_id: 'a' }), line({ line_id: 'b' }), line({ line_id: 'c', drink_id: 'rum', name: 'Rum' })])
    expect(merged).toHaveLength(2)
    expect(merged[0]).toMatchObject({ drink_id: 'gin', qty: 2, line_id: 'a' })
    expect(merged[1]).toMatchObject({ drink_id: 'rum', qty: 1 })
  })
  it('hasMergeable vero solo se ci sono righe uguali', () => {
    expect(hasMergeable([line({ line_id: 'a' }), line({ line_id: 'b' })])).toBe(true)
    expect(hasMergeable([line({ line_id: 'a' }), line({ line_id: 'b', price: 5 })])).toBe(false)
    // item modificato (custom) non si accorpa con l'originale
    expect(hasMergeable([line({ line_id: 'a' }), line({ line_id: 'b', custom: true })])).toBe(false)
  })
})

describe('splitLine', () => {
  it('spezza una riga da N in N righe da 1, id univoci', () => {
    let n = 0
    const out = splitLine([line({ line_id: 'a', qty: 3 })], 'a', () => `new${++n}`)
    expect(out).toHaveLength(3)
    expect(out.every((l) => l.qty === 1)).toBe(true)
    expect(out[0].line_id).toBe('a')
    expect(new Set(out.map((l) => l.line_id)).size).toBe(3)
  })
  it('non tocca le righe da 1', () => {
    const lines = [line({ line_id: 'a', qty: 1 })]
    expect(splitLine(lines, 'a')).toEqual(lines)
  })
})

describe('qtyByDrink / linesTotal', () => {
  it('conta solo il catalogo (i custom escono) e somma il totale', () => {
    const lines = [
      line({ line_id: 'a', qty: 2 }),
      line({ line_id: 'b', drink_id: 'rum', name: 'Rum', price: 6, qty: 1 }),
      line({ line_id: 'c', custom: true, drink_id: 'x', qty: 1 }),
    ]
    expect(qtyByDrink(lines)).toEqual({ gin: 2, rum: 1 })
    expect(linesTotal(lines)).toBe(2 * 8 + 6 + 8)
  })
})
