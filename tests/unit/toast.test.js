// @vitest-environment happy-dom
'use strict'

// Unit test delle notifiche in app (src/lib/toast.js).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  showToast,
  toastSync,
  toastSuccess,
  toastError,
  dismissToast,
  subscribeToasts,
} from '../../src/lib/toast.js'

let seen = []
let unsub
beforeEach(() => {
  seen = []
  unsub = subscribeToasts((t) => (seen = t))
  // pulizia: chiude tutto ciò che è rimasto da altri test
  seen.forEach((t) => dismissToast(t.id))
})
afterEach(() => unsub())

describe('toast in app', () => {
  it('showToast aggiunge e dismissToast rimuove', () => {
    const id = showToast('Nuovo ordine #3', { duration: 0 })
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ id, message: 'Nuovo ordine #3', kind: 'info' })
    dismissToast(id)
    expect(seen).toHaveLength(0)
  })

  it('sync → success sullo stesso id (aggiornamento in place)', () => {
    const id = toastSync('Sincronizzo…')
    expect(seen[0].kind).toBe('sync')
    toastSuccess('Fatto', { id })
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ id, kind: 'success', message: 'Fatto' })
    dismissToast(id)
  })

  it('auto-chiusura dopo la durata indicata', () => {
    vi.useFakeTimers()
    try {
      showToast('Volatile', { duration: 1000 })
      expect(seen).toHaveLength(1)
      vi.advanceTimersByTime(1100)
      expect(seen).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('gli errori restano più a lungo e sono marcati error', () => {
    const id = toastError('Sync fallita')
    expect(seen[0].kind).toBe('error')
    dismissToast(id)
  })
})
