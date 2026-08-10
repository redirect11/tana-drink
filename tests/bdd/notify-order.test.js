'use strict'

// BDD — notifiche push ordini (functions/lib/push-core.js → decideOrderPush)
// Feature: decidere se e cosa notificare quando un ordine cambia stato.

import { describe, it, expect } from 'vitest'
import {
  decideOrderPush,
  decideNewOrderStaffPush,
  CANCEL_PHRASES,
} from '../../functions/lib/push-core.js'

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

  it('notifica quando il drink è pronto (ritiro al banco)', () => {
    const msg = decideOrderPush(base, { ...base, status: 'pronto', service_mode: 'banco' })
    expect(msg.title).toContain('pronto')
    expect(msg.body).toContain('#7')
    expect(msg.body).toContain('ritiro')
  })

  it('al TAVOLO non si notifica: al drink ci pensa il servizio', () => {
    // Avvisare chi è seduto che il drink è pronto non gli fa fare nulla:
    // glielo portano. La notifica serve solo se deve venire a ritirarlo.
    expect(decideOrderPush(base, { ...base, status: 'pronto', service_mode: 'tavolo' })).toBeNull()
  })

  it('senza modalità di consegna definita non si notifica il pronto', () => {
    expect(decideOrderPush(base, { ...base, status: 'pronto', service_mode: null })).toBeNull()
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

describe('decideNewOrderStaffPush', () => {
  const ricevuto = { daily_number: 12, status: 'ricevuto' }

  it('notifica un ordine appena creato in stato ricevuto', () => {
    const msg = decideNewOrderStaffPush(null, ricevuto)
    expect(msg.title).toContain('Nuovo ordine')
    expect(msg.body).toContain('#12')
  })

  it('include tavolo e nome cliente quando presenti', () => {
    const msg = decideNewOrderStaffPush(null, {
      ...ricevuto,
      table_label: '5',
      customer_name: 'Anna',
    })
    expect(msg.body).toContain('Tavolo 5')
    expect(msg.body).toContain('Anna')
  })

  it('NON notifica un ordine con pagamento obbligatorio non ancora saldato', () => {
    expect(
      decideNewOrderStaffPush(null, { ...ricevuto, payment_required: true, payment_status: 'in_attesa' })
    ).toBeNull()
  })

  it('notifica quando un ordine obbligatorio passa da non pagato a pagato', () => {
    const before = { ...ricevuto, payment_required: true, payment_status: 'in_attesa' }
    const after = { ...ricevuto, payment_required: true, payment_status: 'pagato' }
    expect(decideNewOrderStaffPush(before, after)).not.toBeNull()
  })

  it('non notifica due volte: era già in coda (ricevuto→pronto non ri-notifica)', () => {
    expect(decideNewOrderStaffPush(ricevuto, { ...ricevuto, status: 'pronto' })).toBeNull()
    // già ricevuto e pagato prima → nessuna nuova notifica
    expect(decideNewOrderStaffPush(ricevuto, ricevuto)).toBeNull()
  })

  it('non notifica stati diversi da ricevuto', () => {
    expect(decideNewOrderStaffPush(null, { ...ricevuto, status: 'in_preparazione' })).toBeNull()
    expect(decideNewOrderStaffPush(null, { ...ricevuto, status: 'pronto' })).toBeNull()
  })
})
