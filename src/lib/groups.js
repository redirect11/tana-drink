// Logica pura dei "gruppi" di ordini (contenitori annidabili, associabili
// ai clienti). Nessuna dipendenza Firebase: interamente testabile.
//
// Un gruppo è:
//  - kind 'customer': legato a un account (id == customer_uid), foglia
//  - kind 'manual': creato dallo staff; può contenere altri gruppi
// Vincolo: un gruppo con sottogruppi (has_child_groups) NON ha ordini diretti.

import { ORDER_STATUSES } from './orderStatus.js'

export const MAX_GROUP_DEPTH = 3

// Costruisce l'albero gruppi+ordini da liste flat (es. dalla coda realtime).
// Ritorna { roots: Node[], byId: Map<id,Node>, ungrouped: Order[] }.
// Node = { group, childGroups: Node[], directOrders: Order[] }.
export function buildGroupTree(groups = [], orders = []) {
  const byId = new Map()
  for (const g of groups) byId.set(g.id, { group: g, childGroups: [], directOrders: [] })

  const ungrouped = []
  for (const o of orders) {
    const node = o.group_id ? byId.get(o.group_id) : null
    if (node) node.directOrders.push(o)
    else ungrouped.push(o) // senza gruppo o gruppo inesistente
  }

  const roots = []
  for (const node of byId.values()) {
    const pid = node.group.parent_group_id
    const parent = pid ? byId.get(pid) : null
    if (parent) parent.childGroups.push(node)
    else roots.push(node)
  }
  return { roots, byId, ungrouped }
}

// Totale ricorsivo di un nodo: ordini diretti + sottogruppi. Esclude annullati.
export function groupTotal(node) {
  let total = 0
  let paid = 0
  let unpaid = 0
  let orderCount = 0
  for (const o of node.directOrders || []) {
    if (o.status === ORDER_STATUSES.ANNULLATO) continue
    const t = Number(o.total) || 0
    total += t
    orderCount += 1
    if (o.payment_status === 'pagato') paid += t
    else unpaid += t
  }
  for (const child of node.childGroups || []) {
    const c = groupTotal(child)
    total += c.total
    paid += c.paid
    unpaid += c.unpaid
    orderCount += c.orderCount
  }
  // arrotondamento ai centesimi per evitare derive float
  const r = (x) => Math.round(x * 100) / 100
  return { total: r(total), paid: r(paid), unpaid: r(unpaid), orderCount }
}

// Stato del conto: chiuso quando ci sono ordini e nessuno è da pagare.
export function groupSettlement(node) {
  const t = groupTotal(node)
  return {
    settled: t.orderCount > 0 && t.unpaid <= 0.0001,
    total: t.total,
    paid: t.paid,
    remaining: t.unpaid,
    orderCount: t.orderCount,
  }
}

export function isGroupSettled(node) {
  return groupSettlement(node).settled
}

// Profondità di un gruppo risalendo i parent. groupsById: Map<id, group>.
export function groupDepth(groupId, groupsById) {
  let depth = 0
  let cur = groupsById.get(groupId)
  const seen = new Set()
  while (cur && cur.parent_group_id && groupsById.has(cur.parent_group_id)) {
    if (seen.has(cur.id)) break // guardia anti-ciclo
    seen.add(cur.id)
    cur = groupsById.get(cur.parent_group_id)
    depth += 1
    if (depth > MAX_GROUP_DEPTH + 2) break
  }
  return depth
}

// Può `child` essere annidato in `parent`? (group objects + Map<id,group>)
export function canNest(child, parent, groupsById) {
  if (!child || !parent) return { ok: false, reason: 'Gruppo mancante.' }
  if (child.id === parent.id) return { ok: false, reason: 'Un gruppo non può contenere sé stesso.' }
  if (parent.kind !== 'manual') {
    return { ok: false, reason: 'Solo i gruppi creati possono contenere altri gruppi.' }
  }
  // Niente cicli: parent non deve essere un discendente di child.
  let cur = parent
  const seen = new Set()
  while (cur) {
    if (cur.id === child.id) return { ok: false, reason: 'Creerebbe un ciclo tra i gruppi.' }
    if (seen.has(cur.id)) break
    seen.add(cur.id)
    cur = cur.parent_group_id ? groupsById.get(cur.parent_group_id) : null
  }
  if (groupDepth(parent.id, groupsById) + 1 >= MAX_GROUP_DEPTH) {
    return { ok: false, reason: 'Troppi livelli di annidamento.' }
  }
  return { ok: true }
}

// Un gruppo può accettare ordini diretti solo se non è un contenitore.
export function canAddDirectOrder(group) {
  return !!group && !group.has_child_groups
}
