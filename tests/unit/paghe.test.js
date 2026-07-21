'use strict'

// Unit test del costo del personale (src/lib/paghe.js): tariffa oraria per
// persona, storicizzata — le ore di ieri restano pagate come ieri.

import { describe, it, expect } from 'vitest'
import {
  rateAt,
  sortRates,
  upsertRate,
  removeRate,
  entryCost,
  payrollReport,
  costoSuIncasso,
} from '../../src/lib/paghe.js'

// Sara: 9 €/h da gennaio, aumentata a 10 € da marzo.
const sara = [
  { from: '2026-03-01', rate: 10 },
  { from: '2026-01-01', rate: 9 },
]

describe('rateAt (storicizzazione)', () => {
  it('applica la tariffa in vigore quel giorno, non l’ultima', () => {
    expect(rateAt(sara, '2026-01-15')).toBe(9)
    expect(rateAt(sara, '2026-02-28')).toBe(9)
    expect(rateAt(sara, '2026-03-01')).toBe(10) // vale dal giorno stesso
    expect(rateAt(sara, '2026-07-20')).toBe(10)
  })

  it('prima della prima tariffa non si inventa nulla', () => {
    expect(rateAt(sara, '2025-12-31')).toBeNull()
    expect(rateAt([], '2026-01-15')).toBeNull()
    expect(rateAt(sara, null)).toBeNull()
  })

  it('ignora le voci malformate', () => {
    expect(rateAt([{ from: '', rate: 20 }, { from: '2026-01-01', rate: 9 }], '2026-05-01')).toBe(9)
    expect(rateAt([{ from: '2026-01-01', rate: -5 }], '2026-05-01')).toBeNull()
  })
})

describe('sortRates / upsertRate / removeRate', () => {
  it('tiene l’elenco ordinato per decorrenza', () => {
    expect(sortRates(sara).map((r) => r.from)).toEqual(['2026-01-01', '2026-03-01'])
  })
  it('stessa decorrenza: la nuova sostituisce la vecchia', () => {
    const out = upsertRate(sara, { from: '2026-03-01', rate: 11 })
    expect(out).toHaveLength(2)
    expect(rateAt(out, '2026-04-01')).toBe(11)
  })
  it('aggiunge un periodo nuovo e ne rimuove uno', () => {
    const out = upsertRate(sara, { from: '2026-06-01', rate: 12 })
    expect(out).toHaveLength(3)
    expect(rateAt(out, '2026-06-02')).toBe(12)
    expect(removeRate(out, '2026-06-01')).toHaveLength(2)
  })
})

describe('entryCost', () => {
  it('ore × tariffa del giorno del turno', () => {
    expect(entryCost({ date: '2026-01-20', hours: 5 }, sara)).toBe(45)
    expect(entryCost({ date: '2026-03-20', hours: 5 }, sara)).toBe(50)
  })
  it('senza tariffa il costo è sconosciuto, non zero', () => {
    expect(entryCost({ date: '2025-11-01', hours: 5 }, sara)).toBeNull()
    expect(entryCost({ date: '2026-01-20', hours: 0 }, sara)).toBe(0)
  })
})

describe('payrollReport', () => {
  const marco = [{ from: '2026-01-01', rate: 8 }]
  const ratesByName = { Sara: sara, Marco: marco }
  const entries = [
    { staff_name: 'Sara', date: '2026-01-20', hours: 5, kind: 'effettivo' }, // 45
    { staff_name: 'Sara', date: '2026-03-20', hours: 4, kind: 'effettivo' }, // 40
    { staff_name: 'Marco', date: '2026-03-20', hours: 6, kind: 'effettivo' }, // 48
    { staff_name: 'Sara', date: '2026-03-21', hours: 8, kind: 'programmato' }, // previsione
  ]

  it('somma il costo delle ore EFFETTIVE, con la paga del giorno', () => {
    const r = payrollReport(entries, ratesByName)
    expect(r.totale).toBe(133) // 45 + 40 + 48
    expect(r.oreTotali).toBe(15) // le programmate non contano
    expect(r.persone.find((p) => p.name === 'Sara').cost).toBe(85)
    expect(r.parziale).toBe(false)
  })

  it('chi non ha tariffa non azzera il totale: lo dichiara parziale', () => {
    const r = payrollReport(entries, { Sara: sara }) // Marco senza tariffa
    expect(r.totale).toBe(85)
    expect(r.parziale).toBe(true)
    expect(r.senzaTariffa).toEqual(['Marco'])
    expect(r.persone.find((p) => p.name === 'Marco').mancante).toBe(true)
  })
})

describe('costoSuIncasso', () => {
  it('incidenza in percentuale, con un decimale', () => {
    expect(costoSuIncasso(133, 1000)).toBe(13.3)
    expect(costoSuIncasso(0, 1000)).toBe(0)
  })
  it('senza incasso non si calcola', () => {
    expect(costoSuIncasso(133, 0)).toBeNull()
  })
})
