'use strict'

// Unit test delle opzioni di pagamento al riepilogo (src/lib/payments.js).

import { describe, it, expect } from 'vitest'
import { paymentOptions, isAwaitingPayment } from '../../src/lib/payments.js'
import { CON_LICENZA } from '../helpers/licenza.js'

// Il pagamento online passa da SumUp, che è un modulo (BUG-133): le prove
// delle opzioni partono da un locale che ce l'ha.
const conSumup = (impostazioni) => paymentOptions({ ...CON_LICENZA, ...impostazioni })

describe('paymentOptions', () => {
  it('tutto spento: nessun pagamento online', () => {
    const o = paymentOptions({})
    expect(o.enabled).toBe(false)
    expect(o.required).toBe(false)
    expect(o.allowCounter).toBe(true)
    expect(o.counterForcesBanco).toBe(false)
  })

  it('online opzionale: scelta paga ora / paga al bancone', () => {
    const o = conSumup({ payments_online_enabled: true, service_mode: 'entrambi' })
    expect(o.enabled).toBe(true)
    expect(o.required).toBe(false)
    expect(o.allowCounter).toBe(true)
    expect(o.counterLabel).toContain('bancone')
  })

  it('online obbligatorio: niente opzione bancone', () => {
    const o = conSumup({
      payments_online_enabled: true,
      payments_online_required: true,
    })
    expect(o.required).toBe(true)
    expect(o.allowCounter).toBe(false)
  })

  it('obbligatorio richiede online attivo', () => {
    const o = conSumup({ payments_online_required: true })
    expect(o.required).toBe(false)
  })

  it('vincolo banco: chi paga dopo ritira al banco', () => {
    const o = conSumup({
      payments_online_enabled: true,
      banco_required_if_unpaid: true,
      service_mode: 'entrambi',
    })
    expect(o.counterForcesBanco).toBe(true)
  })

  it('solo tavolo: il vincolo non si applica, si paga allo staff', () => {
    const o = conSumup({
      payments_online_enabled: true,
      banco_required_if_unpaid: true,
      service_mode: 'tavolo',
    })
    expect(o.counterForcesBanco).toBe(false)
    expect(o.counterLabel).toContain('staff')
  })

  it('il vincolo non ha effetto se il pagamento è obbligatorio', () => {
    const o = conSumup({
      payments_online_enabled: true,
      payments_online_required: true,
      banco_required_if_unpaid: true,
      service_mode: 'entrambi',
    })
    expect(o.counterForcesBanco).toBe(false)
    expect(o.allowCounter).toBe(false)
  })
})

// BUG-133: `payments_online_enabled` resta scritto anche quando il modulo
// va via. Con «obbligatorio» acceso, gli ordini nascevano in attesa di un
// pagamento che non si poteva fare.
describe('il pagamento online segue il modulo SumUp', () => {
  const online = { payments_online_enabled: true, payments_online_required: true }

  it('senza il modulo non c’è, e non è obbligatorio', () => {
    const o = paymentOptions({ ...online, licenza: { moduli: { menu_tavoli: true, ordini_cliente: true } } })
    expect(o.enabled).toBe(false)
    expect(o.required).toBe(false)
    expect(o.allowCounter).toBe(true)
  })

  it('con il modulo incluso ma spento nemmeno', () => {
    const o = conSumup({ ...online, modulo_sumup_enabled: false })
    expect(o.enabled).toBe(false)
    expect(o.required).toBe(false)
  })

  it('con il modulo incluso e acceso sì', () => {
    expect(conSumup(online).required).toBe(true)
  })
})

describe('isAwaitingPayment', () => {
  it('vero solo per ordini con pagamento obbligatorio non ancora pagato', () => {
    expect(isAwaitingPayment({ payment_required: true, payment_status: 'in_attesa' })).toBe(true)
    expect(isAwaitingPayment({ payment_required: true, payment_status: 'fallito' })).toBe(true)
    expect(isAwaitingPayment({ payment_required: true, payment_status: 'pagato' })).toBe(false)
    expect(isAwaitingPayment({ payment_required: false, payment_status: 'in_attesa' })).toBe(false)
    expect(isAwaitingPayment(null)).toBe(false)
  })
})
