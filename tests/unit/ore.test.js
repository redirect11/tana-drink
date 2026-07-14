'use strict'

// Unit test del registro ore staff (RAPP ORE) — src/lib/ore.js

import { describe, it, expect } from 'vitest'
import { computeHours, monthKey, monthlyTotals } from '../../src/lib/ore.js'

describe('computeHours', () => {
  it('turno normale, con e senza pausa', () => {
    expect(computeHours('18:00', '23:30')).toBe(5.5)
    expect(computeHours('18:00', '23:30', 30)).toBe(5)
  })

  it('turno OLTRE la mezzanotte (siamo un bar)', () => {
    expect(computeHours('21:00', '02:30')).toBe(5.5)
    expect(computeHours('21:00', '02:30', 30)).toBe(5)
  })

  it('orari non validi → null', () => {
    expect(computeHours('', '23:00')).toBeNull()
    expect(computeHours('25:00', '23:00')).toBeNull()
    expect(computeHours('18:xx', '23:00')).toBeNull()
  })
})

describe('monthKey / monthlyTotals', () => {
  it('chiave mese dalla data', () => {
    expect(monthKey('2026-07-13')).toBe('2026-07')
  })

  it('totali del mese per persona (ordinati) + totale complessivo', () => {
    const { people, total } = monthlyTotals([
      { staff_name: 'Sara', hours: 5.5 },
      { staff_name: 'Marco', hours: 6 },
      { staff_name: 'Sara', hours: 4.5 },
    ])
    expect(total).toBe(16)
    expect(people).toEqual([
      { name: 'Marco', hours: 6, turni: 1 },
      { name: 'Sara', hours: 10, turni: 2 },
    ])
  })
})
