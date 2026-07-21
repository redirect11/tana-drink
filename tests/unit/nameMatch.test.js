'use strict'

// Unit test dell'abbinamento nomi fra gestionale e listino fornitori
// (src/lib/nameMatch.js): casi reali presi dall'inventario del locale.

import { describe, it, expect } from 'vitest'
import { normName, similarity, levenshtein, bestMatch } from '../../src/lib/nameMatch.js'

describe('normName / levenshtein / similarity', () => {
  it('normalizza accenti, maiuscole e punteggiatura', () => {
    expect(normName("Bobby'S")).toBe('bobby s')
    expect(normName('Estathé  Pesca')).toBe('estathe pesca')
  })
  it('levenshtein conta le modifiche', () => {
    expect(levenshtein('gin', 'gin')).toBe(0)
    expect(levenshtein('tallisker', 'talisker')).toBe(1)
  })
  it('similarity è 1 per nomi uguali a meno di forma', () => {
    expect(similarity('Amaro del Capo', 'AMARO DEL CAPO ')).toBe(1)
  })
})

describe('bestMatch: casi veri del locale', () => {
  const listino = [
    'Ca Venezze', 'Campari Soda', 'Cardinal Mendoza', 'Ceres Red Erik',
    'MC Chouffe', 'Cubical Dry', 'Bulleit Rye', 'Coca Cola Zero',
    'Catskill Buckwheat', 'Chinotto', 'Corona', 'JW Black Label',
  ]

  it('refusi: abbina con punteggio alto', () => {
    expect(bestMatch('Ca Veneze', listino)).toMatchObject({ value: 'Ca Venezze' })
    expect(bestMatch('Cardenal Mendoza', listino).value).toBe('Cardinal Mendoza')
    expect(bestMatch('Ceres Red Eric', listino).value).toBe('Ceres Red Erik')
    expect(bestMatch('Camparisoda', listino).score).toBeGreaterThan(0.9)
  })

  it('parole invertite: è lo stesso prodotto', () => {
    const m = bestMatch('Buckwheat Catskill', listino)
    expect(m.value).toBe('Catskill Buckwheat')
    expect(m.reason).toBe('stesse parole')
    expect(m.score).toBeGreaterThan(0.95)
  })

  it('nome contenuto nell’altro', () => {
    expect(bestMatch('Chouffe', listino).value).toBe('MC Chouffe')
    expect(bestMatch('Cubical', listino).value).toBe('Cubical Dry')
    expect(bestMatch('Bulleit', listino).value).toBe('Bulleit Rye')
    expect(bestMatch('Coca Zero', listino).value).toBe('Coca Cola Zero')
    expect(bestMatch('Black Label', listino).value).toBe('JW Black Label')
  })

  it('FALSI AMICI: restano sotto la soglia di sicurezza', () => {
    // Un vino non deve prendere il costo di una bibita.
    expect(bestMatch('Chianti', listino).score).toBeLessThan(0.75)
    expect(bestMatch('Chardonnay', listino).score).toBeLessThan(0.75)
  })

  it('segnala l’ambiguità quando due candidati si equivalgono', () => {
    const m = bestMatch('Tonica', ['Tonica Rossa', 'Tonica Blu'])
    expect(m.ambiguous).toBe(true)
  })

  it('lista vuota → nessun abbinamento', () => {
    expect(bestMatch('Gin', [])).toBeNull()
  })
})

describe('formati diversi: non sono lo stesso articolo', () => {
  it('un numero diverso nel nome tiene il punteggio sotto la soglia', () => {
    // 50 cl non è la bottiglia base, 0% non è la birra alcolica.
    expect(bestMatch('Paulaner 50', ['Paulaner']).score).toBeLessThan(0.9)
    expect(bestMatch('Nastro Azzurro 0', ['Nastro Azzurro']).score).toBeLessThan(0.9)
    expect(bestMatch('Don Papa', ['Don Papa 7 anni']).score).toBeLessThan(0.9)
  })
  it('ma se i numeri coincidono l’abbinamento resta valido', () => {
    expect(bestMatch('Ichnusa 50', ['Ichnusa 50']).score).toBe(1)
    expect(bestMatch('Appleton 12 anni', ['Appleton Estate 12 anni']).score).toBeGreaterThan(0.85)
  })
})
