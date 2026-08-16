'use strict'

// IL PERIODO NELLA LISTA ORDINI. Si cercava solo fra gli ultimi conti: per
// ritrovare una serata di due settimane fa non c'era strada. Il selettore è
// quello dei siti degli alberghi — si tocca l'inizio, poi la fine — e le
// giornate sono COMMERCIALI: la serata del venerdì finisce alle quattro del
// sabato, e chi cerca «venerdì» cerca quella.

import { describe, it, expect } from 'vitest'
import {
  piuGiorni,
  normalizzaPeriodo,
  tocca,
  dentroIlPeriodo,
  ordineNelPeriodo,
  etichettaPeriodo,
  grigliaMese,
  periodiRapidi,
} from '../../src/lib/periodo.js'

describe('due tocchi fanno un periodo', () => {
  it('il primo tocco è una serata sola', () => {
    const p = tocca({}, '2026-08-14')
    expect(p).toMatchObject({ da: '2026-08-14', a: '2026-08-14', completo: false })
  })

  it('il secondo arriva fin lì', () => {
    const p = tocca(tocca({}, '2026-08-10'), '2026-08-14')
    expect(p).toMatchObject({ da: '2026-08-10', a: '2026-08-14', completo: true })
  })

  it('anche toccando prima la fine e poi l’inizio', () => {
    const p = tocca(tocca({}, '2026-08-14'), '2026-08-10')
    expect(p).toMatchObject({ da: '2026-08-10', a: '2026-08-14' })
  })

  it('il terzo tocco ricomincia', () => {
    const completo = tocca(tocca({}, '2026-08-10'), '2026-08-14')
    expect(tocca(completo, '2026-08-20')).toMatchObject({ da: '2026-08-20', a: '2026-08-20' })
  })

  it('normalizzaPeriodo rimette in ordine', () => {
    expect(normalizzaPeriodo('2026-08-20', '2026-08-12')).toEqual({
      da: '2026-08-12',
      a: '2026-08-20',
    })
  })
})

describe('chi cade dentro il periodo', () => {
  it('gli estremi ci stanno', () => {
    const p = { da: '2026-08-10', a: '2026-08-14' }
    expect(dentroIlPeriodo('2026-08-10', p)).toBe(true)
    expect(dentroIlPeriodo('2026-08-14', p)).toBe(true)
    expect(dentroIlPeriodo('2026-08-09', p)).toBe(false)
    expect(dentroIlPeriodo('2026-08-15', p)).toBe(false)
  })

  it('senza periodo si vede tutto', () => {
    expect(dentroIlPeriodo('2026-01-01', {})).toBe(true)
  })

  it('un ordine vale per la sua GIORNATA, non per l’orologio', () => {
    // Conto battuto all'una di notte: è ancora la serata prima, ed è lì
    // che chi cerca va a guardare.
    const notturno = { created_at: '2026-08-15T01:30:00.000Z', order_date: '2026-08-14' }
    expect(ordineNelPeriodo(notturno, { da: '2026-08-14', a: '2026-08-14' }, 5)).toBe(true)
    expect(ordineNelPeriodo(notturno, { da: '2026-08-15', a: '2026-08-15' }, 5)).toBe(false)
  })
})

describe('come si legge il periodo scelto', () => {
  const oggi = '2026-08-16'
  it('oggi e ieri si chiamano per nome', () => {
    expect(etichettaPeriodo({ da: oggi, a: oggi }, oggi)).toBe('Oggi')
    expect(etichettaPeriodo({ da: '2026-08-15', a: '2026-08-15' }, oggi)).toBe('Ieri')
  })

  it('un giorno solo, o un intervallo nello stesso mese', () => {
    expect(etichettaPeriodo({ da: '2026-08-12', a: '2026-08-12' }, oggi)).toBe('12 ago')
    expect(etichettaPeriodo({ da: '2026-08-12', a: '2026-08-18' }, oggi)).toBe('12 – 18 ago')
  })

  it('a cavallo di due mesi si scrivono tutti e due', () => {
    expect(etichettaPeriodo({ da: '2025-12-28', a: '2026-01-03' }, oggi)).toBe('28 dic – 3 gen')
  })

  it('senza periodo: sempre', () => {
    expect(etichettaPeriodo({}, oggi)).toBe('Sempre')
  })
})

describe('la griglia del mese', () => {
  it('comincia di lunedì e riempie righe intere', () => {
    // Agosto 2026 comincia di sabato: cinque caselle vuote prima.
    const celle = grigliaMese(2026, 7)
    expect(celle.length % 7).toBe(0)
    expect(celle.slice(0, 5)).toEqual([null, null, null, null, null])
    expect(celle[5]).toBe('2026-08-01')
  })

  it('febbraio bisestile ha i suoi 29 giorni', () => {
    expect(grigliaMese(2028, 1).filter(Boolean)).toHaveLength(29)
  })
})

describe('le scorciatoie', () => {
  it('gli ultimi 7 giorni includono oggi', () => {
    const p = periodiRapidi('2026-08-16').find((x) => x.id === 'settimana').periodo
    expect(p).toMatchObject({ da: '2026-08-10', a: '2026-08-16' })
  })

  it('piuGiorni non inciampa nei cambi di mese', () => {
    expect(piuGiorni('2026-03-01', -1)).toBe('2026-02-28')
    expect(piuGiorni('2026-12-31', 1)).toBe('2027-01-01')
  })
})
