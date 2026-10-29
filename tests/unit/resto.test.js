'use strict'

// IL RESTO IN CONTANTI (REQ-PAG-015). L'utente, 26/10/2026: «la
// possibilità di inserire quanto il cliente dà e deve uscire quanto resto
// dare».

import { describe, it, expect } from 'vitest'
import { contantiProbabili, restoDa, leggiImporto } from '../../src/lib/resto.js'

describe('i contanti che il cliente porge', () => {
  it('i primi tagli tondi che coprono l’importo, al più quattro', () => {
    expect(contantiProbabili(23.5)).toEqual([25, 30, 50, 100])
    expect(contantiProbabili(4)).toEqual([5, 10, 20, 50])
    expect(contantiProbabili(12)).toEqual([15, 20, 50, 100])
  })

  it('un importo già tondo è il primo, così «giusto» è a un tocco', () => {
    expect(contantiProbabili(20)).toEqual([20, 50, 100, 200])
  })

  it('oltre i cento si propongono le banconote grandi', () => {
    expect(contantiProbabili(87)).toEqual([90, 100, 200])
  })

  it('niente proposte per un importo nullo', () => {
    expect(contantiProbabili(0)).toEqual([])
  })
})

describe('il resto', () => {
  it('ai centesimi, senza gli errori dei decimali', () => {
    expect(restoDa(50, 23.5)).toEqual({ resto: 26.5, mancano: 0 })
    expect(restoDa(20, 12.3)).toEqual({ resto: 7.7, mancano: 0 })
    expect(restoDa(0.3, 0.1)).toEqual({ resto: 0.2, mancano: 0 })
  })

  it('se i contanti non bastano dice quanto manca', () => {
    expect(restoDa(20, 23.5)).toEqual({ resto: 0, mancano: 3.5 })
  })

  it('una cifra a mano si legge con la virgola o col punto', () => {
    expect(leggiImporto('20')).toBe(20)
    expect(leggiImporto('20,50')).toBe(20.5)
    expect(leggiImporto(' 7.5 ')).toBe(7.5)
    expect(leggiImporto('abc')).toBeNull()
    expect(leggiImporto('')).toBeNull()
    expect(leggiImporto('0')).toBeNull()
  })
})
