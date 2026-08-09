import { describe, it, expect } from 'vitest'
import { cashRecap } from '../../src/lib/cassa.js'

const session = { opened_at: '2026-07-21T18:00:00.000Z', fondo_cassa: 50 }

describe('cashRecap', () => {
  it('senza sessione → null', () => {
    expect(cashRecap([], null, '2026-07-21T20:00:00.000Z')).toBeNull()
  })

  it('la CARTA non finisce nei contanti (né nel contante atteso in cassa)', () => {
    const orders = [
      { status: 'pagato', payment_status: 'pagato', payment_method: 'banco', total: 10, paid_at: '2026-07-21T19:00:00.000Z' },
      { status: 'pagato', payment_status: 'pagato', payment_method: 'carta', total: 40, paid_at: '2026-07-21T19:30:00.000Z' },
    ]
    const r = cashRecap(orders, session, '2026-07-21T21:00:00.000Z')
    expect(r.incassato).toBe(50)
    expect(r.byMethod.banco).toBe(10)
    expect(r.byMethod.carta).toBe(40)
    // in cassa ci sono solo fondo + contanti: la carta è sul POS esterno
    expect(r.contanteAtteso).toBe(60)
  })

  it('conta incassi (chiusura secca) nella finestra, per metodo e ora', () => {
    const orders = [
      { status: 'pagato', payment_status: 'pagato', payment_method: 'banco', total: 20, paid_at: '2026-07-21T19:30:00.000Z' },
      { status: 'pagato', payment_status: 'pagato', payment_method: 'lettore', total: 15, paid_at: '2026-07-21T20:10:00.000Z' },
      // fuori finestra (prima dell'apertura): non conta
      { status: 'pagato', payment_status: 'pagato', payment_method: 'banco', total: 99, paid_at: '2026-07-21T12:00:00.000Z' },
    ]
    const r = cashRecap(orders, session, '2026-07-21T21:00:00.000Z')
    expect(r.incassato).toBe(35)
    expect(r.byMethod.banco).toBe(20)
    expect(r.byMethod.lettore).toBe(15)
    expect(r.nPagati).toBe(2)
    expect(r.perOra).toEqual([{ ora: '19', importo: 20 }, { ora: '20', importo: 15 }])
    // contante atteso = fondo 50 + contanti 20
    expect(r.contanteAtteso).toBe(70)
  })

  it('acconti (payments[]) contano; il residuo va nel da incassare', () => {
    const orders = [
      {
        status: 'aperto',
        payment_status: 'parziale',
        total: 30,
        payments: [{ amount: 10, method: 'banco', at: '2026-07-21T19:00:00.000Z' }],
      },
    ]
    const r = cashRecap(orders, session, '2026-07-21T21:00:00.000Z')
    expect(r.incassato).toBe(10) // acconto incassato
    expect(r.byMethod.banco).toBe(10)
    expect(r.apertoDaIncassare).toBe(20) // residuo 30-10
    expect(r.nAperti).toBe(1)
    expect(r.nPagati).toBe(0)
  })

  it('conti totalmente aperti → tutto da incassare, niente incassato', () => {
    const orders = [{ status: 'aperto', payment_status: 'ricevuto', total: 25 }]
    const r = cashRecap(orders, session, '2026-07-21T21:00:00.000Z')
    expect(r.incassato).toBe(0)
    expect(r.apertoDaIncassare).toBe(25)
    expect(r.nAperti).toBe(1)
  })

  it('ignora gli ordini annullati', () => {
    const orders = [{ status: 'annullato', payment_status: 'pagato', total: 40, paid_at: '2026-07-21T19:00:00.000Z' }]
    const r = cashRecap(orders, session, '2026-07-21T21:00:00.000Z')
    expect(r.incassato).toBe(0)
    expect(r.apertoDaIncassare).toBe(0)
  })

  it('rispetta il limite superiore di una sessione già chiusa', () => {
    const chiusa = { opened_at: '2026-07-21T18:00:00.000Z', closed_at: '2026-07-21T20:00:00.000Z', fondo_cassa: 0 }
    const orders = [
      { status: 'pagato', payment_status: 'pagato', payment_method: 'banco', total: 10, paid_at: '2026-07-21T19:00:00.000Z' },
      { status: 'pagato', payment_status: 'pagato', payment_method: 'banco', total: 10, paid_at: '2026-07-21T20:30:00.000Z' }, // dopo la chiusura
    ]
    const r = cashRecap(orders, chiusa, '2026-07-21T22:00:00.000Z')
    expect(r.incassato).toBe(10)
  })
})
