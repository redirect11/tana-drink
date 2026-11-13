'use strict'

// BDD — la voce non disponibile nel menù dei clienti (REQ-MENU-017,
// functions/lib/disponibilita.js). Flavio, 22/10/2026: «se io finisco il gin
// mare … scompare direttamente dal menu». Daniele, 13/11/2026: al cliente non
// si dice mai cosa manca, e la soglia la sceglie il titolare (esaurito o in
// esaurimento). Il segno sta sul prodotto della cassa e lo scrive una
// Function: solo per i prodotti che seguono le giacenze, solo quando la
// giacenza attraversa la soglia, e solo dove cambia.

import { describe, it, expect } from 'vitest'
import { manca, nonDisponibile, haAttraversato, cambiDiDisponibilita, usaIlProdotto, sogliaDi } from '../../functions/lib/disponibilita.js'

const GIN = { stock: 0, low_threshold: 2 }
const TONICA = { stock: 10, low_threshold: 6 }
const LIME = { stock: 0 }
const items = new Map([['gin', GIN], ['tonica', TONICA], ['lime', LIME], ['ghiaccio', { stock: 0 }]])
const GIN_TONIC = {
  id: 'd1',
  segue_giacenze: true,
  recipe_items: [
    { inventory_item_id: 'tonica', name: 'Tonica', unit: 'pz' },
    { inventory_item_id: 'ghiaccio', name: 'Ghiaccio', unit: 'g' },
  ],
}

describe('Feature: quando un ingrediente manca', () => {
  it('esaurito: a zero o sotto; in esaurimento: anche sotto la scorta minima', () => {
    expect(manca(GIN, 'esaurito')).toBe(true)
    expect(manca(TONICA, 'esaurito')).toBe(false)
    expect(manca({ stock: 5, low_threshold: 6 }, 'esaurimento')).toBe(true)
    expect(manca({ stock: 5, low_threshold: 0 }, 'esaurimento')).toBe(false)
    expect(manca(undefined, 'esaurito')).toBe(false)
  })

  it('la soglia di partenza è «esaurito»', () => {
    expect(sogliaDi({})).toBe('esaurito')
    expect(sogliaDi({ menu_soglia_disponibilita: 'esaurimento' })).toBe('esaurimento')
    expect(sogliaDi({ menu_soglia_disponibilita: 'boh' })).toBe('esaurito')
  })
})

describe('Feature: il prodotto della cassa per il cliente', () => {
  // Il ghiaccio a zero non toglie il gin tonic: le righe di servizio non
  // contano (le stesse regole degli ingredienti in carta).
  it('il ghiaccio e la manodopera non contano', () => {
    expect(nonDisponibile(GIN_TONIC, items, {})).toBe(false)
  })

  it('senza «segue le giacenze» resta sempre disponibile', () => {
    const conGin = { ...GIN_TONIC, recipe_items: [{ inventory_item_id: 'gin', name: 'Gin', unit: 'ml' }] }
    expect(nonDisponibile(conGin, items, {})).toBe(true)
    expect(nonDisponibile({ ...conGin, segue_giacenze: false }, items, {})).toBe(false)
  })

  it('con la soglia «in esaurimento» manca anche quello sotto la scorta minima', () => {
    const conTonica = { ...GIN_TONIC, recipe_items: [{ inventory_item_id: 'tonica', name: 'Tonica', unit: 'pz' }] }
    expect(nonDisponibile(conTonica, new Map([['tonica', { stock: 5, low_threshold: 6 }]]), {})).toBe(false)
    expect(nonDisponibile(conTonica, new Map([['tonica', { stock: 5, low_threshold: 6 }]]), { menu_soglia_disponibilita: 'esaurimento' })).toBe(true)
  })
})

describe('Feature: poche scritture', () => {
  // Non a ogni vendita: solo quando la giacenza passa la soglia.
  it('si ricalcola solo se la soglia si attraversa', () => {
    expect(haAttraversato({ stock: 3 }, { stock: 2 }, {})).toBe(false)
    expect(haAttraversato({ stock: 1 }, { stock: 0 }, {})).toBe(true)
    expect(haAttraversato({ stock: 0 }, { stock: 12 }, {})).toBe(true)
    expect(haAttraversato({ stock: 7, low_threshold: 6 }, { stock: 6, low_threshold: 6 }, { menu_soglia_disponibilita: 'esaurimento' })).toBe(true)
  })

  it('si scrive solo dove il segno cambia', () => {
    const drinks = [
      { id: 'a', segue_giacenze: true, recipe_items: [{ inventory_item_id: 'gin', unit: 'ml' }] },
      { id: 'b', segue_giacenze: true, non_disponibile_cliente: true, recipe_items: [{ inventory_item_id: 'gin', unit: 'ml' }] },
      { id: 'c', segue_giacenze: false, non_disponibile_cliente: true, recipe_items: [] },
    ]
    expect(cambiDiDisponibilita(drinks, items, {})).toEqual([
      { id: 'a', valore: true },
      // Spenta l'opzione, il segno vecchio si toglie.
      { id: 'c', valore: false },
    ])
  })

  it('i prodotti della cassa da guardare sono quelli che usano quel prodotto', () => {
    expect(usaIlProdotto(GIN_TONIC, 'tonica')).toBe(true)
    expect(usaIlProdotto(GIN_TONIC, 'gin')).toBe(false)
  })
})

// LE ALTERNATIVE PUBBLICHE DEL CLIENTE (REQ-MENU-042): un sì o un no per
// prodotto, solo per quelli col permesso, e solo quando cambia.
describe('Feature: le alternative che il cliente vede', () => {
  it('accesa la spunta si scrive; spenta si toglie; senza cambi niente', async () => {
    const { alternativaDopo } = await import('../../functions/lib/disponibilita.js')
    expect(alternativaDopo({ stock: 5 }, { stock: 5, scelta_cliente: true }, {})).toEqual({ scrivi: { disponibile: true } })
    expect(alternativaDopo({ stock: 5, scelta_cliente: true }, { stock: 5 }, {})).toEqual({ cancella: true })
    expect(alternativaDopo({ stock: 5, scelta_cliente: true }, { stock: 4, scelta_cliente: true }, {})).toBeNull()
    expect(alternativaDopo({ stock: 1, scelta_cliente: true }, { stock: 0, scelta_cliente: true }, {})).toEqual({ scrivi: { disponibile: false } })
    expect(alternativaDopo(null, { stock: 3 }, {})).toBeNull()
  })
})
