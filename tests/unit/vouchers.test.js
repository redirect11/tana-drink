'use strict'

// Unit test dei buoni VIP (credito ricaricabile) — src/lib/vouchers.js

import { describe, it, expect } from 'vitest'
import {
  redeemable,
  balanceAfterRedeem,
  activeVouchers,
  totalOutstanding,
  voucherExpiresAt,
  isVoucherExpired,
} from '../../src/lib/vouchers.js'

describe('redeemable / balanceAfterRedeem', () => {
  it('scala al massimo il saldo, mai negativo', () => {
    expect(redeemable(50, 20)).toBe(20)
    expect(redeemable(15, 20)).toBe(15) // saldo insufficiente: solo 15
    expect(redeemable(0, 20)).toBe(0)
    expect(redeemable(50, -5)).toBe(0)
  })
  it('saldo dopo l\'uso non va sotto zero', () => {
    expect(balanceAfterRedeem(50, 20)).toBe(30)
    expect(balanceAfterRedeem(15, 20)).toBe(0)
  })
})

describe('activeVouchers / totalOutstanding', () => {
  const vouchers = [
    { id: 'a', holder_name: 'Sara', balance: 0 },
    { id: 'b', holder_name: 'Marco', balance: 30 },
    { id: 'c', holder_name: 'Anna', balance: 12.5 },
  ]
  it('solo saldo > 0, ordinati per nome', () => {
    expect(activeVouchers(vouchers).map((v) => v.holder_name)).toEqual(['Anna', 'Marco'])
  })
  it('totale credito in circolazione', () => {
    expect(totalOutstanding(vouchers)).toBe(42.5)
  })
})

describe('scadenza buoni', () => {
  const now = new Date('2026-07-15T12:00:00')

  it('nessuna scadenza → mai scaduto', () => {
    expect(voucherExpiresAt({ expiry_type: 'none' }, now)).toBeNull()
    expect(isVoucherExpired({ expiry_type: 'none' }, now)).toBe(false)
  })

  it('data libera: scade dopo la data', () => {
    const v = { expiry_type: 'date', expires_at: '2026-07-10T23:59:59' }
    expect(isVoucherExpired(v, now)).toBe(true)
    expect(isVoucherExpired({ ...v, expires_at: '2026-07-20T23:59:59' }, now)).toBe(false)
  })

  it('giornaliero SENZA rinnovo: scade a fine del giorno di creazione', () => {
    const v = { expiry_type: 'daily', created_at: '2026-07-14T20:00:00', auto_renew: false }
    // creato il 14 → scade fine 14 → il 15 è scaduto
    expect(isVoucherExpired(v, now)).toBe(true)
  })

  it('giornaliero CON rinnovo: sempre valido fino a fine giornata corrente', () => {
    const v = { expiry_type: 'daily', created_at: '2026-01-01T20:00:00', auto_renew: true }
    expect(isVoucherExpired(v, now)).toBe(false)
    const exp = voucherExpiresAt(v, now)
    expect(exp.getFullYear()).toBe(2026)
    expect(exp.getMonth()).toBe(6) // luglio
    expect(exp.getDate()).toBe(15)
  })

  it('mensile senza rinnovo: scade a fine mese di creazione', () => {
    const v = { expiry_type: 'monthly', created_at: '2026-06-20T10:00:00', auto_renew: false }
    expect(isVoucherExpired(v, now)).toBe(true) // giugno < luglio
    const v2 = { expiry_type: 'monthly', created_at: '2026-07-01T10:00:00', auto_renew: false }
    expect(isVoucherExpired(v2, now)).toBe(false)
  })

  it('activeVouchers esclude i scaduti', () => {
    const list = [
      { id: 'a', holder_name: 'A', balance: 10, expiry_type: 'none' },
      { id: 'b', holder_name: 'B', balance: 10, expiry_type: 'date', expires_at: '2026-07-01T00:00:00' },
    ]
    expect(activeVouchers(list, now).map((v) => v.id)).toEqual(['a'])
  })
})
