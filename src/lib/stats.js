// Statistiche del locale calcolate dagli ordini, per giornata commerciale.
// Logica pura senza dipendenze Firestore: testabile in isolamento.
// Riusa aggregateProducts/ordersFinance da eta.js.
import { ORDER_STATUSES } from './orderStatus.js'
import { aggregateProducts, ordersFinance, discountFactor, orderNet } from './eta.js'
import { scontoTotale } from './pagamento.js'
import { businessDayKey, DEFAULT_CUTOFF_HOUR } from './businessDay.js'

const isCancelled = (o) => o.status === ORDER_STATUSES.ANNULLATO
const valid = (orders) => orders.filter((o) => !isCancelled(o))

const ms = (v) => {
  const t = Date.parse(v || '')
  return Number.isFinite(t) ? t : null
}

// ── KPI principali ────────────────────────────────────────────────────
export function kpiSummary(orders, giorni = []) {
  const ok = valid(orders)
  const finance = ordersFinance(orders)
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
    giorni: giorni.length,
    scontrinoMedio: ok.length ? finance.incasso / ok.length : 0,
    drinkVenduti: drinksSold,
    drinkPerOrdine: ok.length ? drinksSold / ok.length : 0,
    incassoPerGiorno: giorni.length ? finance.incasso / giorni.length : 0,
    pctAnnullati: orders.length ? (annullati / orders.length) * 100 : 0,
    pctNonRitirati: orders.length ? (nonRitirati / orders.length) * 100 : 0,
  }
}

// ── Fasce orarie configurabili ────────────────────────────────────────
// Le fasce sono slot di un'ora allineati all'inizio del range scelto
// ("da" → "a", anche a cavallo della mezzanotte, es. 18:30 → 03:30).
// Le fasce vuote compaiono comunque, a zero.

export const DEFAULT_HOUR_RANGE = { from: '18:30', to: '03:30' }

// "HH:MM" → minuti da mezzanotte.
export function parseHM(s) {
  const m = String(s || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return Math.min(23, Number(m[1])) * 60 + Math.min(59, Number(m[2]))
}

const DAY = 1440
const fmtHM = (min) => {
  const m = ((min % DAY) + DAY) % DAY
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

// Ampiezza del range in minuti, con wrap oltre mezzanotte (0 = giornata intera).
function rangeSpan(fromMin, toMin) {
  const span = (toMin - fromMin + DAY) % DAY
  return span === 0 ? DAY : span
}

// Minuti-da-mezzanotte (ora locale) di un timestamp ordine.
const minuteOfDay = (t) => {
  const d = new Date(t)
  return d.getHours() * 60 + d.getMinutes()
}

// L'orario `m` cade nel range? Restituisce l'offset dal "da", o null.
function offsetInRange(m, fromMin, span) {
  const off = (m - fromMin + DAY) % DAY
  return off < span ? off : null
}

export function revenueByHour(orders, range = DEFAULT_HOUR_RANGE) {
  const fromMin = parseHM(range.from) ?? parseHM(DEFAULT_HOUR_RANGE.from)
  const toMin = parseHM(range.to) ?? parseHM(DEFAULT_HOUR_RANGE.to)
  const span = rangeSpan(fromMin, toMin)
  const nSlots = Math.ceil(span / 60)

  const buckets = Array.from({ length: nSlots }, (_, i) => ({
    label: fmtHM(fromMin + i * 60),
    incasso: 0,
    ordini: 0,
  }))

  for (const o of valid(orders)) {
    const t = ms(o.created_at)
    if (t == null) continue
    const off = offsetInRange(minuteOfDay(t), fromMin, span)
    if (off == null) continue
    const b = buckets[Math.floor(off / 60)]
    b.incasso += orderNet(o)
    b.ordini += 1
  }

  const peak = buckets.reduce(
    (best, b) => (b.ordini > 0 && (!best || b.ordini > best.ordini) ? b : best),
    null
  )
  return { buckets, peakLabel: peak?.label ?? null }
}

// Riepilogo di una SERATA DI CASSA (da apertura a chiusura): totale realmente
// incassato, conti, prodotti venduti e categorie. La finestra è quella della
// sessione, quindi comprende naturalmente le ore dopo la mezzanotte.
export function sessionReport(orders, session, drinksById) {
  if (!session?.opened_at) return null
  const from = session.opened_at
  const to = session.closed_at || null
  const dentro = valid(orders).filter((o) => {
    const t = o.created_at
    return !!t && t >= from && (!to || t <= to)
  })
  const totale = dentro.reduce(
    (s2, o) => s2 + (Number(o.total) || 0) - scontoTotale(o),
    0
  )
  return {
    nOrdini: dentro.length,
    totale: Math.round(totale * 100) / 100,
    prodotti: aggregateProducts(dentro),
    categorie: revenueByCategory(dentro, drinksById),
  }
}

// Ordini che cadono in una FASCIA ORARIA (es. 22:00 → 01:00, anche a cavallo
// della mezzanotte). Serve a rispondere a "cosa ho venduto fra le 22 e l'una":
// da qui si passano gli ordini filtrati a topProducts / revenueByCategory.
export function ordersInHourRange(orders, range = DEFAULT_HOUR_RANGE) {
  const fromMin = parseHM(range?.from) ?? parseHM(DEFAULT_HOUR_RANGE.from)
  const toMin = parseHM(range?.to) ?? parseHM(DEFAULT_HOUR_RANGE.to)
  const span = rangeSpan(fromMin, toMin)
  return valid(orders).filter((o) => {
    const t = ms(o.created_at)
    if (t == null) return false
    return offsetInRange(minuteOfDay(t), fromMin, span) != null
  })
}

// Riepilogo di una fascia oraria: totale incassato (al netto degli sconti),
// numero di conti, TUTTI i prodotti venduti e le categorie.
export function hourRangeReport(orders, range, drinksById) {
  const ord = ordersInHourRange(orders, range)
  const totale = ord.reduce(
    (s, o) => s + (Number(o.total) || 0) - scontoTotale(o),
    0
  )
  return {
    nOrdini: ord.length,
    totale: Math.round(totale * 100) / 100,
    prodotti: aggregateProducts(ord), // già ordinati per quantità
    categorie: revenueByCategory(ord, drinksById),
  }
}

// Incasso per GIORNATA COMMERCIALE considerando SOLO gli ordini in una
// fascia oraria (es. "quanto incassiamo fra le 22 e l'una").
export function revenueByDayInRange(orders, range, cutoffHour = DEFAULT_CUTOFF_HOUR) {
  const fromMin = parseHM(range.from) ?? 0
  const toMin = parseHM(range.to) ?? 0
  const span = rangeSpan(fromMin, toMin)
  const filtered = orders.filter((o) => {
    const t = ms(o.created_at)
    return t != null && offsetInRange(minuteOfDay(t), fromMin, span) != null
  })
  return revenueByDay(filtered, cutoffHour)
}

// ── Trend per giornata commerciale ────────────────────────────────────
// Niente più "serate": si raggruppa per giornata (con ora di taglio, così
// la nottata oltre la mezzanotte resta nella giornata in cui è iniziata).
export function revenueByDay(orders, cutoffHour = DEFAULT_CUTOFF_HOUR) {
  const byDay = new Map()
  for (const o of valid(orders)) {
    const k = businessDayKey(o.created_at, cutoffHour)
    if (!k) continue
    const cur = byDay.get(k) || { incasso: 0, ordini: 0 }
    cur.incasso += orderNet(o)
    cur.ordini += 1
    byDay.set(k, cur)
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, agg]) => {
      const d = new Date(`${k}T12:00:00`)
      return {
        id: k,
        label: d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        weekday: d.toLocaleDateString('it-IT', { weekday: 'short' }),
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
// `revenue` AL NETTO degli sconti, come per i prodotti: vedi discountFactor.
export function revenueByCategory(orders, drinksById) {
  const byCat = new Map()
  for (const o of valid(orders)) {
    const f = discountFactor(o)
    for (const i of o.order_items || []) {
      const cat = drinksById?.[i.drink_id]?.category || 'Altro'
      const cur = byCat.get(cat) || { name: cat, revenue: 0, qty: 0 }
      cur.revenue += (Number(i.qty) || 0) * (Number(i.unit_price) || 0) * f
      cur.qty += Number(i.qty) || 0
      byCat.set(cat, cur)
    }
  }
  return [...byCat.values()]
    .map((x) => ({ ...x, revenue: Math.round(x.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
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
    out[k].incasso += orderNet(o)
  }
  return out
}

// ── Ripartizione incassi ──────────────────────────────────────────────
export function extrasBreakdown(orders) {
  return ordersFinance(orders)
}
