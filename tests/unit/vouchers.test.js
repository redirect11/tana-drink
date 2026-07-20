'use strict'

// Unit test dei buoni VIP (credito ricaricabile) — src/lib/vouchers.js

import { describe, it, expect } from 'vitest'
import {
  redeemable,
  balanceAfterRedeem,
  activeVouchers,
  totalOutstanding,
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
