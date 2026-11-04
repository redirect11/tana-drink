'use strict'

// LA CARTA DEI CLIENTI (REQ-MENU-025): sezioni e voci sue, agganciate al
// menù del gestionale. Flavio, 04/11/2026, col video del menù sul test:
// gin e vodka insieme, «Distillati» tutti uniti, shot, food e tisane al
// tavolo, la tonica fra gli ingredienti del gin tonic — il gestionale è
// fatto per il banco, e al tavolo si legge un'altra cosa.

import { describe, it, expect } from 'vitest'
import { sezioniDellaCarta, voceInCarta, cartaInUso, ordinaCarta, nomeVoce, vistaCarta } from '../../src/lib/carta.js'
import { ingredientiInCarta } from '../../src/lib/ingredientiCarta.js'
import { rigaDelCarrello, chiaveRiga } from '../../src/lib/cart.js'

// Il gestionale come quello della Tana: voci col nome del banco, una
// voce-prezzo, una ricetta con la tonica.
const DRINKS = [
  {
    id: 'mare',
    name: 'MARE',
    price: 8,
    available: true,
    recipe_items: [
      { name: 'Gin Mare', qty: 50, unit: 'ml' },
      { name: 'Tonica', qty: 150, unit: 'ml' },
    ],
  },
  { id: 'sour7', name: 'SOUR 7', price: 7, available: true },
  { id: 'acqua', name: 'ACQUA NAT', price: 1, available: true, description: 'Naturale' },
]

const CARTA = {
  sezioni: [
    { id: 'bibite', nome: 'Bibite', ordine: 2, vista: 'snella' },
    { id: 'gin', nome: 'Gin', ordine: 0, vista: 'dettagliata' },
    { id: 'cocktail', nome: 'Cocktail IBA', ordine: 1, vista: 'dettagliata' },
    { id: 'vuota', nome: 'Vuota', ordine: 3, vista: 'dettagliata' },
  ],
  voci: [
    { id: 'v-mare', sezione_id: 'gin', drink_id: 'mare', nome: 'Gin Mare', descrizione: 'Spagna, mediterraneo.', ingredienti: 'Oliva, basilico, rosmarino', ordine: 0 },
    { id: 'v-collins', sezione_id: 'cocktail', drink_id: 'sour7', nome: 'Tom Collins', ordine: 1 },
    { id: 'v-fizz', sezione_id: 'cocktail', drink_id: 'sour7', nome: 'Gin Fizz', ordine: 0 },
    { id: 'v-acqua', sezione_id: 'bibite', drink_id: 'acqua', nome: 'Acqua naturale', ordine: 0 },
    // Agganciata a una voce che il menù non ha (spenta o tolta): non c'è.
    { id: 'v-spenta', sezione_id: 'vuota', drink_id: 'non-ce', nome: 'Spenta', ordine: 0 },
    // Non agganciata.
    { id: 'v-sola', sezione_id: 'gin', drink_id: null, nome: 'Da agganciare', ordine: 1 },
  ],
}

describe('le sezioni della carta (REQ-MENU-025)', () => {
  it('nell’ordine della carta, con le sole voci agganciate a una voce del menù', () => {
    const sezioni = sezioniDellaCarta(CARTA, DRINKS)
    expect(sezioni.map(([nome]) => nome)).toEqual(['Gin', 'Cocktail IBA', 'Bibite'])
    expect(sezioni[0][1].map((v) => v.name)).toEqual(['Gin Mare'])
    expect(sezioni[1][1].map((v) => v.name)).toEqual(['Gin Fizz', 'Tom Collins'])
    expect(sezioni[2][2]).toEqual({ id: 'bibite', vista: 'snella' })
  })

  it('due voci della carta sulla stessa voce del gestionale restano due voci', () => {
    const [, cocktail] = sezioniDellaCarta(CARTA, DRINKS)[1]
    expect(cocktail.map((v) => v.id)).toEqual(['v-fizz', 'v-collins'])
    expect(cocktail.every((v) => v.drink_id === 'sour7' && v.price === 7)).toBe(true)
  })

  it('senza carta, niente sezioni', () => {
    expect(sezioniDellaCarta(null, DRINKS)).toEqual([])
    expect(sezioniDellaCarta({ sezioni: [], voci: [] }, DRINKS)).toEqual([])
  })
})

describe('una voce della carta', () => {
  it('ha il nome della carta, e il drink del gestionale accanto', () => {
    const v = voceInCarta(CARTA.voci[0], DRINKS[0])
    expect(v).toMatchObject({ id: 'v-mare', drink_id: 'mare', voce_carta: 'v-mare', name: 'Gin Mare', nome_gestionale: 'MARE', price: 8 })
    expect(v.description).toBe('Spagna, mediterraneo.')
  })

  it('senza un nome suo prende quello del gestionale, senza una descrizione sua quella del gestionale', () => {
    const v = voceInCarta({ id: 'x', drink_id: 'acqua', nome: '  ' }, DRINKS[2])
    expect(v.name).toBe('ACQUA NAT')
    expect(v.description).toBe('Naturale')
    expect(nomeVoce({ nome: '' }, DRINKS[2])).toBe('ACQUA NAT')
  })

  it('gli ingredienti sono quelli scritti a mano, mai la ricetta: la tonica non compare', () => {
    expect(ingredientiInCarta(voceInCarta(CARTA.voci[0], DRINKS[0]))).toEqual(['Oliva', 'basilico', 'rosmarino'])
    expect(ingredientiInCarta(voceInCarta({ ...CARTA.voci[0], ingredienti: '' }, DRINKS[0]))).toBeNull()
    // Fuori dalla carta la ricetta vale come prima.
    expect(ingredientiInCarta(DRINKS[0])).toEqual(['Gin Mare', 'Tonica'])
  })

  it('in una sezione snella non racconta niente', () => {
    const v = voceInCarta({ ...CARTA.voci[0] }, DRINKS[0], 'snella')
    expect(v.snella).toBe(true)
    expect(v.description).toBeNull()
    expect(ingredientiInCarta(v)).toBeNull()
  })

  it('la vista sconosciuta vale dettagliata', () => {
    expect(vistaCarta('boh')).toBe('dettagliata')
    expect(vistaCarta('snella')).toBe('snella')
  })
})

// LA CARTA NON SI ACCENDE: è la composizione «Di sala» del menù, scelta
// come uno stile (l'utente, 04/11/2026: «la carta dei clienti è il menù
// stesso, non è una versione diversa del menù»). Prima c'era un
// interruttore suo, `carta_attiva`; adesso decide la composizione in uso.
describe('quando la carta si usa', () => {
  const sezioni = CARTA.sezioni
  it('con la composizione «Di sala» e almeno una sezione', () => {
    expect(cartaInUso('sala', sezioni)).toBe(true)
  })
  it('con la classica no', () => {
    expect(cartaInUso('classica', sezioni)).toBe(false)
  })
  it('«Di sala» ma vuota no: il cliente vede la classica, non un menù vuoto', () => {
    expect(cartaInUso('sala', [])).toBe(false)
    expect(cartaInUso('sala', null)).toBe(false)
  })
})

describe('l’ordine di sezioni e voci', () => {
  it('il numero scelto, poi il nome', () => {
    const l = ordinaCarta([
      { nome: 'B', ordine: 1 },
      { nome: 'C', ordine: 0 },
      { nome: 'A', ordine: 1 },
    ])
    expect(l.map((x) => x.nome)).toEqual(['C', 'A', 'B'])
  })
})

// L'ORDINE PORTA IL DRINK DEL GESTIONALE: il banco conosce «SOUR 7», il
// magazzino scala la sua ricetta, le statistiche lo contano. Il nome della
// carta va nella nota, che al banco dice cosa preparare.
describe('una voce della carta nel carrello', () => {
  const [, cocktail] = sezioniDellaCarta(CARTA, DRINKS)[1]

  it('porta il drink e il nome del gestionale, col nome della carta nella nota', () => {
    const r = rigaDelCarrello(cocktail[0])
    expect(r).toMatchObject({ drink_id: 'sour7', name: 'SOUR 7', price: 7, qty: 1, riga: 'v-fizz', nome_carta: 'Gin Fizz', note: 'Gin Fizz' })
    expect(chiaveRiga(r)).toBe('v-fizz')
  })

  it('senza nota quando i due nomi sono lo stesso', () => {
    const v = voceInCarta({ id: 'v', drink_id: 'mare', nome: 'Mare' }, DRINKS[0])
    expect(rigaDelCarrello(v).note).toBeUndefined()
  })

  it('fuori dalla carta la riga è quella di sempre', () => {
    const r = rigaDelCarrello(DRINKS[1])
    expect(r).toEqual({ drink_id: 'sour7', name: 'SOUR 7', price: 7, qty: 1, sumup_product_id: null })
    expect(chiaveRiga(r)).toBe('sour7')
  })
})
