import { describe, it, expect, vi } from 'vitest'

vi.mock('../../src/lib/api.js', () => ({ fetchCashSessions: async () => [], fetchSerateStoriche: async () => [] }))

import { giornateConServizio } from '../../src/lib/giorniDiServizio.js'

// I GIORNI DI SERVIZIO (REQ-STAT-007), per colorare i calendari: le chiusure
// di cassa dell'app, per giornata commerciale, più le giornate di Tiller.
describe('le giornate con servizio', () => {
  it('una chiusura aperta alle due di notte è della sera prima', () => {
    const g = giornateConServizio([{ opened_at: '2026-08-09T00:30:00.000Z' }], [], 5)
    expect([...g]).toEqual(['2026-08-08'])
  })

  it('le giornate di Tiller si aggiungono così come sono', () => {
    const g = giornateConServizio([{ opened_at: '2026-08-08T17:00:00.000Z' }], [{ giorno: '2024-06-01' }], 5)
    expect(g.has('2024-06-01')).toBe(true)
    expect(g.has('2026-08-08')).toBe(true)
  })

  it('una chiusura senza apertura non conta', () => {
    expect(giornateConServizio([{ opened_at: null }], [], 5).size).toBe(0)
  })
})
