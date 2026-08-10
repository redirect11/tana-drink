'use strict'

// Unit test del flusso di stato ordine (src/lib/orderStatus.js).

import { describe, it, expect } from 'vitest'
import { formatPrice,
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

// I NUMERI SI LEGGONO UGUALI SU TUTTI I DISPOSITIVI.
// Il punto delle migliaia dipende da quanto è aggiornata la tabella delle
// lingue: le versioni recenti non raggruppano i numeri di quattro cifre in
// italiano, quelle vecchie sì. Senza forzarlo, la stessa chiusura di cassa
// usciva "2.000,00 €" sul portatile e "2000,00 €" sull'iPad — e sullo
// scontrino stampato non si sa nemmeno quale delle due.
describe('formato dei prezzi', () => {
  it('raggruppa le migliaia, sempre', () => {
    expect(formatPrice(2000)).toContain('2.000')
    expect(formatPrice(1234.5)).toContain('1.234')
  })

  it('sotto il migliaio non cambia niente', () => {
    expect(formatPrice(600.5)).toContain('600,50')
  })
})
