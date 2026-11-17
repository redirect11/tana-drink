'use strict'

// Conti chiusi qui: spariscono dalla coda SUBITO. La scrittura parte in
// sottofondo, e per un attimo la coda ha ancora la versione di prima:
// tornando dalla schermata del conto lo si vedeva lì, e lo si guardava
// sparire — abbastanza per chiedersi se l'operazione fosse andata.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  nascondiOrdine,
  nascondiPerAnnullo,
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

// IL CONTO SVUOTATO NASCOSTO NON RICOMPARE (BUG-169). Svuotato un conto, si
// torna alla coda e l'uscita lo nasconde e lo annulla. Finché l'annullo non
// arriva la sua comanda, ormai senza righe, è ancora «ricevuto»: contava
// come lavoro da fare, e il conto vuoto ricompariva per un attimo
// («0 prodotti · 0,00 €») prima di sparire di nuovo. Il conto incassato coi
// drink ancora da fare, invece, resta (BUG-023).
describe('nascosto, ma col lavoro da fare', () => {
  const comanda = (status, items) => ({ id: `c-${status}`, status, items })
  const svuotato = { id: 'vuoto', status: 'aperto', comande: [comanda('ricevuto', [])] }
  const pagatoDaFare = {
    id: 'pagato',
    status: 'pagato',
    comande: [comanda('ricevuto', [{ drink_id: 'negroni', qty: 1 }])],
  }

  it('il conto svuotato resta nascosto; quello pagato coi drink da fare no', async () => {
    const { haLavoroDaFare } = await import('../../src/lib/coda.js')
    nascondiOrdine('vuoto')
    nascondiOrdine('pagato')
    expect(senzaNascosti([svuotato, pagatoDaFare], haLavoroDaFare).map((o) => o.id)).toEqual(['pagato'])
  })

  // Dalla revisione: all'uscita la rimozione dell'ultima riga parte INSIEME
  // all'annullo, e la coda può vedere il conto ancora col suo drink. Per
  // `haLavoroDaFare` è lavoro; ma un conto che si sta annullando da qui non
  // ne ha, e resta nascosto. Il conto pagato coi drink da fare no.
  it('nascosto per annullo resta nascosto anche col drink ancora dentro', async () => {
    const { haLavoroDaFare } = await import('../../src/lib/coda.js')
    const annullando = { ...pagatoDaFare, id: 'annullando', status: 'aperto' }
    nascondiPerAnnullo('annullando')
    nascondiOrdine('pagato')
    expect(senzaNascosti([annullando, pagatoDaFare], haLavoroDaFare).map((o) => o.id)).toEqual(['pagato'])
    // e scade come gli altri: un annullo fallito non lo tiene nascosto per sempre
    mostraOrdine('annullando')
    expect(senzaNascosti([annullando], haLavoroDaFare).map((o) => o.id)).toEqual(['annullando'])
  })
})
