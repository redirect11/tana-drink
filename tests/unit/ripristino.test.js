'use strict'

// RIAPRIRE UN CONTO = COME SE NON FOSSE MAI STATO PAGATO.
//
// Prima gli incassi restavano attaccati al conto riaperto: le righe già
// pagate non si potevano più toccare — e riaprire serve proprio a toccarle
// (una birra in più, il tavolo sbagliato) — e i soldi restavano nei
// guadagni della serata di un conto che a quel punto era di nuovo da
// incassare. A fine turno lo stesso conto risultava incassato due volte.

import { describe, it, expect } from 'vitest'
import {
  patchRipristino,
  incassatoSuConto,
  comandeRiaperte,
  buoniDaRestituire,
  segnaBuoniRestituiti,
} from '../../src/lib/ripristino.js'
import { ORDER_STATUSES } from '../../src/lib/orderStatus.js'

const ORA = '2026-08-15T21:30:00.000Z'

const contoPagato = () => ({
  payments: [
    { amount: 10, method: 'banco', at: '2026-08-15T20:00:00.000Z', items: [{ drink_id: 'mojito', qty: 1 }] },
    { amount: 5.5, method: 'carta', at: '2026-08-15T20:05:00.000Z', items: [] },
  ],
  payment_status: 'pagato',
  payment_method: 'carta',
  paid_at: '2026-08-15T20:05:00.000Z',
  comande: [{ id: 'c1', status: ORDER_STATUSES.RITIRATO, items: [] }],
})

describe('riaprire un conto', () => {
  it('gli incassi se ne vanno: il conto torna da incassare', () => {
    const p = patchRipristino(contoPagato(), { comande: contoPagato().comande, nowIso: ORA })
    expect(p.payments).toEqual([])
    expect(p.payment_status).toBe('non_richiesto')
    expect(p.payment_method).toBeNull()
    expect(p.paid_at).toBeNull()
  })

  it('quello che era entrato resta scritto, con l’ora in cui è stato tolto', () => {
    // Non si butta via niente: a fine serata si deve poter ricostruire
    // perché la cassa di quel turno è cambiata.
    const p = patchRipristino(contoPagato(), { comande: [], nowIso: ORA })
    expect(p.payments_annullati).toHaveLength(2)
    expect(p.payments_annullati[0]).toMatchObject({ amount: 10, tolto_at: ORA })
  })

  it('i soldi tolti finiscono nella storia del conto', () => {
    const p = patchRipristino(contoPagato(), { comande: [], nowIso: ORA, motivo: 'tavolo sbagliato' })
    expect(p.riaperture.at(-1)).toMatchObject({
      motivo: 'tavolo sbagliato',
      incassi_tolti: 15.5,
    })
  })

  it('riaprendo due volte, la seconda non cancella la prima', () => {
    const primo = patchRipristino(contoPagato(), { comande: [], nowIso: ORA })
    const secondo = patchRipristino(
      { ...contoPagato(), payments_annullati: primo.payments_annullati, riaperture: primo.riaperture },
      { comande: [], nowIso: '2026-08-15T22:00:00.000Z' }
    )
    expect(secondo.payments_annullati).toHaveLength(4)
    expect(secondo.riaperture).toHaveLength(2)
  })

  it('su un conto mai incassato non c’è niente da togliere', () => {
    const p = patchRipristino({ comande: [] }, { comande: [], nowIso: ORA })
    expect(p.payments).toEqual([])
    expect(p.payments_annullati).toEqual([])
    expect(p.riaperture.at(-1).incassi_tolti).toBe(0)
  })

  it('somma quello che è entrato, anche a rate', () => {
    expect(incassatoSuConto(contoPagato())).toBe(15.5)
    expect(incassatoSuConto({})).toBe(0)
  })

  it('tornano da fare solo le comande annullate col conto', () => {
    // Quelle già servite restano servite: il drink è stato bevuto davvero.
    const comande = [
      { id: 'c1', status: ORDER_STATUSES.RITIRATO },
      { id: 'c2', status: ORDER_STATUSES.ANNULLATO },
    ]
    const out = comandeRiaperte(comande, ORA)
    expect(out[0].status).toBe(ORDER_STATUSES.RITIRATO)
    expect(out[1].status).toBe(ORDER_STATUSES.RICEVUTO)
    expect(out[1].status_times[ORDER_STATUSES.RICEVUTO]).toBe(ORA)
  })
})

// IL BUONO NON SI PAGA DUE VOLTE. Il saldo si scala quando il buono si usa,
// non quando i soldi entrano in cassa: se riaprendo il conto la riga di
// incasso sparisce e il saldo resta scalato, il cliente ha pagato due volte
// — una col buono che non torna, una quando ripaga il conto.
describe('i buoni usati per pagare', () => {
  it('tornano al beneficiario, per l’importo usato', () => {
    const conto = {
      payments: [
        { amount: 6, method: 'buono', voucher_id: 'v1' },
        { amount: 4, method: 'banco' },
      ],
    }
    expect(buoniDaRestituire(conto)).toEqual([{ voucher_id: 'v1', amount: 6 }])
  })

  it('due usi dello stesso buono tornano insieme, non a rate', () => {
    const conto = {
      payments: [
        { amount: 6, method: 'buono', voucher_id: 'v1' },
        { amount: 2.5, method: 'buono', voucher_id: 'v1' },
        { amount: 3, method: 'buono', voucher_id: 'v2' },
      ],
    }
    expect(buoniDaRestituire(conto)).toEqual([
      { voucher_id: 'v1', amount: 8.5 },
      { voucher_id: 'v2', amount: 3 },
    ])
  })

  it('senza buoni non torna niente', () => {
    expect(buoniDaRestituire({ payments: [{ amount: 10, method: 'carta' }] })).toEqual([])
    expect(buoniDaRestituire({})).toEqual([])
  })

  it('una riga rotta non fa restituire il nulla', () => {
    // Un incasso col buono senza id, o a zero, non è qualcosa da rimettere
    // a posto: è una riga da ignorare.
    const conto = {
      payments: [
        { amount: 5, method: 'buono' },
        { amount: 0, method: 'buono', voucher_id: 'v1' },
      ],
    }
    expect(buoniDaRestituire(conto)).toEqual([])
  })
})

// UNA VOLTA SOLA. Annullando un conto pagato col buono il saldo torna;
// riaprendo quello stesso conto non deve tornare di nuovo, o si crea
// credito dal nulla — l'errore opposto a quello che si stava correggendo.
describe('un buono non si restituisce due volte', () => {
  const conto = () => ({
    payments: [{ amount: 6, method: 'buono', voucher_id: 'v1' }],
  })

  it('segnata la restituzione, non c’è più niente da restituire', () => {
    const dopoAnnullo = { payments: segnaBuoniRestituiti(conto().payments, ORA) }
    expect(buoniDaRestituire(conto())).toHaveLength(1)
    expect(buoniDaRestituire(dopoAnnullo)).toEqual([])
  })

  it('il segno dice quando: serve a ricostruire cos’è successo', () => {
    expect(segnaBuoniRestituiti(conto().payments, ORA)[0].restituito_at).toBe(ORA)
  })

  it('gli altri incassi non si toccano', () => {
    const misto = [{ amount: 4, method: 'carta' }, { amount: 6, method: 'buono', voucher_id: 'v1' }]
    const out = segnaBuoniRestituiti(misto, ORA)
    expect(out[0]).toEqual(misto[0])
    expect(out[1].restituito_at).toBe(ORA)
  })
})
