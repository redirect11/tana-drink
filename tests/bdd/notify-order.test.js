'use strict'

// BDD — notifiche push ordini (functions/lib/push-core.js → decideOrderPush)
// Feature: decidere se e cosa notificare quando un ordine cambia stato.

import { describe, it, expect } from 'vitest'
import { decideOrderPush, CANCEL_PHRASES } from '../../functions/lib/push-core.js'

const base = {
  daily_number: 7,
  push_token: 'tok-1',
  status: 'ricevuto',
}

describe('decideOrderPush', () => {
  it('non notifica senza token push', () => {
    expect(
      decideOrderPush({ ...base, push_token: null }, { ...base, push_token: null, status: 'pronto' })
    ).toBeNull()
  })

  it('non notifica se lo stato non è cambiato', () => {
    expect(decideOrderPush({ ...base, status: 'pronto' }, { ...base, status: 'pronto' })).toBeNull()
  })

  it('notifica quando il drink è pronto', () => {
    const msg = decideOrderPush(base, { ...base, status: 'pronto' })
    expect(msg.title).toContain('pronto')
    expect(msg.body).toContain('#7')
  })

  it('non notifica il passaggio a in_preparazione o ritirato', () => {
    expect(decideOrderPush(base, { ...base, status: 'in_preparazione' })).toBeNull()
    expect(
      decideOrderPush({ ...base, status: 'pronto' }, { ...base, status: 'ritirato' })
    ).toBeNull()
  })

  it('notifica annullamento bartender con notify, con frase e motivazione', () => {
    const after = {
      ...base,
      status: 'annullato',
      cancelled_by: 'bartender',
      cancel_notify: true,
      cancel_phrase: 'staff',
      cancel_message: 'Finito il gin',
    }
    const msg = decideOrderPush(base, after)
    expect(msg.title).toContain('Problema')
    expect(msg.body).toContain(CANCEL_PHRASES.staff)
    expect(msg.body).toContain('Finito il gin')
  })

  it('frase di fallback se cancel_phrase sconosciuta', () => {
    const after = {
      ...base,
      status: 'annullato',
      cancelled_by: 'bartender',
      cancel_notify: true,
      cancel_phrase: 'boh',
    }
    expect(decideOrderPush(base, after).body).toContain(CANCEL_PHRASES.bancone)
  })

  it('non notifica annullamento del cliente o senza spunta notifica', () => {
    expect(
      decideOrderPush(base, { ...base, status: 'annullato', cancelled_by: 'cliente', cancel_notify: true })
    ).toBeNull()
    expect(
      decideOrderPush(base, { ...base, status: 'annullato', cancelled_by: 'bartender', cancel_notify: false })
    ).toBeNull()
  })
})
