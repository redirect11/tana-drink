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

// MENTRE SI TRASCINA NON SI RIDISEGNA LA SCHERMATA (BUG-118). L'utente,
// 24/10/2026: «le maniglie nella schermata dell'ordine sono scattose» e sul
// telefono «la maniglia del riepilogo dell'ordine blocca tutto». Ogni pixel
// ridisegnava l'intero conto: ora la misura va dritta nella variabile CSS,
// una volta per fotogramma, e lo stato si aggiorna quando si lascia.
describe('trascinando dal vivo', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb) => setTimeout(cb, 16))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('i movimenti vanno nella variabile, uno per fotogramma, e lo stato resta fermo', () => {
    const dalVivo = vi.fn()
    const { result } = monta({ dalVivo })
    act(() => result.current.handleProps.onPointerDown(evento('mouse', 100)))
    act(() => result.current.handleProps.onPointerMove(evento('mouse', 120)))
    act(() => result.current.handleProps.onPointerMove(evento('mouse', 140)))
    act(() => result.current.handleProps.onPointerMove(evento('mouse', 150)))
    // Nessun ridisegno mentre si tira.
    expect(result.current.width).toBe(200)
    expect(dalVivo).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(16))
    // Tre movimenti nello stesso fotogramma: si applica l'ultimo, una volta.
    expect(dalVivo).toHaveBeenCalledTimes(1)
    expect(dalVivo).toHaveBeenLastCalledWith(250)
    expect(localStorage.getItem('drink:w:prova')).toBe('200')
  })

  it('lasciando, la misura diventa stato e si ricorda', () => {
    const dalVivo = vi.fn()
    const { result } = monta({ dalVivo })
    act(() => result.current.handleProps.onPointerDown(evento('mouse', 100)))
    act(() => result.current.handleProps.onPointerMove(evento('mouse', 180)))
    act(() => result.current.handleProps.onPointerUp())
    expect(result.current.width).toBe(280)
    expect(dalVivo).toHaveBeenLastCalledWith(280)
    expect(localStorage.getItem('drink:w:prova')).toBe('280')
    // Il fotogramma che arriva dopo la fine non rimette niente.
    dalVivo.mockClear()
    act(() => vi.advanceTimersByTime(16))
    expect(dalVivo).not.toHaveBeenCalled()
  })

  it('un tocco senza trascinare non cambia niente', () => {
    const dalVivo = vi.fn()
    const { result } = monta({ dalVivo })
    act(() => result.current.handleProps.onPointerDown(evento('mouse', 100)))
    act(() => result.current.handleProps.onPointerUp())
    expect(dalVivo).not.toHaveBeenCalled()
    expect(result.current.width).toBe(200)
  })
})

describe('la presa col dito su Android', () => {
  it('la pressione lunga non apre il menu del browser', () => {
    const { result } = monta()
    const e = { preventDefault: vi.fn() }
    result.current.handleProps.onContextMenu(e)
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('se il browser si riprende il dito, la maniglia si spegne', () => {
    const { result } = monta()
    act(() => result.current.handleProps.onPointerDown(evento('touch', 100)))
    act(() => vi.advanceTimersByTime(400))
    expect(result.current.attivo).toBe(true)
    act(() => result.current.handleProps.onLostPointerCapture())
    expect(result.current.attivo).toBe(false)
  })
})
