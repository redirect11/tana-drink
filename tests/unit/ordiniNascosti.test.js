'use strict'

// Conti chiusi qui: spariscono dalla coda SUBITO. La scrittura parte in
// sottofondo, e per un attimo la coda ha ancora la versione di prima:
// tornando dalla schermata del conto lo si vedeva lì, e lo si guardava
// sparire — abbastanza per chiedersi se l'operazione fosse andata.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  nascondiOrdine,
  mostraOrdine,
  ordineNascosto,
  senzaNascosti,
  elencoNascosti,
  subscribeNascosti,
} from '../../src/lib/ordiniNascosti.js'

const ordini = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

beforeEach(() => {
  for (const id of elencoNascosti()) mostraOrdine(id)
})

describe('conti appena chiusi', () => {
  it('nascosto sparisce dalla lista, gli altri restano', () => {
    nascondiOrdine('b')
    expect(senzaNascosti(ordini).map((o) => o.id)).toEqual(['a', 'c'])
  })

  it('senza niente da nascondere la lista è la stessa (nemmeno una copia)', () => {
    expect(senzaNascosti(ordini)).toBe(ordini)
  })

  it('se la scrittura fallisce il conto torna visibile', () => {
    nascondiOrdine('a')
    expect(ordineNascosto('a')).toBe(true)
    mostraOrdine('a')
    expect(ordineNascosto('a')).toBe(false)
    expect(senzaNascosti(ordini)).toHaveLength(3)
  })

  it('scade da sé: un conto non resta invisibile per sempre', () => {
    vi.useFakeTimers()
    try {
      nascondiOrdine('c', 1000)
      expect(ordineNascosto('c')).toBe(true)
      vi.advanceTimersByTime(1500)
      expect(ordineNascosto('c')).toBe(false)
      expect(senzaNascosti(ordini)).toHaveLength(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('la coda viene avvisata quando qualcosa cambia', () => {
    const visti = []
    const stop = subscribeNascosti((elenco) => visti.push([...elenco]))
    nascondiOrdine('a')
    nascondiOrdine('b')
    mostraOrdine('a')
    stop()
    nascondiOrdine('c') // dopo lo stop non arriva più niente
    expect(visti).toEqual([[], ['a'], ['a', 'b'], ['b']])
  })

  it('un id vuoto non nasconde niente (chiamata a vuoto, non un crash)', () => {
    nascondiOrdine(null)
    expect(elencoNascosti()).toEqual([])
  })
})
