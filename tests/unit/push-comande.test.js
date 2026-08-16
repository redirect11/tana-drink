'use strict'

// Push e pagamenti nel modello conto/comande (functions/lib).

import { describe, it, expect } from 'vitest'
import pushCore from '../../functions/lib/push-core.js'
import payCore from '../../functions/lib/payment-core.js'

const { decideOrderPush, decideStaffServePush, decideNewOrderStaffPush } = pushCore
const { decidePaymentPatch, decideAutoAdvance, isServed } = payCore

const ord = (comande, extra = {}) => ({
  daily_number: 7,
  push_token: 'tok',
  status: 'aperto',
  comande,
  ...extra,
})
const c = (id, status) => ({ id, seq: Number(id.slice(1)), status })

describe('decideOrderPush per comande', () => {
  it('push quando UNA comanda passa a pronto (anche la seconda), col ritiro', () => {
    // Il cliente si avvisa solo se deve venire a ritirare (banco).
    const before = ord([c('c1', 'ritirato'), c('c2', 'in_preparazione')], { service_mode: 'banco' })
    const after = ord([c('c1', 'ritirato'), c('c2', 'pronto')], { service_mode: 'banco' })
    expect(decideOrderPush(before, after)?.title).toContain('pronto')
  })
  it('nessun push se le pronte non aumentano', () => {
    const before = ord([c('c1', 'pronto')])
    const after = ord([c('c1', 'ritirato')])
    expect(decideOrderPush(before, after)).toBeNull()
  })
  it('legacy: status ordine → una comanda equivalente', () => {
    const before = { daily_number: 3, push_token: 't', status: 'in_preparazione', service_mode: 'banco' }
    const after = { daily_number: 3, push_token: 't', status: 'pronto', service_mode: 'banco' }
    expect(decideOrderPush(before, after)).not.toBeNull()
  })
})

describe('decideStaffServePush / decideNewOrderStaffPush', () => {
  it('staff avvisato per ogni comanda pronta al tavolo', () => {
    const before = ord([c('c1', 'ritirato'), c('c2', 'in_preparazione')], { service_mode: 'tavolo' })
    const after = ord([c('c1', 'ritirato'), c('c2', 'pronto')], { service_mode: 'tavolo' })
    expect(decideStaffServePush(before, after)).not.toBeNull()
  })
  it('nuova comanda su conto esistente → "aggiunta al conto"', () => {
    const before = ord([c('c1', 'ritirato')])
    const after = ord([c('c1', 'ritirato'), c('c2', 'ricevuto')])
    const msg = decideNewOrderStaffPush(before, after)
    expect(msg?.title).toContain('Aggiunta')
  })
  it('creazione: primo invio resta "nuovo ordine"', () => {
    const after = ord([c('c1', 'ricevuto')])
    expect(decideNewOrderStaffPush(null, after)?.title).toContain('Nuovo ordine')
  })
  // IL RUOLO NON DICE DOVE SEI. Queste due prove dicevano il contrario —
  // «battuto da un gestore, nessuna notifica» — perché si dava per scontato
  // che admin e bartender stessero al banco. Chi prende ordini ai tavoli col
  // telefono e un account da gestore non faceva squillare niente a nessuno:
  // al banco l'ordine arrivava in silenzio. Ora l'avviso parte sempre, e a
  // saltarlo è il solo terminale che l'ha mandato (destinatariPush).
  it('ordine inserito dal bartender: la notifica parte lo stesso', () => {
    const after = ord([c('c1', 'ricevuto')], { placed_by: { role: 'bartender' } })
    expect(decideNewOrderStaffPush(null, after)?.title).toContain('Nuovo ordine')
  })
  it("ordine inserito dall'admin: la notifica parte lo stesso", () => {
    const after = ord([c('c1', 'ricevuto')], { placed_by: { role: 'admin' } })
    expect(decideNewOrderStaffPush(null, after)?.title).toContain('Nuovo ordine')
  })
  it('ordine inserito dallo staff: notifica sì', () => {
    const after = ord([c('c1', 'ricevuto')], { placed_by: { role: 'staff' } })
    expect(decideNewOrderStaffPush(null, after)?.title).toContain('Nuovo ordine')
  })
})

describe('pagamenti: chiusura con tutte le comande servite', () => {
  it('isServed: tutte ritirate (annullate ignorate) / legacy ritirato', () => {
    expect(isServed(ord([c('c1', 'ritirato'), c('c2', 'annullato')]))).toBe(true)
    expect(isServed(ord([c('c1', 'ritirato'), c('c2', 'pronto')]))).toBe(false)
    expect(isServed({ status: 'ritirato' })).toBe(true)
  })
  it('decidePaymentPatch chiude solo se tutto servito', () => {
    const now = 't'
    const servito = ord([c('c1', 'ritirato')])
    const inCorso = ord([c('c1', 'pronto')])
    expect(decidePaymentPatch(servito, { status: 'pagato', now }).status).toBe('pagato')
    expect(decidePaymentPatch(inCorso, { status: 'pagato', now }).status).toBeUndefined()
  })
  it('decideAutoAdvance scatta quando ultimo servizio + pagato', () => {
    const before = ord([c('c1', 'pronto')], { payment_status: 'pagato' })
    const after = ord([c('c1', 'ritirato')], { payment_status: 'pagato' })
    expect(decideAutoAdvance(before, after)).toBe('pagato')
    expect(decideAutoAdvance(after, after)).toBeNull()
  })
})
