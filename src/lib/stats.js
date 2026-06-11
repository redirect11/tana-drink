// Statistiche del locale calcolate dagli ordini delle serate chiuse.
// Logica pura senza dipendenze Firestore: testabile in isolamento.
// Riusa aggregateProducts/serataFinance da eta.js.
import { ORDER_STATUSES } from './orderStatus.js'
import { aggregateProducts, serataFinance } from './eta.js'

const isCancelled = (o) => o.status === ORDER_STATUSES.ANNULLATO
const valid = (orders) => orders.filter((o) => !isCancelled(o))

const ms = (v) => {
  const t = Date.parse(v || '')
  return Number.isFinite(t) ? t : null
}

// ── KPI principali ────────────────────────────────────────────────────
export function kpiSummary(orders, serate) {
  const ok = valid(orders)
  const finance = serataFinance(orders)
  const drinksSold = ok.reduce(
    (s, o) => s + (o.order_items || []).reduce((q, i) => q + (Number(i.qty) || 0), 0),
    0
  )
  const annullati = orders.filter(
    (o) => isCancelled(o) && o.cancel_kind !== 'non_ritirato'
  ).length
  const nonRitirati = orders.filter((o) => o.cancel_kind === 'non_ritirato').length
  return {
    incasso: finance.incasso,
    ordini: ok.length,
    serate: serate.length,
    scontrinoMedio: ok.length ? finance.incasso / ok.length : 0,
    drinkVenduti: drinksSold,
    drinkPerOrdine: ok.length ? drinksSold / ok.length : 0,
    incassoPerSerata: serate.length ? finance.incasso / serate.length : 0,
    pctAnnullati: orders.length ? (annullati / orders.length) * 100 : 0,
    pctNonRitirati: orders.length ? (nonRitirati / orders.length) * 100 : 0,
  }
}

// ── Incasso e ordini per fascia oraria ────────────────────────────────
// Le ore sono riordinate dalla apertura tipica (17) fino a notte fonda,
// così il grafico segue l'andamento della serata.
const HOUR_ORDER = [17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3]

export function revenueByHour(orders) {
  const buckets = new Map()
  for (const o of valid(orders)) {
    const t = ms(o.created_at)
    if (t == null) continue
    const h = new Date(t).getHours()
    const b = buckets.get(h) || { hour: h, incasso: 0, ordini: 0 }
    b.incasso += Number(o.total) || 0
    b.ordini += 1
    buckets.set(h, b)
  }
  const known = HOUR_ORDER.filter((h) => buckets.has(h)).map((h) => buckets.get(h))
  const rest = [...buckets.values()]
    .filter((b) => !HOUR_ORDER.includes(b.hour))
    .sort((a, b) => a.hour - b.hour)
  const out = [...known, ...rest]
  const peak = out.reduce((best, b) => (!best || b.ordini > best.ordini ? b : best), null)
  return { buckets: out, peakHour: peak?.hour ?? null }
}

// ── Trend per serata ──────────────────────────────────────────────────
export function revenueBySerata(orders, serate) {
  const byId = new Map()
  for (const o of valid(orders)) {
    const cur = byId.get(o.serata_id) || { incasso: 0, ordini: 0 }
    cur.incasso += Number(o.total) || 0
    cur.ordini += 1
    byId.set(o.serata_id, cur)
  }
  return [...serate]
    .sort((a, b) => String(a.opened_at || '').localeCompare(String(b.opened_at || '')))
    .map((s) => {
      const agg = byId.get(s.id) || { incasso: 0, ordini: 0 }
      const d = ms(s.opened_at)
      return {
        id: s.id,
        label: d
          ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
          : '—',
        weekday: d ? new Date(d).toLocaleDateString('it-IT', { weekday: 'short' }) : '',
        incasso: agg.incasso,
        ordini: agg.ordini,
      }
    })
}

// ── Top prodotti (per incasso e per quantità) ─────────────────────────
export function topProducts(orders, limit = 10) {
  const all = aggregateProducts(orders)
  return {
    byRevenue: [...all].sort((a, b) => b.revenue - a.revenue).slice(0, limit),
    byQty: all.slice(0, limit), // aggregateProducts ordina già per qty
  }
}

// ── Incasso per categoria menu ────────────────────────────────────────
export function revenueByCategory(orders, drinksById) {
  const byCat = new Map()
  for (const o of valid(orders)) {
    for (const i of o.order_items || []) {
      const cat = drinksById?.[i.drink_id]?.category || 'Altro'
      const cur = byCat.get(cat) || { name: cat, revenue: 0, qty: 0 }
      cur.revenue += (Number(i.qty) || 0) * (Number(i.unit_price) || 0)
      cur.qty += Number(i.qty) || 0
      byCat.set(cat, cur)
    }
  }
  return [...byCat.values()].sort((a, b) => b.revenue - a.revenue)
}

// ── Consumo ingredienti (qty venduta × ricetta) ───────────────────────
export function ingredientUsage(orders, drinksById, limit = 10) {
  const byName = new Map()
  for (const o of valid(orders)) {
    for (const i of o.order_items || []) {
      const recipe = drinksById?.[i.drink_id]?.recipe_items || []
      for (const r of recipe) {
        const cur = byName.get(r.name) || { name: r.name, qty: 0, unit: r.unit || 'ml' }
        cur.qty += (Number(r.qty) || 0) * (Number(i.qty) || 0)
        byName.set(r.name, cur)
      }
    }
  }
  // Ordina per "porzioni" così ml e pz sono confrontabili (40ml ≈ 1 porzione).
  const portions = (x) => (x.unit === 'pz' ? x.qty : x.qty / 40)
  return [...byName.values()].sort((a, b) => portions(b) - portions(a)).slice(0, limit)
}

// ── Tempi (attesa e preparazione) ─────────────────────────────────────
export function prepTimeStats(orders) {
  const attese = []
  const preps = []
  let slowest = null
  for (const o of orders) {
    const t0 = ms(o.created_at)
    const t1 = ms(o.status_times?.[ORDER_STATUSES.IN_PREPARAZIONE])
    const t2 = ms(o.status_times?.[ORDER_STATUSES.PRONTO])
    if (t0 != null && t1 != null && t1 >= t0) attese.push((t1 - t0) / 60000)
    if (t1 != null && t2 != null && t2 >= t1) {
      const m = (t2 - t1) / 60000
      preps.push(m)
      if (!slowest || m > slowest.minutes) slowest = { daily_number: o.daily_number, minutes: m }
    }
  }
  const avg = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null)
  return {
    attesaMedia: avg(attese),
    prepMedia: avg(preps),
    prepMax: slowest,
    campioni: preps.length,
  }
}

// ── Tavolo vs banco ───────────────────────────────────────────────────
export function serviceModeSplit(orders) {
  const out = {
    tavolo: { ordini: 0, incasso: 0 },
    banco: { ordini: 0, incasso: 0 },
  }
  for (const o of valid(orders)) {
    const k = o.service_mode === 'banco' ? 'banco' : 'tavolo'
    out[k].ordini += 1
    out[k].incasso += Number(o.total) || 0
  }
  return out
}

// ── Ripartizione incassi ──────────────────────────────────────────────
export function extrasBreakdown(orders) {
  return serataFinance(orders)
}
