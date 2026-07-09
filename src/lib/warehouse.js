// Logica pura del gestionale magazzino (niente Firebase): conta periodica,
// ordini fornitore e scadenzario. Replica i calcoli dei fogli Excel storici
// della Tana (INV / GENERATORE ORDINI / FORNITORI REC).

import { costWithVat } from './inventory.js'

// ── Conta periodica (INV: DEP → ACQ → RIM → CONS) ─────────────────────

// Consumo di una riga di conta: giacenza iniziale + acquisti − rimanenza.
// Valori in unità base (ml/g/pz); rim mancante ⇒ consumo non calcolabile (null).
export function countLineCons(line) {
  if (line?.rim == null || line.rim === '') return null
  const dep = Number(line.dep) || 0
  const acq = Number(line.acq) || 0
  const rim = Number(line.rim) || 0
  return dep + acq - rim
}

// Valore in € di una quantità in unità base di un item (con IVA di default).
export function qtyValue(qty, item, { gross = true } = {}) {
  const n = Number(qty) || 0
  if (n <= 0) return 0
  const unitCost = gross ? costWithVat(item?.cost, item?.vat) : (Number(item?.cost) || 0)
  if (item?.unit === 'pz') return n * unitCost
  const size = Number(item?.package_size) || 0
  return size > 0 ? (n / size) * unitCost : 0
}

// Completa le righe della conta con consumo e valori e calcola i totali.
//   lines: [{ item_id, name, unit, dep, acq, rim, cost, vat, package_size }]
// Ritorna { lines: [...con cons, rim_value, cons_value], totals }.
export function stockCountCompute(lines) {
  const out = (lines || []).map((l) => {
    const cons = countLineCons(l)
    return {
      ...l,
      cons,
      rim_value: qtyValue(l.rim, l),
      cons_value: cons != null ? qtyValue(cons, l) : 0,
    }
  })
  const totals = out.reduce(
    (t, l) => ({
      rim_value: t.rim_value + (l.rim_value || 0),
      cons_value: t.cons_value + (l.cons_value || 0),
      counted: t.counted + (l.cons != null ? 1 : 0),
    }),
    { rim_value: 0, cons_value: 0, counted: 0 }
  )
  return { lines: out, totals }
}

// ── Ordini fornitore (GENERATORE ORDINI) ──────────────────────────────

// Totali di un ordine: righe { qty_packages, unit_cost, vat }.
export function purchaseOrderTotals(lines) {
  return (lines || []).reduce(
    (t, l) => {
      const qty = Number(l.qty_packages) || 0
      const net = qty * (Number(l.unit_cost) || 0)
      return {
        net: t.net + net,
        gross: t.gross + qty * costWithVat(l.unit_cost, l.vat),
        pieces: t.pieces + qty,
      }
    },
    { net: 0, gross: 0, pieces: 0 }
  )
}

// ── Scadenzario fornitori (FORNITORI REC) ─────────────────────────────

// Totali documenti: da pagare complessivo e per fornitore.
export function invoiceTotals(invoices) {
  const bySupplier = new Map()
  let unpaid = 0
  let paid = 0
  for (const inv of invoices || []) {
    const amount = Number(inv.amount) || 0
    if (inv.paid) {
      paid += amount
    } else {
      unpaid += amount
      const key = inv.supplier_id || 'sconosciuto'
      const cur = bySupplier.get(key) || { supplier_id: key, supplier_name: inv.supplier_name || '', unpaid: 0, count: 0 }
      cur.unpaid += amount
      cur.count += 1
      bySupplier.set(key, cur)
    }
  }
  return { unpaid, paid, bySupplier: [...bySupplier.values()].sort((a, b) => b.unpaid - a.unpaid) }
}
