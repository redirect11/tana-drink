// @vitest-environment happy-dom
'use strict'

// LO SCONTRINO DI UN CONTO CHIUSO IMPAGATO (REQ-CASSA-016). Richiesta del
// 10/10/2026: «le note appariranno grandi sullo scontrino di chiusura
// tavolo». È il promemoria di chi deve pagare: si guarda la CARTA, come in
// scontrinoChiusura.test.js — in locale la stampante è finta e ogni lavoro
// apre la sua finestra col facsimile.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let finestre

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  finestre = []
  window.open = vi.fn(() => {
    const scritto = []
    finestre.push(scritto)
    return { document: { write: (h) => scritto.push(h), close: () => {} }, focus: () => {} }
  })
  window.Image = class {
    set src(_v) {
      queueMicrotask(() => this.onerror?.(new Error('404')))
    }
  }
  vi.useFakeTimers({ now: Date.parse('2026-10-10T22:30:00.000Z') })
})

afterEach(() => {
  vi.useRealTimers()
})

const carta = (n = 0) => {
  const html = (finestre[n] || []).join('')
  return (html.match(/<pre>([\s\S]*?)<\/pre>/)?.[1] ?? '').replace(/<[^>]+>/g, '')
}

// Nel facsimile il testo in doppia larghezza esce con un carattere ogni due
// colonne: «IMPAGATO» si legge «I M P A G A T O».
const largo = (t) => t.split('').join(' ')

const conto = (extra = {}) => ({
  id: 'ord-1',
  daily_number: 29,
  status: 'aperto',
  payment_status: 'non_richiesto',
  total: 16,
  discount_amount: 0,
  payments: [],
  order_items: [{ drink_id: 'gt', name: 'Gin Tonic', qty: 2, unit_price: 8 }],
  comande: [{ id: 'c1', status: 'ritirato', items: [{ drink_id: 'gt', name: 'Gin Tonic', qty: 2, unit_price: 8 }] }],
  created_at: '2026-10-10T21:00:00.000Z',
  ...extra,
})

describe('lo scontrino dell’impagato', () => {
  it('dice IMPAGATO, quanto c’è da riscuotere e la nota', async () => {
    const { printScontrino } = await import('../../src/lib/printer.js')
    const stampa = printScontrino(
      conto({ impagato: { at: '2026-10-10T22:30:00.000Z', nota: 'Paga Mario domani sera al banco', importo: 16 } })
    )
    await vi.runAllTimersAsync()
    await stampa
    const testo = carta()
    expect(testo).toMatch(/Da riscuotere\s+16\.00€/)
    expect(testo).toContain(largo('IMPAGATO'))
    // La nota è in grande, e va a capo fra le parole, non a metà.
    expect(testo).toContain(largo('Paga Mario domani sera'))
    expect(testo).toContain(largo('al banco'))
    // Nessun metodo di pagamento inventato.
    expect(testo).not.toMatch(/non indicato|Contante/)
  })

  // Pagato dopo, è uno scontrino come gli altri.
  it('pagato in seguito, non dice più impagato', async () => {
    const { printScontrino } = await import('../../src/lib/printer.js')
    const stampa = printScontrino(
      conto({
        status: 'pagato',
        payment_status: 'pagato',
        payments: [{ amount: 16, method: 'banco', at: '2026-10-11T20:00:00.000Z' }],
        impagato: { at: '2026-10-10T22:30:00.000Z', nota: 'Paga Mario', importo: 16 },
      })
    )
    await vi.runAllTimersAsync()
    await stampa
    expect(carta()).not.toContain(largo('IMPAGATO'))
  })
})
