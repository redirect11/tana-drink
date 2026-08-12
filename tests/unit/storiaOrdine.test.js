'use strict'

// LA STORIA DI UN CONTO. Un conto riaperto, guardato un'ora dopo, dev'essere
// spiegabile: era chiuso o annullato? chi l'ha riaperto, e perché? Senza
// questo, un conto "in corso" con dentro un incasso è solo un mistero — e i
// misteri, a fine serata, diventano una cassa che non torna.

import { describe, it, expect } from 'vitest'
import { storiaOrdine, ultimaRiapertura, ripristinabile } from '../../src/lib/storiaOrdine.js'

const conto = (over = {}) => ({
  id: 'o1',
  status: 'aperto',
  created_at: '2026-08-12T20:00:00.000Z',
  status_times: {},
  ...over,
})

describe('storiaOrdine', () => {
  it('un conto appena aperto ha una riga sola', () => {
    const s = storiaOrdine(conto())
    expect(s).toHaveLength(1)
    expect(s[0].tipo).toBe('aperto')
  })

  it('chi ha battuto il conto compare accanto all’apertura', () => {
    const s = storiaOrdine(conto({ placed_by: { name: 'Anna', email: 'anna@tana.it' } }))
    expect(s[0].chi).toBe('Anna')
  })

  it('conto chiuso: apertura e chiusura, col metodo di incasso', () => {
    const s = storiaOrdine(
      conto({
        status: 'pagato',
        payment_method: 'banco',
        status_times: { pagato: '2026-08-12T21:30:00.000Z' },
      })
    )
    expect(s.map((e) => e.tipo)).toEqual(['aperto', 'chiuso'])
    expect(s[1].dettaglio).toMatch(/Contante/)
  })

  it('conto annullato: si porta dietro chi e perché', () => {
    const s = storiaOrdine(
      conto({
        status: 'annullato',
        status_times: { annullato: '2026-08-12T21:00:00.000Z' },
        cancelled_by: 'bartender',
        cancel_message: 'Il cliente ha cambiato idea',
      })
    )
    expect(s[1].tipo).toBe('annullato')
    expect(s[1].chi).toBe('bartender')
    expect(s[1].dettaglio).toBe('Il cliente ha cambiato idea')
  })

  it('le riaperture entrano in fila con le altre, in ordine di tempo', () => {
    const s = storiaOrdine(
      conto({
        status_times: { annullato: '2026-08-12T21:00:00.000Z' },
        riaperture: [
          { at: '2026-08-12T21:05:00.000Z', motivo: 'annullato per sbaglio', chi: 'Anna' },
          { at: '2026-08-12T22:00:00.000Z', motivo: null, chi: 'Capo' },
        ],
      })
    )
    expect(s.map((e) => e.tipo)).toEqual(['aperto', 'annullato', 'riaperto', 'riaperto'])
    expect(s[2].dettaglio).toBe('annullato per sbaglio')
    expect(s[3].dettaglio).toBe(null)
  })

  // I conti di ieri non hanno il campo delle riaperture, e non devono
  // rompere niente: la storia si ricostruisce da quello che c'è.
  it('regge un conto vecchio, senza tempi e senza riaperture', () => {
    expect(storiaOrdine({ id: 'x' })).toEqual([])
    expect(storiaOrdine(null)).toEqual([])
  })
})

describe('ultimaRiapertura', () => {
  it('torna la più recente, non l’ultima scritta nell’elenco', () => {
    const r = ultimaRiapertura(
      conto({
        riaperture: [
          { at: '2026-08-12T22:00:00.000Z', motivo: 'la buona' },
          { at: '2026-08-12T21:05:00.000Z', motivo: 'la vecchia' },
        ],
      })
    )
    expect(r.motivo).toBe('la buona')
  })

  it('senza riaperture non torna niente', () => {
    expect(ultimaRiapertura(conto())).toBe(null)
    expect(ultimaRiapertura(null)).toBe(null)
  })
})

describe('ripristinabile', () => {
  it('solo un conto chiuso o annullato', () => {
    expect(ripristinabile(conto({ status: 'pagato' }))).toBe(true)
    expect(ripristinabile(conto({ status: 'annullato' }))).toBe(true)
    expect(ripristinabile(conto({ status: 'aperto' }))).toBe(false)
    expect(ripristinabile(null)).toBe(false)
  })
})

// Su un ordine mappato `status_times` è quello della COMANDA attiva: la
// chiusura del conto non ci sta dentro, sta in `tempi_conto`.
describe('tempi del conto contro tempi della comanda', () => {
  it('legge la chiusura dai tempi del conto, non da quelli della comanda', () => {
    const s = storiaOrdine(
      conto({
        status: 'pagato',
        status_times: { ritirato: '2026-08-12T21:25:00.000Z' },
        tempi_conto: { pagato: '2026-08-12T21:30:00.000Z' },
      })
    )
    expect(s.map((e) => e.tipo)).toEqual(['aperto', 'chiuso'])
    expect(s[1].at).toBe('2026-08-12T21:30:00.000Z')
  })
})
