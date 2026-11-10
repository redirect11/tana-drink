'use strict'

// IL MENÙ DEI CLIENTI SI SMISTA PER CATEGORIE (REQ-MENU-035). L'utente,
// 10/11/2026, davanti alla copia del listino della Tana nell'editor:
// «dovresti anche già suddividerli per le categorie … con la possibilità di
// spostare gli item di menu tra le categorie. Quelli fuori categoria li
// mettiamo in una categoria non categorizzati»; «deve essere una vista più
// compatta e maneggevole». Qui la logica: la sezione dei prodotti senza
// categoria, lo spostamento di più voci insieme, la ricerca.

import { describe, it, expect } from 'vitest'
import { prepopolazione, spostamentoInBlocco, voceTrovata, NON_CATEGORIZZATI } from '../../src/lib/strutturaMenu.js'

const CATS = [
  { id: 'gin', name: 'Gin', sort_order: 1 },
  { id: 'vodka', name: 'Vodka', sort_order: 2 },
]

describe('la copia di partenza, divisa per categorie', () => {
  const DRINKS = [
    { id: 'mare', name: 'GIN MARE', category_id: 'gin' },
    { id: 'beluga', name: 'BELUGA', category_id: 'vodka' },
    // Senza categoria: né l'id né un nome che si porta dietro.
    { id: 'coperto', name: 'COPERTO' },
    { id: 'acqua', name: 'ACQUA', category_id: '' },
  ]
  const copia = prepopolazione(DRINKS, CATS)

  it('una sezione per categoria, e i prodotti senza categoria in «Non categorizzati», in fondo', () => {
    expect(copia.sezioni.map((s) => s.nome)).toEqual(['Gin', 'Vodka', NON_CATEGORIZZATI])
    expect(NON_CATEGORIZZATI).toBe('Non categorizzati')
  })

  it('in «Non categorizzati» ci sono proprio quelli senza categoria', () => {
    const sezione = copia.sezioni.find((s) => s.nome === NON_CATEGORIZZATI).chiave
    expect(copia.voci.filter((v) => v.sezione === sezione).map((v) => v.drink_id)).toEqual(['coperto', 'acqua'])
  })

  it('con tutti i prodotti in una categoria, la sezione non c’è', () => {
    expect(prepopolazione(DRINKS.slice(0, 2), CATS).sezioni.map((s) => s.nome)).toEqual(['Gin', 'Vodka'])
  })
})

describe('più voci spostate insieme', () => {
  // «Distillati» con gin e vodka insieme, come nel gestionale: si portano i
  // gin in una sezione loro.
  const CARTA = {
    sezioni: [
      { id: 'distillati', nome: 'Distillati', ordine: 0 },
      { id: 'signature', nome: 'Signature', ordine: 1 },
      { id: 'gin', nome: 'Gin', ordine: 2 },
    ],
    voci: [
      { id: 'v-mare', sezione_id: 'distillati', drink_id: 'mare', nome: 'Gin Mare', ordine: 2 },
      { id: 'v-beluga', sezione_id: 'distillati', drink_id: 'beluga', nome: 'Beluga', ordine: 1 },
      { id: 'v-hendricks', sezione_id: 'distillati', drink_id: 'hendricks', nome: 'Hendrick’s', ordine: 0 },
      { id: 'v-mare-sig', sezione_id: 'signature', drink_id: 'mare', nome: 'Il Mare di Flavio', ordine: 0 },
      { id: 'v-roku', sezione_id: 'gin', drink_id: 'roku', nome: 'Roku', ordine: 0 },
    ],
  }

  it('vanno in fondo alla sezione d’arrivo, nell’ordine in cui stavano', () => {
    expect(spostamentoInBlocco(CARTA, ['v-mare', 'v-hendricks', 'v-mare-sig'], 'gin')).toEqual([
      { id: 'v-hendricks', sezione_id: 'gin', ordine: 1 },
      { id: 'v-mare', sezione_id: 'gin', ordine: 2 },
      { id: 'v-mare-sig', sezione_id: 'gin', ordine: 3 },
    ])
  })

  it('quelle già lì e quelle che non ci sono più non si toccano', () => {
    expect(spostamentoInBlocco(CARTA, ['v-roku', 'v-tolta'], 'gin')).toEqual([])
  })

  it('senza struttura non c’è niente da spostare', () => {
    expect(spostamentoInBlocco(null, ['v-mare'], 'gin')).toEqual([])
  })
})

describe('la ricerca nell’editor', () => {
  const MARE = { id: 'mare', name: 'GIN MARE', nome_cliente: 'Gin Mare tonic' }

  it('trova col nome della voce, con quello per il cliente e con quello della cassa', () => {
    expect(voceTrovata({ nome: 'Il Mare di Flavio' }, MARE, 'flavio')).toBe(true)
    expect(voceTrovata({ nome: '' }, MARE, 'tonic')).toBe(true)
    expect(voceTrovata({ nome: '' }, MARE, 'gin mare')).toBe(true)
    expect(voceTrovata({ nome: '' }, MARE, 'vodka')).toBe(false)
  })

  it('senza badare a maiuscole, accenti e punteggiatura', () => {
    expect(voceTrovata({ nome: 'Caffè corretto' }, null, 'CAFFE')).toBe(true)
    expect(voceTrovata({ nome: 'Hendrick’s' }, null, 'hendrick s')).toBe(true)
  })

  it('una ricerca vuota trova tutto, anche una voce senza prodotto', () => {
    expect(voceTrovata({ nome: '' }, null, '  ')).toBe(true)
  })
})
