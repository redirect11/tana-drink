'use strict'

// BDD — push cerca-persone (functions/lib/push-core.js → decideStaffCallPush)
// Feature: notificare il membro dello staff chiamato dal bancone.

import { describe, it, expect } from 'vitest'
import {
  decideStaffCallPush,
  decideStaffServePush,
  STAFF_CALL_VIBRATION,
} from '../../functions/lib/push-core.js'

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

const ordine = {
  daily_number: 12,
  status: 'in_preparazione',
  service_mode: 'tavolo',
  table_label: '5',
  customer_name: 'Mario',
}

describe('decideStaffServePush', () => {
  it('notifica lo staff quando un ordine al tavolo è pronto', () => {
    const msg = decideStaffServePush(ordine, { ...ordine, status: 'pronto' })
    expect(msg.title).toContain('da servire')
    expect(msg.body).toContain('#12')
    expect(msg.body).toContain('Tavolo 5')
    expect(msg.body).toContain('Mario')
  })

  it('non notifica il ritiro al banco (lo gestisce il cliente)', () => {
    expect(
      decideStaffServePush(
        { ...ordine, service_mode: 'banco' },
        { ...ordine, service_mode: 'banco', status: 'pronto' }
      )
    ).toBeNull()
  })

  it('non notifica se lo stato non cambia o non è pronto', () => {
    expect(decideStaffServePush(ordine, ordine)).toBeNull()
    expect(decideStaffServePush(ordine, { ...ordine, status: 'ritirato' })).toBeNull()
    expect(
      decideStaffServePush({ ...ordine, status: 'pronto' }, { ...ordine, status: 'pronto' })
    ).toBeNull()
  })

  it('funziona anche senza tavolo e nome', () => {
    const spoglio = { daily_number: 3, status: 'in_preparazione', service_mode: 'tavolo' }
    const msg = decideStaffServePush(spoglio, { ...spoglio, status: 'pronto' })
    expect(msg.body).toBe('Ordine #3')
  })
})
