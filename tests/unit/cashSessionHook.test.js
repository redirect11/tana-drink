// @vitest-environment happy-dom
'use strict'

// LA FORMA DI useCashSession(). `open` è un BOOLEANO — «c'è una cassa
// aperta?» — mentre la cassa vera, con id e ora di apertura, sta in
// `session`. Leggendo `open.id` viene `undefined` senza che nessuno se ne
// lamenti, e a valle succedono cose senza senso: è così che ogni conto
// chiuso o annullato è sparito dalla coda per un giorno intero, mentre
// tutte le regole, provate a parte, funzionavano.

import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const CASSA = { id: 'cassa-1', status: 'open', opened_at: '2026-08-16T18:00:00.000Z' }
vi.mock('../../src/lib/api.js', () => ({
  subscribeOpenCashSession: (cb) => {
    cb(CASSA)
    return () => {}
  },
}))

const { useCashSession } = await import('../../src/lib/cashSession.js')

describe('useCashSession', () => {
  it('«open» dice SE la cassa è aperta, «session» è la cassa', async () => {
    const { result } = renderHook(() => useCashSession())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.open).toBe(true)
    expect(result.current.session).toMatchObject({ id: 'cassa-1' })
    // La riga che ha fatto il danno: da `open` non si leggono id né orari.
    expect(result.current.open.id).toBeUndefined()
  })
})
