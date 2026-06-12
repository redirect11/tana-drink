'use strict'

// Unit test del flusso di stato ordine (src/lib/orderStatus.js).

import { describe, it, expect } from 'vitest'
import {
  ORDER_STATUSES,
  STATUS_FLOW,
  STATUS_LABELS,
  STATUS_EMOJI,
  nextStatus,
} from '../../src/lib/orderStatus.js'

describe('flusso stati con «pagato»', () => {
  it('pagato è lo stato terminale dopo ritirato', () => {
    expect(STATUS_FLOW.at(-1)).toBe(ORDER_STATUSES.PAGATO)
    expect(STATUS_FLOW.at(-2)).toBe(ORDER_STATUSES.RITIRATO)
  })

  it('nextStatus: ritirato → pagato → null', () => {
    expect(nextStatus(ORDER_STATUSES.RITIRATO)).toBe(ORDER_STATUSES.PAGATO)
    expect(nextStatus(ORDER_STATUSES.PAGATO)).toBeNull()
  })

  it('annullato resta fuori dal flow', () => {
    expect(STATUS_FLOW).not.toContain(ORDER_STATUSES.ANNULLATO)
    expect(nextStatus(ORDER_STATUSES.ANNULLATO)).toBeNull()
  })

  it('pagato ha label ed emoji', () => {
    expect(STATUS_LABELS[ORDER_STATUSES.PAGATO]).toBe('Pagato')
    expect(STATUS_EMOJI[ORDER_STATUSES.PAGATO]).toBeTruthy()
  })
})
