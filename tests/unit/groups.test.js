'use strict'

// Unit test della logica pura dei gruppi (src/lib/groups.js).

import { describe, it, expect } from 'vitest'
import {
  buildGroupTree,
  groupTotal,
  groupSettlement,
  isGroupSettled,
  groupDepth,
  canNest,
  canAddDirectOrder,
  MAX_GROUP_DEPTH,
} from '../../src/lib/groups.js'

// Gruppi: padre manuale "Tavolata" con due figli (un cliente + un manuale).
const groups = [
  { id: 'tavolata', kind: 'manual', parent_group_id: null, has_child_groups: true },
  { id: 'cli1', kind: 'customer', customer_uid: 'cli1', parent_group_id: 'tavolata', has_child_groups: false },
  { id: 'manualeB', kind: 'manual', parent_group_id: 'tavolata', has_child_groups: false },
  { id: 'solo', kind: 'manual', parent_group_id: null, has_child_groups: false },
]
const orders = [
  { id: 'o1', group_id: 'cli1', total: 10, status: 'pronto', payment_status: 'non_richiesto' },
  { id: 'o2', group_id: 'cli1', total: 5, status: 'pronto', payment_status: 'pagato' },
  { id: 'o3', group_id: 'manualeB', total: 8, status: 'ritirato', payment_status: 'non_richiesto' },
  { id: 'o4', group_id: 'manualeB', total: 99, status: 'annullato', payment_status: 'non_richiesto' },
  { id: 'o5', group_id: 'solo', total: 7, status: 'pronto', payment_status: 'pagato' },
  { id: 'o6', group_id: null, total: 3, status: 'pronto', payment_status: 'non_richiesto' },
]

describe('buildGroupTree', () => {
  it('annida i sottogruppi e attacca gli ordini diretti', () => {
    const { roots, byId, ungrouped } = buildGroupTree(groups, orders)
    expect(roots.map((n) => n.group.id).sort()).toEqual(['solo', 'tavolata'])
    const tav = byId.get('tavolata')
    expect(tav.childGroups.map((n) => n.group.id).sort()).toEqual(['cli1', 'manualeB'])
    expect(tav.directOrders).toEqual([]) // contenitore senza ordini diretti
    expect(byId.get('cli1').directOrders.map((o) => o.id)).toEqual(['o1', 'o2'])
    expect(ungrouped.map((o) => o.id)).toEqual(['o6']) // senza gruppo
  })
})

describe('groupTotal (ricorsivo, esclude annullati)', () => {
  it('somma ordini diretti', () => {
    const { byId } = buildGroupTree(groups, orders)
    expect(groupTotal(byId.get('cli1'))).toMatchObject({ total: 15, paid: 5, unpaid: 10, orderCount: 2 })
    // manualeB: o3 (8, non pagato) + o4 (annullato escluso)
    expect(groupTotal(byId.get('manualeB'))).toMatchObject({ total: 8, unpaid: 8, orderCount: 1 })
  })
  it('il contenitore somma i sottogruppi', () => {
    const { byId } = buildGroupTree(groups, orders)
    expect(groupTotal(byId.get('tavolata'))).toMatchObject({ total: 23, paid: 5, unpaid: 18, orderCount: 3 })
  })
})

describe('settlement', () => {
  it('chiuso solo se ci sono ordini e nessuno da pagare', () => {
    const { byId } = buildGroupTree(groups, orders)
    expect(isGroupSettled(byId.get('cli1'))).toBe(false) // o1 da pagare
    expect(isGroupSettled(byId.get('solo'))).toBe(true) // o5 pagato
    expect(groupSettlement(byId.get('tavolata')).remaining).toBe(18)
  })
  it('gruppo vuoto non è "chiuso"', () => {
    const { byId } = buildGroupTree(
      [{ id: 'x', kind: 'manual', parent_group_id: null, has_child_groups: false }],
      []
    )
    expect(isGroupSettled(byId.get('x'))).toBe(false)
  })
})

describe('nesting', () => {
  const byId = new Map(groups.map((g) => [g.id, g]))
  it('profondità', () => {
    expect(groupDepth('tavolata', byId)).toBe(0)
    expect(groupDepth('cli1', byId)).toBe(1)
  })
  it('canNest: solo manual come contenitore, niente cicli/sé stesso', () => {
    expect(canNest(byId.get('solo'), byId.get('tavolata'), byId).ok).toBe(true)
    expect(canNest(byId.get('tavolata'), byId.get('tavolata'), byId).ok).toBe(false) // sé stesso
    expect(canNest(byId.get('solo'), byId.get('cli1'), byId).ok).toBe(false) // parent customer
    // ciclo: annidare tavolata dentro un suo discendente
    expect(canNest(byId.get('tavolata'), byId.get('manualeB'), byId).ok).toBe(false)
  })
  it('canNest blocca oltre la profondità massima', () => {
    // catena manual lunga fino al limite
    const chain = []
    for (let i = 0; i < MAX_GROUP_DEPTH + 1; i++) {
      chain.push({ id: `g${i}`, kind: 'manual', parent_group_id: i ? `g${i - 1}` : null, has_child_groups: i < MAX_GROUP_DEPTH })
    }
    const m = new Map(chain.map((g) => [g.id, g]))
    const deepest = chain[chain.length - 1]
    const extra = { id: 'extra', kind: 'manual', parent_group_id: null, has_child_groups: false }
    m.set('extra', extra)
    expect(canNest(extra, deepest, m).ok).toBe(false)
  })
  it('canAddDirectOrder: no se contenitore', () => {
    expect(canAddDirectOrder(byId.get('cli1'))).toBe(true)
    expect(canAddDirectOrder(byId.get('tavolata'))).toBe(false)
  })
})
