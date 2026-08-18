'use strict'

// COSA DICE LA STRISCIA A SINISTRA. È lo stesso segno in tre schermate, e
// finora diceva una cosa decisa da noi. Dipende invece da come si lavora:
// chi conosce il listino a memoria vuole i colori delle categorie per
// trovare il prodotto al tatto, chi sta finendo le bottiglie vuole vedere
// subito cosa non si può più fare, chi ha già abbastanza colori addosso la
// vuole spenta.

import { describe, it, expect } from 'vitest'
import {
  coloreStriscia,
  scorteDelDrink,
  striscaGuardaLeScorte,
  MODI_STRISCIA,
  MODO_STRISCIA_DEFAULT,
} from '../../src/lib/strisce.js'

const GRIGIO = 'var(--line)'

describe('il colore della striscia', () => {
  const colori = { coloreProdotto: '#ff00aa', coloreCategoria: '#00aaff' }

  it('spenta: grigia, qualunque colore abbia il prodotto', () => {
    expect(coloreStriscia({ modo: 'spenta', ...colori })).toBe(GRIGIO)
  })

  it('prodotto: il suo colore', () => {
    expect(coloreStriscia({ modo: 'prodotto', ...colori })).toBe('#ff00aa')
  })

  it('prodotto senza colore suo: ripiega sulla categoria', () => {
    // Un prodotto senza colore non deve diventare grigio in mezzo a una
    // griglia colorata: si riconosce comunque per famiglia.
    expect(coloreStriscia({ modo: 'prodotto', coloreCategoria: '#00aaff' })).toBe('#00aaff')
  })

  it('categoria: sempre quello della categoria, anche se il prodotto ne ha uno suo', () => {
    // Il colore del singolo prodotto non si perde: lo dice la linguetta.
    expect(coloreStriscia({ modo: 'categoria', ...colori })).toBe('#00aaff')
  })

  it('senza colori da mostrare resta grigia, non sparisce', () => {
    expect(coloreStriscia({ modo: 'prodotto' })).toBe(GRIGIO)
    expect(coloreStriscia({ modo: 'categoria' })).toBe(GRIGIO)
  })

  it('un modo che non conosciamo non rompe la griglia', () => {
    expect(coloreStriscia({ modo: 'chissà', ...colori })).toBe(GRIGIO)
    expect(coloreStriscia()).toBe(GRIGIO)
  })
})

describe('la striscia che dice le scorte', () => {
  const scorta = (scorte, verdeQuandoOk = false) =>
    coloreStriscia({ modo: 'scorte', scorte, verdeQuandoOk, coloreProdotto: '#ff00aa' })

  it('rosso quando un ingrediente è finito', () => {
    expect(scorta('empty')).toBe('#e74c3c')
  })

  it('arancione quando sta finendo', () => {
    expect(scorta('low')).toBe('#f39c12')
  })

  it('«ce n’è abbastanza» è grigio, o verde se lo si vuole', () => {
    expect(scorta('ok')).toBe(GRIGIO)
    expect(scorta('ok', true)).toBe('#2ecc71')
  })

  it('fuori menu è spento, non rotto: grigio anche col verde acceso', () => {
    // Il rosso diceva due cose opposte — «l'ho tolto io» e «è finito il
    // rum» — e il verde direbbe che si può fare, mentre non è in carta.
    expect(scorta('nascosto', true)).toBe(GRIGIO)
  })
})

describe('lo stato di un drink guardando gli ingredienti', () => {
  const statoDi = (i) => i.stato
  const magazzino = {
    rum: { stato: 'ok' },
    lime: { stato: 'low' },
    menta: { stato: 'empty' },
  }
  const drink = (ids, extra = {}) => ({
    available: true,
    recipe_items: ids.map((id) => ({ inventory_item_id: id })),
    ...extra,
  })

  it('il peggiore vince: è quello che impedisce di farlo', () => {
    expect(scorteDelDrink(drink(['rum', 'lime', 'menta']), magazzino, statoDi)).toBe('empty')
    expect(scorteDelDrink(drink(['rum', 'lime']), magazzino, statoDi)).toBe('low')
    expect(scorteDelDrink(drink(['rum']), magazzino, statoDi)).toBe('ok')
  })

  it('un prodotto fuori menu lo dice, prima di guardare le scorte', () => {
    expect(scorteDelDrink(drink(['menta'], { available: false }), magazzino, statoDi)).toBe('nascosto')
  })

  it('gli ingredienti che non stanno in magazzino non fanno testo', () => {
    // Un drink senza ricetta collegata (o con un ingrediente cancellato)
    // non è «esaurito»: semplicemente non lo sappiamo.
    expect(scorteDelDrink(drink(['fantasma']), magazzino, statoDi)).toBe('ok')
    expect(scorteDelDrink({ available: true }, magazzino, statoDi)).toBe('ok')
  })
})

describe('le scorte si caricano solo se servono', () => {
  it('solo il modo «scorte» le guarda', () => {
    expect(striscaGuardaLeScorte('scorte')).toBe(true)
    for (const m of ['spenta', 'prodotto', 'categoria', undefined]) {
      expect(striscaGuardaLeScorte(m)).toBe(false)
    }
  })
})

describe('i modi disponibili', () => {
  it('sono quattro, e ognuno dice cosa fa', () => {
    expect(MODI_STRISCIA.map((m) => m.id)).toEqual(['spenta', 'prodotto', 'categoria', 'scorte'])
    for (const m of MODI_STRISCIA) {
      expect(m.label.length).toBeGreaterThan(2)
      expect(m.desc.length).toBeGreaterThan(10)
    }
  })

  it('quello di partenza è fra quelli', () => {
    expect(MODI_STRISCIA.some((m) => m.id === MODO_STRISCIA_DEFAULT)).toBe(true)
  })
})
