'use strict'

// Unit test del registro ore staff (RAPP ORE) — src/lib/ore.js

import { describe, it, expect } from 'vitest'
import {
  computeHours,
  monthKey,
  monthlyTotals,
  byDay,
  sumHours,
  monthGrid,
  weekDays,
  shiftDay,
} from '../../src/lib/ore.js'

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

describe('calendario: byDay / sumHours / monthGrid / weekDays / shiftDay', () => {
  const entries = [
    { id: 'a', date: '2026-07-13', staff_name: 'Sara', hours: 5 },
    { id: 'b', date: '2026-07-13', staff_name: 'Marco', hours: 4 },
    { id: 'c', date: '2026-07-14', staff_name: 'Sara', hours: 6 },
  ]

  it('byDay raggruppa per giorno con totale e turni', () => {
    const m = byDay(entries)
    expect(m.get('2026-07-13').total).toBe(9)
    expect(m.get('2026-07-13').entries).toHaveLength(2)
    expect(m.get('2026-07-14').total).toBe(6)
  })

  it('sumHours somma le ore', () => {
    expect(sumHours(entries)).toBe(15)
    expect(sumHours([])).toBe(0)
  })

  it('monthGrid: 42 giorni dal lunedì, flag inMonth', () => {
    const grid = monthGrid('2026-07') // luglio 2026: il 1 è mercoledì
    expect(grid).toHaveLength(42)
    expect(grid[0].date).toBe('2026-06-29') // lunedì prima
    expect(grid[0].inMonth).toBe(false)
    expect(grid.find((c) => c.date === '2026-07-01').inMonth).toBe(true)
  })

  it('weekDays: lun→dom della settimana che contiene la data', () => {
    const w = weekDays('2026-07-15') // mercoledì
    expect(w[0]).toBe('2026-07-13') // lunedì
    expect(w[6]).toBe('2026-07-19') // domenica
  })

  it('shiftDay sposta di N giorni (anche oltre il mese)', () => {
    expect(shiftDay('2026-07-31', 1)).toBe('2026-08-01')
    expect(shiftDay('2026-07-01', -1)).toBe('2026-06-30')
  })
})
