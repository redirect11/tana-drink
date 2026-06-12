'use strict'

// Unit test delle opzioni di pagamento al riepilogo (src/lib/payments.js).

import { describe, it, expect } from 'vitest'
import { paymentOptions, isAwaitingPayment } from '../../src/lib/payments.js'

describe('paymentOptions', () => {
  it('tutto spento: nessun pagamento online', () => {
    const o = paymentOptions({})
    expect(o.enabled).toBe(false)
    expect(o.required).toBe(false)
    expect(o.allowCounter).toBe(true)
    expect(o.counterForcesBanco).toBe(false)
  })

  it('online opzionale: scelta paga ora / paga al bancone', () => {
    const o = paymentOptions({ payments_online_enabled: true, service_mode: 'entrambi' })
    expect(o.enabled).toBe(true)
    expect(o.required).toBe(false)
    expect(o.allowCounter).toBe(true)
    expect(o.counterLabel).toContain('bancone')
  })

  it('online obbligatorio: niente opzione bancone', () => {
    const o = paymentOptions({
      payments_online_enabled: true,
      payments_online_required: true,
    })
    expect(o.required).toBe(true)
    expect(o.allowCounter).toBe(false)
  })

  it('obbligatorio richiede online attivo', () => {
    const o = paymentOptions({ payments_online_required: true })
    expect(o.required).toBe(false)
  })

  it('vincolo banco: chi paga dopo ritira al banco', () => {
    const o = paymentOptions({
      payments_online_enabled: true,
      banco_required_if_unpaid: true,
      service_mode: 'entrambi',
    })
    expect(o.counterForcesBanco).toBe(true)
  })

  it('solo tavolo: il vincolo non si applica, si paga allo staff', () => {
    const o = paymentOptions({
      payments_online_enabled: true,
      banco_required_if_unpaid: true,
      service_mode: 'tavolo',
    })
    expect(o.counterForcesBanco).toBe(false)
    expect(o.counterLabel).toContain('staff')
  })

  it('il vincolo non ha effetto se il pagamento è obbligatorio', () => {
    const o = paymentOptions({
      payments_online_enabled: true,
      payments_online_required: true,
      banco_required_if_unpaid: true,
      service_mode: 'entrambi',
    })
    expect(o.counterForcesBanco).toBe(false)
    expect(o.allowCounter).toBe(false)
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
