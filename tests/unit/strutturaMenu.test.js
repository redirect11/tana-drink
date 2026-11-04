'use strict'

// LA STRUTTURA DEL MENÙ DEI CLIENTI (REQ-MENU-025). Flavio, 04/11/2026,
// col video del menù sul test: gin e vodka insieme, «Distillati» tutti
// uniti, shot, food e tisane al tavolo, la tonica fra gli ingredienti del
// gin tonic — il gestionale è fatto per il banco, e al tavolo si legge
// un'altra cosa. L'utente, lo stesso giorno: non una carta a parte, ma lo
// stesso menù con la struttura personalizzabile. Sezioni che SEGUONO una
// categoria o con le voci SCELTE A MANO; i testi per il cliente sulla
// scheda prodotto, col ritocco nelle sezioni a mano.

import { describe, it, expect } from 'vitest'
import {
  sezioniDelMenu,
  righeStruttura,
  nomeSezione,
  voceInSezione,
  perIlCliente,
  strutturaPersonalizzata,
  ordina,
  nomeVoce,
  vistaSezione,
} from '../../src/lib/strutturaMenu.js'
import { ingredientiInCarta } from '../../src/lib/ingredientiCarta.js'
import { rigaDelCarrello, chiaveRiga } from '../../src/lib/cart.js'

const CATS = [
  { id: 'distillati', name: 'Distillati', sort_order: 1 },
  { id: 'prezzi', name: 'Voci prezzo', sort_order: 2 },
  { id: 'bibite', name: 'Bibite', sort_order: 3 },
  { id: 'shot', name: 'Shot', sort_order: 4 },
]

// Il gestionale come quello della Tana: prodotti col nome del banco, una
// voce-prezzo, una ricetta con la tonica.
const DRINKS = [
  {
    id: 'mare',
    name: 'MARE',
    nome_cliente: 'Gin Mare tonic',
    category_id: 'distillati',
    price: 8,
    available: true,
    recipe_items: [
      { name: 'Gin Mare', qty: 50, unit: 'ml' },
      { name: 'Tonica', qty: 150, unit: 'ml' },
    ],
  },
  { id: 'sour7', name: 'SOUR 7', category_id: 'prezzi', price: 7, available: true },
  { id: 'acqua', name: 'ACQUA NAT', category_id: 'bibite', price: 1, available: true, description: 'Naturale' },
  { id: 'b52', name: 'B52', category_id: 'shot', price: 4, available: true },
  // Una categoria che non c'è più: il prodotto si porta dietro il nome.
  { id: 'vecchio', name: 'Vecchio', category_id: 'sparita', category: 'Amari', price: 5, available: true },
].map(perIlCliente)

const STRUTTURA = {
  sezioni: [
    { id: 'cocktail', nome: 'Cocktail IBA', ordine: 0, vista: 'dettagliata', categoria_id: null },
    { id: 's-dist', nome: 'Gin selection', ordine: 1, vista: 'dettagliata', categoria_id: 'distillati' },
    { id: 's-bibite', nome: '', ordine: 2, vista: 'snella', categoria_id: 'bibite' },
    { id: 's-prezzi', nome: '', ordine: 3, vista: 'dettagliata', categoria_id: 'prezzi', nascosta: true },
    { id: 'vuota', nome: 'Vuota', ordine: 4, vista: 'dettagliata', categoria_id: null },
  ],
  voci: [
    { id: 'v-collins', sezione_id: 'cocktail', drink_id: 'sour7', nome: 'Tom Collins', ordine: 1 },
    { id: 'v-fizz', sezione_id: 'cocktail', drink_id: 'sour7', nome: 'Gin Fizz', descrizione: 'Gin, limone, soda.', ordine: 0 },
    // Su un prodotto che il menù non ha (spento o tolto): non c'è.
    { id: 'v-spenta', sezione_id: 'vuota', drink_id: 'non-ce', nome: 'Spenta', ordine: 0 },
    // Senza prodotto.
    { id: 'v-sola', sezione_id: 'cocktail', drink_id: null, nome: 'Da collegare', ordine: 2 },
  ],
}

describe('il menù di sempre, finché nessuno tocca la struttura', () => {
  it('senza sezioni scritte la struttura non è personalizzata', () => {
    expect(strutturaPersonalizzata({ sezioni: [], voci: [] })).toBe(false)
    expect(strutturaPersonalizzata(null)).toBe(false)
    expect(strutturaPersonalizzata(STRUTTURA)).toBe(true)
  })

  it('le righe sono le categorie del gestionale, nel loro ordine, non ancora scritte', () => {
    const righe = righeStruttura([], CATS)
    expect(righe.map((r) => [r.id, r.categoria_id])).toEqual([
      [null, 'distillati'],
      [null, 'prezzi'],
      [null, 'bibite'],
      [null, 'shot'],
    ])
    expect(sezioniDelMenu({ sezioni: [], voci: [] }, DRINKS, CATS).map(([n]) => n)).toEqual([
      'Distillati',
      'Voci prezzo',
      'Bibite',
      'Shot',
      'Amari',
    ])
  })
})

describe('la struttura personalizzata', () => {
  const sezioni = sezioniDelMenu(STRUTTURA, DRINKS, CATS)

  it('le sezioni scritte nel loro ordine, poi le categorie che nessuna segue, poi i prodotti senza categoria', () => {
    // «Voci prezzo» è nascosta, «Vuota» non ha voci: non si vedono. «Shot»
    // nessuno l'ha messa in struttura, e compare in fondo da sola.
    expect(sezioni.map(([n]) => n)).toEqual(['Cocktail IBA', 'Gin selection', 'Bibite', 'Shot', 'Amari'])
  })

  it('una sezione che segue una categoria ne mostra i prodotti, anche quelli aggiunti dopo', () => {
    const nuovo = { id: 'hendricks', name: 'HENDRICKS', category_id: 'distillati', price: 9, available: true }
    const [, gin] = sezioniDelMenu(STRUTTURA, [...DRINKS, nuovo], CATS)[1]
    expect(gin.map((d) => d.name)).toEqual(['Gin Mare tonic', 'HENDRICKS'])
  })

  it('una sezione senza nome suo prende quello della categoria', () => {
    expect(nomeSezione({ nome: ' ', categoria_id: 'bibite' }, CATS)).toBe('Bibite')
    expect(nomeSezione({ nome: '', categoria_id: 'sparita' }, CATS)).toBe('Senza nome')
  })

  it('le voci scelte a mano nel loro ordine, due voci sullo stesso prodotto restano due', () => {
    const [, cocktail, info] = sezioni[0]
    expect(cocktail.map((v) => [v.id, v.name, v.drink_id, v.price])).toEqual([
      ['v-fizz', 'Gin Fizz', 'sour7', 7],
      ['v-collins', 'Tom Collins', 'sour7', 7],
    ])
    expect(info).toEqual({ id: 'cocktail', vista: 'dettagliata' })
  })

  // Il prodotto di una voce-prezzo nascosta si ordina lo stesso dalle voci
  // scelte a mano: nascondere la categoria non spegne il prodotto.
  it('una categoria nascosta non spegne i suoi prodotti nelle sezioni a mano', () => {
    expect(sezioni.flatMap(([, l]) => l).filter((d) => d.drink_id === 'sour7')).toHaveLength(2)
  })

  it('una sezione snella non racconta niente', () => {
    const [, bibite, info] = sezioni[2]
    expect(info.vista).toBe('snella')
    expect(bibite[0]).toMatchObject({ name: 'ACQUA NAT', description: null, snella: true })
    expect(ingredientiInCarta(bibite[0])).toBeNull()
  })
})

describe('i testi per il cliente', () => {
  it('il nome per il cliente della scheda vale ovunque, quello del banco resta accanto', () => {
    expect(DRINKS[0]).toMatchObject({ name: 'Gin Mare tonic', nome_gestionale: 'MARE' })
    expect(perIlCliente({ id: 'x', name: 'X', nome_cliente: '  ' })).toEqual({ id: 'x', name: 'X', nome_cliente: '  ' })
  })

  it('una voce a mano può ritoccare nome e descrizione; senza, valgono quelli della scheda', () => {
    const v = voceInSezione({ id: 'v', drink_id: 'mare', nome: '', descrizione: '' }, { ...DRINKS[0], description: 'Dalla scheda' })
    expect(v).toMatchObject({ name: 'Gin Mare tonic', nome_gestionale: 'MARE', description: 'Dalla scheda', voce_carta: 'v' })
    expect(nomeVoce({ nome: 'Il Mare di Flavio' }, DRINKS[0])).toBe('Il Mare di Flavio')
  })

  it('gli ingredienti di una voce a mano: il ritocco, o quelli scritti sulla scheda, mai la ricetta', () => {
    const conRitocco = voceInSezione({ id: 'v', drink_id: 'mare', ingredienti: 'Oliva, basilico' }, DRINKS[0])
    expect(ingredientiInCarta(conRitocco)).toEqual(['Oliva', 'basilico'])
    const dallaScheda = voceInSezione({ id: 'v', drink_id: 'mare' }, { ...DRINKS[0], ingredienti: 'Gin, tonica' })
    expect(ingredientiInCarta(dallaScheda)).toEqual(['Gin', 'tonica'])
    expect(ingredientiInCarta(voceInSezione({ id: 'v', drink_id: 'mare' }, DRINKS[0]))).toBeNull()
    // Fuori dalle voci a mano la ricetta vale come prima.
    expect(ingredientiInCarta(DRINKS[0])).toEqual(['Gin Mare', 'Tonica'])
  })

  it('la vista sconosciuta vale dettagliata', () => {
    expect(vistaSezione('boh')).toBe('dettagliata')
    expect(vistaSezione('snella')).toBe('snella')
  })
})

describe('le righe della struttura, per chi la gestisce', () => {
  it('le sezioni scritte prima, poi le categorie libere; una categoria seguita non si ripete', () => {
    const righe = righeStruttura(STRUTTURA.sezioni, CATS)
    expect(righe.map((r) => r.chiave)).toEqual(['cocktail', 's-dist', 's-bibite', 's-prezzi', 'vuota', 'categoria:shot'])
  })

  it('l’ordine: il numero scelto, poi il nome', () => {
    const l = ordina([
      { nome: 'B', ordine: 1 },
      { nome: 'C', ordine: 0 },
      { nome: 'A', ordine: 1 },
    ])
    expect(l.map((x) => x.nome)).toEqual(['C', 'A', 'B'])
  })
})

// L'ORDINE PORTA IL PRODOTTO DEL GESTIONALE: il banco conosce «SOUR 7», il
// magazzino scala la sua ricetta, le statistiche lo contano. Il nome che ha
// letto il cliente va nella nota, che al banco dice cosa preparare.
describe('nel carrello', () => {
  const [, cocktail] = sezioniDelMenu(STRUTTURA, DRINKS, CATS)[0]

  it('una voce a mano porta il prodotto e il nome del banco, col nome letto nella nota', () => {
    const r = rigaDelCarrello(cocktail[0])
    expect(r).toMatchObject({ drink_id: 'sour7', name: 'SOUR 7', price: 7, qty: 1, riga: 'v-fizz', nome_carta: 'Gin Fizz', note: 'Gin Fizz' })
    expect(chiaveRiga(r)).toBe('v-fizz')
  })

  it('anche un prodotto col nome per il cliente porta quello del banco, con la nota', () => {
    const r = rigaDelCarrello(DRINKS[0])
    expect(r).toMatchObject({ drink_id: 'mare', name: 'MARE', nome_carta: 'Gin Mare tonic', note: 'Gin Mare tonic' })
    expect(chiaveRiga(r)).toBe('mare')
  })

  it('senza nota quando i due nomi sono lo stesso', () => {
    const v = voceInSezione({ id: 'v', drink_id: 'sour7', nome: 'Sour 7' }, DRINKS[1])
    expect(rigaDelCarrello(v).note).toBeUndefined()
  })

  it('un prodotto senza nome per il cliente fa la riga di sempre', () => {
    const r = rigaDelCarrello(DRINKS[1])
    expect(r).toEqual({ drink_id: 'sour7', name: 'SOUR 7', price: 7, qty: 1, sumup_product_id: null })
    expect(chiaveRiga(r)).toBe('sour7')
  })
})
