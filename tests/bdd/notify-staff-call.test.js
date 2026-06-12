'use strict'

// BDD — push cerca-persone (functions/lib/push-core.js → decideStaffCallPush)
// Feature: notificare il membro dello staff chiamato dal bancone.

import { describe, it, expect } from 'vitest'
import { decideStaffCallPush, STAFF_CALL_VIBRATION } from '../../functions/lib/push-core.js'

const base = {
  to_uid: 'staff-1',
  to_email: 'giulia@bar.it',
  from_email: 'bartender@bar.it',
  from_name: null,
  message: null,
  status: 'pending',
}

describe('decideStaffCallPush', () => {
  it('non notifica senza chiamata o senza destinatario', () => {
    expect(decideStaffCallPush(null)).toBeNull()
    expect(decideStaffCallPush({ ...base, to_uid: null })).toBeNull()
  })

  it('non notifica chiamate già risposte', () => {
    expect(decideStaffCallPush({ ...base, status: 'acked' })).toBeNull()
  })

  it('notifica la chiamata con il nome del chiamante', () => {
    const msg = decideStaffCallPush({ ...base, from_name: 'Marzia' })
    expect(msg.title).toContain('Chiamata dal bancone')
    expect(msg.body).toContain('Marzia')
  })

  it('non espone mai l’email del chiamante', () => {
    expect(decideStaffCallPush(base).body).not.toContain('@')
    expect(
      decideStaffCallPush({ ...base, message: 'Vieni al bancone' }).body
    ).not.toContain('@')
  })

  it('include il messaggio del bartender quando presente', () => {
    const msg = decideStaffCallPush({ ...base, message: 'Vieni al bancone' })
    expect(msg.body).toContain('«Vieni al bancone»')
    const conNome = decideStaffCallPush({ ...base, from_name: 'Marzia', message: 'Vieni' })
    expect(conNome.body).toContain('Marzia: «Vieni»')
  })

  it('il pattern di vibrazione è forte e riconoscibile', () => {
    expect(STAFF_CALL_VIBRATION.length).toBeGreaterThanOrEqual(5)
    expect(Math.max(...STAFF_CALL_VIBRATION)).toBeGreaterThanOrEqual(500)
  })
})
