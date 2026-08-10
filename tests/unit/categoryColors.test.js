'use strict'

// Colori delle categorie (stile SumUp): assegnazione stabile e deterministica.

import { describe, it, expect } from 'vitest'
import { CATEGORY_PALETTE, categoryColor, drinkCategoryColor } from '../../src/lib/categoryColors.js'

describe('categoryColor', () => {
  it('stabile: stessa chiave → stesso colore', () => {
    expect(categoryColor('birre')).toBe(categoryColor('birre'))
  })
  it('sempre un colore della palette', () => {
    for (const k of ['AMARI', 'BIBITE', 'BIRRE', 'COCKTAIL', 'GIN & VODKA', 'x1', 'x2']) {
      expect(CATEGORY_PALETTE).toContain(categoryColor(k))
    }
  })
  it('chiave vuota → null (nessun angolo colorato)', () => {
    expect(categoryColor('')).toBeNull()
    expect(categoryColor(null)).toBeNull()
  })
})

describe('drinkCategoryColor', () => {
  const cats = [
    { id: 'c-birre', name: 'Birre' },
    { id: 'c-cock', name: 'Cocktail' },
  ]
  it('usa l’id categoria del drink (stabile ai rinomini)', () => {
    const d = { category_id: 'c-birre' }
    expect(drinkCategoryColor(d, cats)).toBe(categoryColor('c-birre'))
  })
  it('fallback sul nome categoria legacy', () => {
    const d = { category: 'Cocktail' }
    expect(drinkCategoryColor(d, cats)).toBe(categoryColor('c-cock'))
  })
  it('drink senza categoria → null', () => {
    expect(drinkCategoryColor({}, cats)).toBeNull()
  })
})
