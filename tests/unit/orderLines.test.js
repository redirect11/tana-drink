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
  moveLine,
  reconcileLayout,
  splitAll,
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

describe('moveLine (drag & drop)', () => {
  const ls = [{ line_id: 'a' }, { line_id: 'b' }, { line_id: 'c' }]
  it('sposta un elemento su/giù mantenendo gli altri', () => {
    expect(moveLine(ls, 0, 2).map((l) => l.line_id)).toEqual(['b', 'c', 'a'])
    expect(moveLine(ls, 2, 0).map((l) => l.line_id)).toEqual(['c', 'a', 'b'])
    expect(moveLine(ls, 1, 0).map((l) => l.line_id)).toEqual(['b', 'a', 'c'])
  })
  it('indici uguali o fuori range: lista invariata', () => {
    expect(moveLine(ls, 1, 1)).toBe(ls)
    expect(moveLine(ls, 0, 5)).toBe(ls)
    expect(moveLine(ls, -1, 1)).toBe(ls)
  })
})

describe('reconcileLayout (lista unica confermati + bozza)', () => {
  it('mantiene l’ordine a mano e accoda le chiavi nuove in fondo', () => {
    // Ho riordinato a mano: b prima di a; arriva la nuova chiave d.
    expect(reconcileLayout(['b', 'a', 'c'], ['a', 'b', 'c', 'd'])).toEqual(['b', 'a', 'c', 'd'])
  })
  it('scarta le chiavi sparite (item confermati rimossi/serviti diversamente)', () => {
    expect(reconcileLayout(['b', 'a', 'c'], ['a', 'c'])).toEqual(['a', 'c'])
  })
  it('primo giro (nessun ordine precedente) = ordine naturale', () => {
    expect(reconcileLayout([], ['a', 'b'])).toEqual(['a', 'b'])
    expect(reconcileLayout(undefined, ['a', 'b'])).toEqual(['a', 'b'])
  })
  it('addTop: le chiavi nuove vanno in cima, il riordino resta', () => {
    expect(reconcileLayout(['b', 'a', 'c'], ['a', 'b', 'c', 'd'], true)).toEqual(['d', 'b', 'a', 'c'])
    expect(reconcileLayout([], ['a', 'b'], true)).toEqual(['a', 'b'])
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

// SEPARA TUTTO. Difetto visto al banco: si univa tutto, poi si premeva
// «Separa» e tornavano su solo le ultime voci — le altre mostravano quantità
// 1 e le righe in più non comparivano. Le righe nuove nascevano tutte con lo
// STESSO identificativo, e a schermo le righe si distinguono per quello.
describe('splitAll', () => {
  it('una riga da tre diventa tre righe da uno, ognuna col suo id', () => {
    const out = splitAll([{ line_id: 'a', drink_id: 'x', qty: 3 }], contatore())
    expect(out).toHaveLength(3)
    expect(out.every((l) => l.qty === 1)).toBe(true)
    expect(new Set(out.map((l) => l.line_id)).size).toBe(3)
    // Il primo tiene l'id che aveva: è la riga che si stava guardando.
    expect(out[0].line_id).toBe('a')
  })

  it('separa TUTTE le righe, non solo l’ultima', () => {
    const out = splitAll(
      [
        { line_id: 'a', drink_id: 'x', qty: 2 },
        { line_id: 'b', drink_id: 'y', qty: 3 },
      ],
      contatore()
    )
    expect(out).toHaveLength(5)
    expect(new Set(out.map((l) => l.line_id)).size).toBe(5)
  })

  it('le righe da uno restano come sono', () => {
    const dentro = [{ line_id: 'a', drink_id: 'x', qty: 1 }]
    expect(splitAll(dentro)).toEqual(dentro)
    expect(splitAll([])).toEqual([])
    expect(splitAll(null)).toEqual([])
  })

  // Unisci e poi separa: si deve tornare a tante righe quante erano le unità.
  it('unito e poi separato, il conto delle unità torna', () => {
    const righe = [
      { line_id: 'a', drink_id: 'x', qty: 1 },
      { line_id: 'b', drink_id: 'x', qty: 1 },
      { line_id: 'c', drink_id: 'y', qty: 1 },
    ]
    const unite = mergeLines(righe)
    expect(unite).toHaveLength(2)
    const separate = splitAll(unite, contatore())
    expect(separate).toHaveLength(3)
    expect(new Set(separate.map((l) => l.line_id)).size).toBe(3)
  })
})

// La riprova del difetto: se gli id si ripetono, a schermo le righe in più
// spariscono. Qui si simula come le conta una lista con chiavi uniche.
describe('perché gli id devono essere diversi', () => {
  it('con id ripetuti si perdono le righe', () => {
    const conIdRipetuti = (lines) =>
      (lines || []).flatMap((l) =>
        l.qty > 1 ? Array.from({ length: l.qty }, () => ({ ...l, qty: 1 })) : [l]
      )
    const rotte = conIdRipetuti([{ line_id: 'a', drink_id: 'x', qty: 3 }])
    expect(rotte).toHaveLength(3)
    expect(new Set(rotte.map((l) => l.line_id)).size).toBe(1) // una sola riga a schermo
    const buone = splitAll([{ line_id: 'a', drink_id: 'x', qty: 3 }], contatore())
    expect(new Set(buone.map((l) => l.line_id)).size).toBe(3)
  })
})

// Identificativi finti ma diversi, per non dipendere dal caso.
function contatore() {
  let n = 0
  return () => `nuovo-${++n}`
}
