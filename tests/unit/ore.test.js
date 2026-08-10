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
  hoursBetweenIso,
  hhmm,
  effVsPlanned,
  peopleOfDay,
  shiftRange,
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

describe('badge: hoursBetweenIso / hhmm / effVsPlanned', () => {
  it('hoursBetweenIso: ore tra due timbrature ISO', () => {
    expect(hoursBetweenIso('2026-07-13T18:00:00.000Z', '2026-07-13T22:30:00.000Z')).toBe(4.5)
    // 15 minuti = 0.25 h
    expect(hoursBetweenIso('2026-07-13T18:00:00.000Z', '2026-07-13T18:15:00.000Z')).toBe(0.25)
  })

  it('hoursBetweenIso: uscita prima dell’entrata o valori invalidi → null', () => {
    expect(hoursBetweenIso('2026-07-13T22:00:00Z', '2026-07-13T18:00:00Z')).toBeNull()
    expect(hoursBetweenIso(null, '2026-07-13T18:00:00Z')).toBeNull()
    expect(hoursBetweenIso('boh', 'boh')).toBeNull()
  })

  it('hhmm: HH:MM locale dall’ISO (vuoto se invalido)', () => {
    // Uso un'ora locale nota per evitare dipendenze dal fuso.
    const iso = new Date(2026, 6, 13, 18, 5).toISOString()
    expect(hhmm(iso)).toBe('18:05')
    expect(hhmm('nope')).toBe('')
  })

  it('effVsPlanned: separa effettivo e programmato e calcola lo scarto', () => {
    const r = effVsPlanned([
      { hours: 5, kind: 'effettivo' },
      { hours: 2.5, kind: 'effettivo' },
      { hours: 8, kind: 'programmato' },
      { hours: 1 }, // senza kind = effettivo
    ])
    expect(r).toEqual({ effettivo: 8.5, programmato: 8, scarto: 0.5 })
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

describe('chi è di turno: shiftRange / peopleOfDay', () => {
  it('shiftRange: turno manuale (start–end), timbratura, aperta, o null', () => {
    expect(shiftRange({ start: '18:00', end: '02:00' })).toBe('18:00–02:00')
    expect(shiftRange({ clock_in: '2026-07-13T18:05:00', clock_out: '2026-07-14T02:10:00' })).toMatch(/–/)
    expect(shiftRange({ clock_in: '2026-07-13T18:05:00', clock_out: null })).toMatch(/…$/)
    expect(shiftRange({ hours: 8 })).toBeNull() // ore importate senza orari
  })

  it('peopleOfDay: raggruppa per persona programmato vs effettivo con orari', () => {
    const gente = peopleOfDay([
      { staff_uid: 'u1', staff_name: 'Marco', kind: 'programmato', hours: 8, start: '18:00', end: '02:00' },
      { staff_uid: 'u1', staff_name: 'Marco', kind: 'effettivo', hours: 8.2, start: '18:05', end: '02:15' },
      { staff_uid: 'u2', staff_name: 'Sara', kind: 'programmato', hours: 5, start: '20:00', end: '01:00' },
    ])
    expect(gente.map((p) => p.name)).toEqual(['Marco', 'Sara']) // ordinati per nome
    const marco = gente.find((p) => p.name === 'Marco')
    expect(marco.programmato.ranges).toEqual(['18:00–02:00'])
    expect(marco.effettivo.ranges).toEqual(['18:05–02:15'])
    expect(marco.effettivo.hours).toBe(8.2)
    const sara = gente.find((p) => p.name === 'Sara')
    expect(sara.effettivo.hours).toBe(0) // solo programmato
  })
})
