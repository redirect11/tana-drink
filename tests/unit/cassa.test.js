import { describe, it, expect } from 'vitest'
import { cashRecap, ordiniDellaCassaAperta } from '../../src/lib/cassa.js'

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

// Il metodo di pagamento va tracciato SEMPRE, anche uno aggiunto in futuro.
// Prima il secchio era un elenco fisso con fallback su 'banco': la carta di
// credito, che non era in elenco, finiva nel contante e gonfiava il contante
// atteso in cassa — una serata intera contata sbagliata senza un segnale.
const { CASH_METHOD_ORDER } = await import('../../src/lib/orderStatus.js')

describe('metodi di pagamento: elenco aperto', () => {
  const session = { opened_at: '2026-08-08T15:00:00.000Z', fondo_cassa: 100 }
  const conto = (method, amount, at = '2026-08-08T22:00:00.000Z') => ({
    status: 'pagato',
    payment_status: 'pagato',
    paid_at: at,
    total: amount,
    payments: [{ method, amount, at }],
  })

  it('la carta di credito non finisce nei contanti', () => {
    const r = cashRecap([conto('banco', 30), conto('carta', 70)], session, '2026-08-09T02:00:00.000Z')
    expect(r.byMethod.banco).toBe(30)
    expect(r.byMethod.carta).toBe(70)
    expect(r.incassato).toBe(100)
    // In cassa ci devono essere fondo + SOLI contanti.
    expect(r.contanteAtteso).toBe(130)
  })

  it('un metodo mai visto prima viene contato con il suo nome', () => {
    const r = cashRecap([conto('satispay', 50)], session, '2026-08-09T02:00:00.000Z')
    expect(r.byMethod.satispay).toBe(50)
    expect(r.byMethod.banco).toBe(0) // non lo assorbe il contante
    expect(r.incassato).toBe(50)
    expect(r.contanteAtteso).toBe(100) // solo il fondo
  })

  it('i metodi noti ci sono sempre, anche a zero', () => {
    const r = cashRecap([], session, '2026-08-09T02:00:00.000Z')
    for (const k of CASH_METHOD_ORDER) expect(r.byMethod[k]).toBe(0)
  })

  it('senza metodo indicato resta il contante (chiusure vecchie)', () => {
    const r = cashRecap(
      [{ status: 'pagato', payment_status: 'pagato', paid_at: '2026-08-08T22:00:00.000Z', total: 20 }],
      session,
      '2026-08-09T02:00:00.000Z'
    )
    expect(r.byMethod.banco).toBe(20)
  })
})

// Un conto ANNULLATO non ha incassato niente, anche se nel documento è
// rimasto scritto un totale (succede quando si toglie l'ultima riga: l'ordine
// si annulla da solo e l'aggregato resta com'era). Non deve entrare in cassa.
describe('gli annullati non contano', () => {
  const session = { opened_at: '2026-08-09T15:00:00.000Z', fondo_cassa: 0 }
  const annullato = {
    status: 'annullato',
    payment_status: 'non_richiesto',
    total: 4, // resta scritto, ma non è mai stato incassato
    paid_at: null,
    created_at: '2026-08-09T20:00:00.000Z',
  }
  const pagato = {
    status: 'pagato',
    payment_status: 'pagato',
    paid_at: '2026-08-09T21:00:00.000Z',
    total: 10,
    payments: [{ method: 'carta', amount: 10, at: '2026-08-09T21:00:00.000Z' }],
  }

  it('niente incasso e niente conti chiusi in più', () => {
    const r = cashRecap([annullato, pagato], session, '2026-08-10T02:00:00.000Z')
    expect(r.incassato).toBe(10)
    expect(r.nPagati).toBe(1)
    expect(r.byMethod.banco).toBe(0)
  })

  it('e nemmeno fra i conti aperti da incassare', () => {
    const r = cashRecap([annullato], session, '2026-08-10T02:00:00.000Z')
    expect(r.apertoDaIncassare).toBe(0)
    expect(r.nAperti).toBe(0)
  })
})

// I NUMERI IN TESTATA SONO DI QUESTA APERTURA DI CASSA. Chiusa la cassa e
// riaperta, il banco leggeva «0 aperti · 425 chiusi · 10.228,40 €»: erano i
// soldi della serata prima, contati un'altra volta perché il riepilogo
// guardava la GIORNATA e non l'apertura.
describe('i conti di questa apertura di cassa', () => {
  const sessione = { id: 'cassa-2' }
  const ordini = [
    { id: 'a', cash_session_id: 'cassa-1', total: 40 },
    { id: 'b', cash_session_id: 'cassa-2', total: 12 },
    { id: 'c', cash_session_id: 'cassa-2', total: 8 },
  ]

  it('restano solo quelli battuti da quando si è aperto', () => {
    expect(ordiniDellaCassaAperta(ordini, sessione).map((o) => o.id)).toEqual(['b', 'c'])
  })

  it('a cassa chiusa non c’è niente da contare', () => {
    expect(ordiniDellaCassaAperta(ordini, null)).toEqual([])
  })

  it('chi la cassa non la apre mai continua a vedere la giornata', () => {
    // Senza sessione scritta sugli ordini non c'è un'apertura a cui
    // riferirsi: togliere i numeri vorrebbe dire togliere l'unico
    // riepilogo che quel locale ha.
    const senza = [{ id: 'x', total: 10 }, { id: 'y', total: 5 }]
    expect(ordiniDellaCassaAperta(senza, null)).toHaveLength(2)
  })
})
