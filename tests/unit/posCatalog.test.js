'use strict'

// Unit test delle personalizzazioni griglia POS (src/lib/posCatalog.js):
// ordine manuale delle card, preferiti, recenti.

import { describe, it, expect } from 'vitest'
import {
  applyOrder,
  moveInOrder,
  toggleFavorite,
  recentDrinkIds,
  prodottoCorrisponde,
  primoProdottoCorrispondente,
  voceMenuCorrisponde,
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

// ── La ricerca nella griglia prodotti ──────────────────────────────────
// Stessa funzione per tutti e due i modi (filtra / accendi): se
// rispondessero in modo diverso, cambiando impostazione lo stesso testo
// troverebbe prodotti diversi.
describe('prodottoCorrisponde', () => {
  const negroni = { id: 'n', name: 'Negroni Sbagliato' }

  it('trova per pezzo di nome, senza badare alle maiuscole', () => {
    expect(prodottoCorrisponde(negroni, 'negro')).toBe(true)
    expect(prodottoCorrisponde(negroni, 'SBAGLIATO')).toBe(true)
    expect(prodottoCorrisponde(negroni, '  bagli ')).toBe(true)
    expect(prodottoCorrisponde(negroni, 'mojito')).toBe(false)
  })

  it('con la ricerca vuota non risponde nessuno', () => {
    // Altrimenti la ricerca vuota accenderebbe la prima card della griglia.
    expect(prodottoCorrisponde(negroni, '')).toBe(false)
    expect(prodottoCorrisponde(negroni, '   ')).toBe(false)
    expect(prodottoCorrisponde(null, 'negro')).toBe(false)
  })

  it('regge un prodotto senza nome', () => {
    expect(prodottoCorrisponde({ id: 'x' }, 'a')).toBe(false)
  })
})

describe('primoProdottoCorrispondente', () => {
  const griglia = [
    { id: '1', name: 'Gin Tonic' },
    { id: '2', name: 'Negroni' },
    { id: '3', name: 'Negroni Sbagliato' },
  ]

  it('accende la PRIMA che risponde, nell ordine in cui sta nella griglia', () => {
    expect(primoProdottoCorrispondente(griglia, 'negro')?.id).toBe('2')
  })

  it('senza risposta torna niente (e la griglia resta com era)', () => {
    expect(primoProdottoCorrispondente(griglia, 'zzz')).toBe(null)
    expect(primoProdottoCorrispondente(griglia, '')).toBe(null)
    expect(primoProdottoCorrispondente(null, 'gin')).toBe(null)
  })
})

// La ricerca del MENÙ guarda più in là del nome: al banco si cerca "quello
// col rum" o si scrive il nome della categoria. Regola unica anche qui, se no
// cambiando impostazione lo stesso testo troverebbe cose diverse.
describe('voceMenuCorrisponde', () => {
  const mojito = {
    id: 'm',
    name: 'Mojito',
    category: 'Cocktail',
    description: 'Fresco, con la menta',
    recipe_items: [{ name: 'Rum bianco' }, { name: 'Lime' }],
  }

  it('trova per nome, categoria, descrizione e ingrediente', () => {
    expect(voceMenuCorrisponde(mojito, 'moji')).toBe(true)
    expect(voceMenuCorrisponde(mojito, 'cocktail')).toBe(true)
    expect(voceMenuCorrisponde(mojito, 'menta')).toBe(true)
    expect(voceMenuCorrisponde(mojito, 'rum')).toBe(true)
    expect(voceMenuCorrisponde(mojito, 'whisky')).toBe(false)
  })

  it('con la ricerca vuota non risponde nessuno', () => {
    expect(voceMenuCorrisponde(mojito, '')).toBe(false)
    expect(voceMenuCorrisponde(mojito, '  ')).toBe(false)
    expect(voceMenuCorrisponde(null, 'moji')).toBe(false)
  })

  it('regge un prodotto spoglio, senza ricetta né descrizione', () => {
    expect(voceMenuCorrisponde({ id: 'x' }, 'a')).toBe(false)
  })
})
