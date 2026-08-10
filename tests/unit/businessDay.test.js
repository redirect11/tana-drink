'use strict'

// Unit test della GIORNATA COMMERCIALE (src/lib/businessDay.js): sostituisce
// la "serata". Con l'ora di taglio la nottata oltre la mezzanotte resta
// contata nella giornata in cui è cominciata.
// Nota: a luglio Roma è UTC+2, a gennaio UTC+1.

import { describe, it, expect } from 'vitest'
import {
  businessDayKey,
  sameBusinessDay,
  coverageStart,
  businessDayLabel,
  DEFAULT_CUTOFF_HOUR,
} from '../../src/lib/businessDay.js'

describe('businessDayKey', () => {
  it('la sera appartiene al proprio giorno', () => {
    // 21:00 di lunedì 13 luglio 2026 a Roma = 19:00Z
    expect(businessDayKey('2026-07-13T19:00:00.000Z')).toBe('2026-07-13')
  })

  it('dopo la mezzanotte, prima del taglio, resta la nottata di ieri', () => {
    // 01:30 del 14 luglio a Roma = 23:30Z del 13
    expect(businessDayKey('2026-07-13T23:30:00.000Z')).toBe('2026-07-13')
    // 04:59 del 14 luglio a Roma = 02:59Z del 14 → ancora il 13
    expect(businessDayKey('2026-07-14T02:59:00.000Z')).toBe('2026-07-13')
  })

  it('dopo l’ora di taglio comincia la giornata nuova', () => {
    // 05:00 del 14 luglio a Roma = 03:00Z
    expect(businessDayKey('2026-07-14T03:00:00.000Z')).toBe('2026-07-14')
  })

  it('ora di taglio configurabile (0 = giorno solare)', () => {
    // 01:30 del 14 a Roma: con taglio 0 è già il 14
    expect(businessDayKey('2026-07-13T23:30:00.000Z', 0)).toBe('2026-07-14')
    // con taglio 7 anche le 06:00 sono ancora del 13
    expect(businessDayKey('2026-07-14T04:00:00.000Z', 7)).toBe('2026-07-13')
  })

  it('funziona anche in ora solare (gennaio, UTC+1)', () => {
    // 01:30 dell’11 gennaio a Roma = 00:30Z → nottata del 10
    expect(businessDayKey('2026-01-11T00:30:00.000Z')).toBe('2026-01-10')
    // 05:30 dell’11 gennaio a Roma = 04:30Z → giornata dell’11
    expect(businessDayKey('2026-01-11T04:30:00.000Z')).toBe('2026-01-11')
  })

  it('valori non validi → null; taglio fuori scala → default', () => {
    expect(businessDayKey('boh')).toBeNull()
    expect(businessDayKey(null)).toBeNull()
    expect(DEFAULT_CUTOFF_HOUR).toBe(5)
    expect(businessDayKey('2026-07-13T23:30:00.000Z', 99)).toBe('2026-07-13')
  })
})

describe('sameBusinessDay', () => {
  it('sera e notte successiva sono la stessa giornata di lavoro', () => {
    expect(sameBusinessDay('2026-07-13T19:00:00.000Z', '2026-07-13T23:30:00.000Z')).toBe(true)
  })
  it('sere diverse no', () => {
    expect(sameBusinessDay('2026-07-13T19:00:00.000Z', '2026-07-14T19:00:00.000Z')).toBe(false)
  })
})

describe('coverageStart', () => {
  it('torna indietro abbastanza da coprire tutta la giornata commerciale', () => {
    const now = new Date('2026-07-14T02:00:00.000Z')
    expect(coverageStart(now).toISOString()).toBe('2026-07-12T14:00:00.000Z')
  })
})

describe('businessDayLabel', () => {
  const now = '2026-07-14T02:00:00.000Z' // notte: giornata commerciale = 13
  it('oggi / ieri / data estesa', () => {
    expect(businessDayLabel('2026-07-13', now)).toBe('oggi')
    expect(businessDayLabel('2026-07-12', now)).toBe('ieri')
    expect(businessDayLabel('2026-07-01', now)).toMatch(/luglio/)
    expect(businessDayLabel(null, now)).toBe('')
  })
})
