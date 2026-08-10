'use strict'

// Unit test delle personalizzazioni griglia POS (src/lib/posCatalog.js):
// ordine manuale delle card, preferiti, recenti.

import { describe, it, expect } from 'vitest'
import {
  applyOrder,
  moveInOrder,
  toggleFavorite,
  recentDrinkIds,
} from '../../src/lib/posCatalog.js'

const D = (id) => ({ id, name: id })

describe('applyOrder', () => {
  it('ordina secondo la sequenza salvata', () => {
    const out = applyOrder([D('a'), D('b'), D('c')], ['c', 'a', 'b'])
    expect(out.map((d) => d.id)).toEqual(['c', 'a', 'b'])
  })
  it('i drink nuovi (non in sequenza) restano in coda', () => {
    const out = applyOrder([D('a'), D('b'), D('nuovo')], ['b', 'a'])
    expect(out.map((d) => d.id)).toEqual(['b', 'a', 'nuovo'])
  })
  it('nessuna sequenza: ordine invariato', () => {
    const out = applyOrder([D('a'), D('b')], [])
    expect(out.map((d) => d.id)).toEqual(['a', 'b'])
  })
})

describe('moveInOrder', () => {
  const ids = ['a', 'b', 'c', 'd']
  it('sposta un id prima/dopo un altro', () => {
    expect(moveInOrder(ids, 'a', 'c')).toEqual(['b', 'c', 'a', 'd'])
    expect(moveInOrder(ids, 'd', 'a')).toEqual(['d', 'a', 'b', 'c'])
  })
  it('id uguali o assenti: lista invariata', () => {
    expect(moveInOrder(ids, 'a', 'a')).toEqual(ids)
    expect(moveInOrder(ids, 'x', 'b')).toEqual(ids)
  })
})

describe('toggleFavorite', () => {
  it('aggiunge e toglie', () => {
    expect(toggleFavorite([], 'a')).toEqual(['a'])
    expect(toggleFavorite(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('recentDrinkIds', () => {
  const ord = (ids) => ({ order_items: ids.map((id) => ({ drink_id: id })) })
  it('ultimi item distinti, ordine di comparsa, senza custom', () => {
    const orders = [
      { order_items: [{ drink_id: 'mojito' }, { custom: true, drink_id: 'x' }, { drink_id: 'gin' }] },
      ord(['mojito', 'rum']),
    ]
    expect(recentDrinkIds(orders)).toEqual(['mojito', 'gin', 'rum'])
  })
  it('rispetta il limite', () => {
    const orders = [ord(['a', 'b', 'c', 'd'])]
    expect(recentDrinkIds(orders, 2)).toEqual(['a', 'b'])
  })
  it('legge anche dalle comande se mancano gli order_items', () => {
    const orders = [{ comande: [{ items: [{ drink_id: 'gin' }] }, { items: [{ drink_id: 'rum' }] }] }]
    expect(recentDrinkIds(orders)).toEqual(['gin', 'rum'])
  })
})
