// @vitest-environment happy-dom
'use strict'

// Unit test della bozza persistente del POS (src/lib/useDraft.js): non si
// perde uscendo dalla schermata, si riprende per chiave (creazione vs
// singolo ordine), e si può svuotare.

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDraft, loadDraft, saveDraft, loadLayout, saveLayout } from '../../src/lib/useDraft.js'

beforeEach(() => localStorage.clear())

describe('loadDraft / saveDraft', () => {
  it('salva e rilegge un array; vuoto rimuove la chiave', () => {
    saveDraft('new', [{ line_id: 'a', qty: 1 }])
    expect(loadDraft('new')).toEqual([{ line_id: 'a', qty: 1 }])
    saveDraft('new', [])
    expect(localStorage.getItem('tana:draft:new')).toBeNull()
    expect(loadDraft('new')).toEqual([])
  })

  it('dati corrotti → bozza vuota (nessun crash)', () => {
    localStorage.setItem('tana:draft:x', '{non-json')
    expect(loadDraft('x')).toEqual([])
  })
})

describe('loadLayout / saveLayout (ordine visivo di TUTTI gli item)', () => {
  it('salva e rilegge l’ordine delle chiavi; vuoto rimuove la chiave', () => {
    saveLayout('ord-1', ['c:c1:1', 'c:c1:0', 'd:xyz'])
    expect(loadLayout('ord-1')).toEqual(['c:c1:1', 'c:c1:0', 'd:xyz'])
    saveLayout('ord-1', [])
    expect(localStorage.getItem('tana:layout:ord-1')).toBeNull()
  })
  it('è indipendente dalla bozza (chiavi separate)', () => {
    saveDraft('ord-1', [{ line_id: 'a', qty: 1 }])
    saveLayout('ord-1', ['c:c1:0', 'd:a'])
    expect(loadDraft('ord-1')).toEqual([{ line_id: 'a', qty: 1 }])
    expect(loadLayout('ord-1')).toEqual(['c:c1:0', 'd:a'])
  })
})

describe('useDraft', () => {
  it('persiste tra i mount: rientrando la bozza è ancora lì', () => {
    const first = renderHook(() => useDraft('new'))
    act(() => first.result.current[1]([{ line_id: 'a', qty: 2 }]))
    first.unmount()
    // Nuovo mount (come tornare sulla schermata): ricarica da localStorage.
    const second = renderHook(() => useDraft('new'))
    expect(second.result.current[0]).toEqual([{ line_id: 'a', qty: 2 }])
  })

  it('chiavi diverse = bozze indipendenti (creazione vs ordine)', () => {
    const a = renderHook(() => useDraft('new'))
    act(() => a.result.current[1]([{ line_id: 'n', qty: 1 }]))
    const b = renderHook(() => useDraft('ord-1'))
    act(() => b.result.current[1]([{ line_id: 'o', qty: 3 }]))
    expect(loadDraft('new')).toEqual([{ line_id: 'n', qty: 1 }])
    expect(loadDraft('ord-1')).toEqual([{ line_id: 'o', qty: 3 }])
  })

  it('clearDraft svuota e rimuove dalla persistenza', () => {
    const { result } = renderHook(() => useDraft('new'))
    act(() => result.current[1]([{ line_id: 'a', qty: 1 }]))
    act(() => result.current[2]()) // clearDraft
    expect(result.current[0]).toEqual([])
    expect(localStorage.getItem('tana:draft:new')).toBeNull()
  })

  it('cambiando key ricarica la bozza di quella chiave', () => {
    saveDraft('ord-9', [{ line_id: 'z', qty: 1 }])
    const { result, rerender } = renderHook(({ k }) => useDraft(k), {
      initialProps: { k: 'new' },
    })
    expect(result.current[0]).toEqual([])
    rerender({ k: 'ord-9' })
    expect(result.current[0]).toEqual([{ line_id: 'z', qty: 1 }])
  })
})
