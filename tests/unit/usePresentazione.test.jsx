// @vitest-environment happy-dom
'use strict'

// ── QUANDO L'APP SI PRESENTA: ANCHE TORNANDO IN PRIMO PIANO (REQ-FLOTTA-031) ──
//
// Il tablet del banco resta aperto per giorni senza essere ricaricato. Con
// la sola apertura non si ripresentava, e la regia, che dimentica chi non
// si presenta da 30 giorni, l'avrebbe perso mentre chiamava ancora le
// interfacce vecchie. Quindi si riprova anche quando l'app torna visibile;
// il limite di una volta al giorno lo tiene presentaSeServe.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePresentazione } from '../../src/lib/usePresentazione.js'

const opzioni = (chiama) => ({ versione: '1.10.51-beta', collegato: true, licenzaMancante: false, chiama, progetto: 'drink-regia' })
const visibile = (stato) => {
  Object.defineProperty(document, 'visibilityState', { value: stato, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}
const unGiro = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  localStorage.clear()
})

describe('usePresentazione', () => {
  it('si presenta all\'apertura, e tornando visibile solo se sono passate 24 ore', async () => {
    const chiama = vi.fn(() => Promise.resolve({ ok: true }))
    renderHook(() => usePresentazione(opzioni(chiama)))
    await unGiro()
    expect(chiama).toHaveBeenCalledTimes(1)

    // Torna visibile subito dopo: già presentata oggi, nessuna chiamata.
    visibile('visible')
    await unGiro()
    expect(chiama).toHaveBeenCalledTimes(1)

    // Il giorno dopo, senza ricaricare: tornando visibile si ripresenta.
    localStorage.setItem('drink:presentata_il', String(Date.now() - 25 * 60 * 60 * 1000))
    visibile('hidden')
    await unGiro()
    expect(chiama).toHaveBeenCalledTimes(1)
    visibile('visible')
    await unGiro()
    expect(chiama).toHaveBeenCalledTimes(2)
  })

  it('senza accesso non parte, e smontata non ascolta più', async () => {
    const chiama = vi.fn(() => Promise.resolve({ ok: true }))
    const { unmount } = renderHook(() => usePresentazione({ ...opzioni(chiama), collegato: false }))
    visibile('visible')
    await unGiro()
    expect(chiama).not.toHaveBeenCalled()

    const altra = vi.fn(() => Promise.resolve({ ok: true }))
    const seconda = renderHook(() => usePresentazione(opzioni(altra)))
    await unGiro()
    seconda.unmount()
    unmount()
    localStorage.clear()
    visibile('visible')
    await unGiro()
    expect(altra).toHaveBeenCalledTimes(1)
  })
})
