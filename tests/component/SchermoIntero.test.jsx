// @vitest-environment happy-dom
'use strict'

// DA SCHERMO INTERO SI DEVE POTER USCIRE, e dallo stesso tasto con cui si
// è entrati. Al banco il tablet è montato e la tastiera non c'è: se il
// tasto non funziona, "esci con F11" non è una risposta.
//
// Erano due difetti diversi con la stessa faccia:
//   · la voce nei ⋮ (telefono) chiamava sempre e solo requestFullscreen —
//     richiamarla non faceva niente;
//   · il tasto nella barra spariva appena si entrava. Si nasconde quando
//     l'app è installata, e per capirlo guardava `display-mode: fullscreen`
//     — che risponde di sì anche quando a schermo intero ci siamo andati
//     noi con l'API.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSchermoIntero } from '../../src/lib/useSchermoIntero.js'

// I display-mode che in questo test rispondono di sì.
let modi = []

function fingiSchermoIntero(dentro) {
  Object.defineProperty(document, 'fullscreenElement', {
    value: dentro ? document.documentElement : null,
    configurable: true,
  })
  act(() => {
    document.dispatchEvent(new Event('fullscreenchange'))
  })
}

beforeEach(() => {
  modi = []
  document.documentElement.requestFullscreen = vi.fn(() => Promise.resolve())
  document.exitFullscreen = vi.fn(() => Promise.resolve())
  window.matchMedia = (query) => ({
    matches: modi.some((m) => query.includes(m)),
    addEventListener() {},
    removeEventListener() {},
  })
  Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true })
})

describe('schermo intero', () => {
  it('lo stesso comando entra e poi esce', () => {
    const { result } = renderHook(() => useSchermoIntero())
    expect(result.current.attivo).toBe(false)

    act(() => result.current.alterna())
    expect(document.documentElement.requestFullscreen).toHaveBeenCalled()

    fingiSchermoIntero(true)
    expect(result.current.attivo).toBe(true)

    act(() => result.current.alterna())
    expect(document.exitFullscreen).toHaveBeenCalled()
  })

  it('il tasto resta lì mentre si è a schermo intero: è l’unico modo per uscire', () => {
    // Il browser, a schermo intero, dice di sì anche a `display-mode:
    // fullscreen`: prima bastava questo a far sparire il tasto.
    modi = ['fullscreen']
    fingiSchermoIntero(true)
    const { result } = renderHook(() => useSchermoIntero())
    expect(result.current.attivo).toBe(true)
    expect(result.current.disponibile).toBe(true)
  })

  it('con l’app installata il tasto non serve e non c’è', () => {
    modi = ['standalone']
    const { result } = renderHook(() => useSchermoIntero())
    expect(result.current.disponibile).toBe(false)
  })

  it('installata a schermo intero (display_override): niente tasto', () => {
    // Qui il fullscreen non è nostro — non c'è fullscreenElement — ma del
    // modo con cui l'app è partita.
    modi = ['fullscreen']
    const { result } = renderHook(() => useSchermoIntero())
    expect(result.current.attivo).toBe(false)
    expect(result.current.disponibile).toBe(false)
  })

  it('da browser normale il tasto c’è', () => {
    const { result } = renderHook(() => useSchermoIntero())
    expect(result.current.disponibile).toBe(true)
  })
})
