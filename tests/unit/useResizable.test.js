// @vitest-environment happy-dom
'use strict'

// MANIGLIE: col mouse si prendono subito, col dito solo tenendo premuto.
// Nasce da un fastidio reale: sul telefono, scorrendo, si sfiorava la
// maniglia e il pannello cambiava misura da solo. E se il dito parte a
// scorrere prima dello scatto, non era una presa — non deve succedere
// niente.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useResizable } from '../../src/lib/useResizable.js'

const evento = (tipo, pos) => ({
  pointerType: tipo,
  clientX: pos,
  clientY: pos,
  pointerId: 1,
  preventDefault: () => {},
  currentTarget: { setPointerCapture: () => {} },
})

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

const monta = (opts) => renderHook(() => useResizable('prova', { def: 200, min: 100, max: 400, ...opts }))

describe('maniglia col mouse', () => {
  it('prende e trascina subito', () => {
    const { result } = monta()
    act(() => result.current.handleProps.onPointerDown(evento('mouse', 100)))
    act(() => result.current.handleProps.onPointerMove(evento('mouse', 150)))
    expect(result.current.width).toBe(250)
  })

  it('non va oltre i limiti', () => {
    const { result } = monta()
    act(() => result.current.handleProps.onPointerDown(evento('mouse', 100)))
    act(() => result.current.handleProps.onPointerMove(evento('mouse', 999)))
    expect(result.current.width).toBe(400)
    act(() => result.current.handleProps.onPointerMove(evento('mouse', -999)))
    expect(result.current.width).toBe(100)
  })
})

describe('maniglia col dito', () => {
  it('un tocco veloce non muove niente', () => {
    const { result } = monta()
    act(() => result.current.handleProps.onPointerDown(evento('touch', 100)))
    act(() => result.current.handleProps.onPointerMove(evento('touch', 160)))
    act(() => result.current.handleProps.onPointerUp())
    expect(result.current.width).toBe(200) // invariata
  })

  it('tenendo premuto (400ms) la maniglia prende, e allora trascina', () => {
    const { result } = monta()
    act(() => result.current.handleProps.onPointerDown(evento('touch', 100)))
    expect(result.current.attivo).toBe(false)
    act(() => vi.advanceTimersByTime(400))
    expect(result.current.attivo).toBe(true)
    act(() => result.current.handleProps.onPointerMove(evento('touch', 140)))
    expect(result.current.width).toBe(240)
  })

  it('se il dito scorre prima dello scatto, non era una presa', () => {
    const { result } = monta()
    act(() => result.current.handleProps.onPointerDown(evento('touch', 100)))
    act(() => result.current.handleProps.onPointerMove(evento('touch', 130))) // scorrimento
    act(() => vi.advanceTimersByTime(600))
    expect(result.current.attivo).toBe(false)
    act(() => result.current.handleProps.onPointerMove(evento('touch', 200)))
    expect(result.current.width).toBe(200) // invariata
  })

  it('lasciando la presa si spegne', () => {
    const { result } = monta()
    act(() => result.current.handleProps.onPointerDown(evento('touch', 100)))
    act(() => vi.advanceTimersByTime(400))
    act(() => result.current.handleProps.onPointerUp())
    expect(result.current.attivo).toBe(false)
    act(() => result.current.handleProps.onPointerMove(evento('touch', 300)))
    expect(result.current.width).toBe(200)
  })
})

describe('verso e memoria', () => {
  it('con side "up" trascinare in su ingrandisce', () => {
    const { result } = monta({ axis: 'y', side: 'up' })
    act(() => result.current.handleProps.onPointerDown(evento('mouse', 300)))
    act(() => result.current.handleProps.onPointerMove(evento('mouse', 250))) // in su
    expect(result.current.width).toBe(250)
  })

  it('la misura si ricorda', () => {
    const { result, unmount } = monta()
    act(() => result.current.setWidth(321))
    unmount()
    const secondo = monta()
    expect(secondo.result.current.width).toBe(321)
  })
})
