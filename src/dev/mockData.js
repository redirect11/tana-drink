// =====================================================================
//  Generatore di ordini mock condiviso: usato da scripts/mock-orders.js,
//  scripts/mock-history.js (Node, Admin SDK) e dal pannello sviluppatore.
//  Genera oggetti puri: created_at è un Date, i timestamp di stato ISO.
// =====================================================================
import { ordersFinance } from '../lib/eta.js'

const rand = (min, max) => min + Math.random() * (max - min)
const randInt = (min, max) => Math.floor(rand(min, max + 1))
const pick = (arr) => arr[randInt(0, arr.length - 1)]
const MIN = 60000

// Distribuzione degli stati dei 12 ordini mock.
const STATUSES = [
  'ritirato', 'ritirato', 'ritirato', 'ritirato',
  'pronto', 'pronto',
  'in_preparazione', 'in_preparazione',
  'ricevuto', 'ricevuto', 'ricevuto',
  'annullato',
]

// Genera ordini mock per una giornata. `drinks` = [{id, name, price}],
// `startNumber` = ultimo numero progressivo già usato.
// Restituisce { orders, prepStats, etaStats, lastNumber }.
export function generateMockOrders(drinks, startNumber = 0) {
  const prepStats = { count: 0, attesa_ms: 0, prep_ms: 0, total_ms: 0 }
  const etaStats = { count: 0, attesa_ms: 0, prep_ms: 0, ritiro_ms: 0, total_ms: 0 }
  const orders = []

  const now = Date.now()
  let createdAgoMin = 95 // il primo ordine ~95 minuti fa
  let dailyNumber = startNumber

  for (const status of STATUSES) {
    dailyNumber += 1
    createdAgoMin -= rand(4, 9) // ordini via via più recenti

    // 1–3 drink, qty 1–2
    const nItems = randInt(1, 3)
    const chosen = []
    for (let i = 0; i < nItems; i++) {
      const d = pick(drinks)
      if (chosen.find((c) => c.drink_id === d.id)) continue
      chosen.push({
        drink_id: d.id,
        name: d.name,
        unit_price: d.price,
        qty: randInt(1, 2),
        sumup_product_id: null,
      })
    }
    const itemsTotal = chosen.reduce((s, i) => s + i.qty * i.unit_price, 0)

    // Modalità e voci extra.
    const serviceMode = pick(['tavolo', 'tavolo', 'banco'])
    const atTable = serviceMode === 'tavolo'
    const copertoPersons = atTable && Math.random() < 0.5 ? randInt(1, 4) : 0
    const copertoAmount = copertoPersons * 2
    const serviceAmount = atTable && Math.random() < 0.4
      ? Math.round((itemsTotal + copertoAmount) * 10) / 100
      : 0
    const tipAmount = Math.random() < 0.3 ? pick([0.5, 1, 1.5, 2]) : 0
    const total = itemsTotal + copertoAmount + serviceAmount + tipAmount

    // Timestamp coerenti con lo stato raggiunto.
    const createdAt = new Date(now - createdAgoMin * MIN)
    const t0 = createdAt.getTime()
    const attesaMs = rand(1, 4) * MIN
    const prepMs = rand(3, 8) * MIN
    const ritiroMs = rand(1, 5) * MIN
    const statusTimes = {}
    if (['in_preparazione', 'pronto', 'ritirato'].includes(status)) {
      statusTimes.in_preparazione = new Date(t0 + attesaMs).toISOString()
    }
    if (['pronto', 'ritirato'].includes(status)) {
      statusTimes.pronto = new Date(t0 + attesaMs + prepMs).toISOString()
      prepStats.count += 1
      prepStats.attesa_ms += attesaMs
      prepStats.prep_ms += prepMs
      prepStats.total_ms += attesaMs + prepMs
    }
    if (status === 'ritirato') {
      statusTimes.ritirato = new Date(t0 + attesaMs + prepMs + ritiroMs).toISOString()
      if (serviceMode === 'tavolo') {
        etaStats.count += 1
        etaStats.attesa_ms += attesaMs
        etaStats.prep_ms += prepMs
        etaStats.ritiro_ms += ritiroMs
        etaStats.total_ms += attesaMs + prepMs + ritiroMs
      }
    }

    orders.push({
      daily_number: dailyNumber,
      order_date: createdAt.toISOString().slice(0, 10),
      table_label: atTable ? String(randInt(1, 12)) : null,
      note: null,
      status,
      total,
      coperto_persons: copertoPersons,
      coperto_amount: copertoAmount,
      service_charge_amount: serviceAmount,
      tip_amount: tipAmount,
      service_mode: serviceMode,
      status_times: statusTimes,
      created_at: createdAt,
      items: chosen,
      inventory_applied: false,
      inventory_consumption: [],
    })
  }

  return { orders, prepStats, etaStats, lastNumber: dailyNumber }
}

// ── Storico giornate passate (per le statistiche) ─────────────────────
// Genera `nights` giornate passate nelle ultime ~3 settimane, con volumi
// realistici (weekend più piena), orari con picco 22–24, popolarità dei
// drink stabile (pochi best-seller) e tempi coerenti con l'affollamento.

// Mappa ordini (oggetti puri) → ordini "mappati" come mapOrder, per
// riusare ordersFinance/aggregateProducts nel riepilogo.
function asMapped(o) {
  return {
    ...o,
    order_items: o.items.map((i, idx) => ({ id: `${idx}`, ...i })),
    created_at: o.created_at.toISOString(),
  }
}

export function generateMockHistory(drinks, { nights = 12 } = {}) {
  // Popolarità stabile: peso esponenziale assegnato una volta per drink.
  const weighted = drinks.map((d) => ({ d, w: Math.pow(rand(0, 1), 3) + 0.02 }))
  const totalW = weighted.reduce((s, x) => s + x.w, 0)
  const pickDrink = () => {
    let r = rand(0, totalW)
    for (const x of weighted) {
      r -= x.w
      if (r <= 0) return x.d
    }
    return weighted[0].d
  }

  const out = []
  const day = 86400000
  let cursor = Date.now() - day // ieri, andando indietro

  for (let n = 0; n < nights; n++) {
    cursor -= randInt(1, 2) * day // salta 1-2 giorni tra una giornata e l'altra
    const date = new Date(cursor)
    const weekday = date.getDay() // 0 dom … 6 sab
    const isWeekend = weekday === 5 || weekday === 6
    const nOrders = isWeekend ? randInt(40, 70) : randInt(15, 30)

    const opened = new Date(date)
    opened.setHours(19, randInt(0, 30), 0, 0)

    const prepStats = { count: 0, attesa_ms: 0, prep_ms: 0, total_ms: 0 }
    const etaStats = { count: 0, attesa_ms: 0, prep_ms: 0, ritiro_ms: 0, total_ms: 0 }
    const orders = []

    for (let i = 0; i < nOrders; i++) {
      // Orario: picco tra le 22 e le 24 (gauss approssimata con media di 3 uniformi).
      const peak = (rand(0, 1) + rand(0, 1) + rand(0, 1)) / 3 // 0..1 centrato
      const minutesFromOpen = 30 + peak * 300 // 19:30 → ~00:30
      const createdAt = new Date(opened.getTime() + minutesFromOpen * MIN)
      const hour = createdAt.getHours()
      const busy = hour >= 22 || hour <= 0 // ore di punta

      const nItems = randInt(1, 4)
      const chosen = []
      for (let k = 0; k < nItems; k++) {
        const d = pickDrink()
        if (chosen.find((c) => c.drink_id === d.id)) continue
        chosen.push({
          drink_id: d.id,
          name: d.name,
          unit_price: d.price,
          qty: randInt(1, 2),
          sumup_product_id: d.sumup_product_id ?? null,
        })
      }
      const itemsTotal = chosen.reduce((s, x) => s + x.qty * x.unit_price, 0)

      const serviceMode = pick(['tavolo', 'tavolo', 'banco'])
      const atTable = serviceMode === 'tavolo'
      const copertoPersons = atTable && Math.random() < 0.4 ? randInt(1, 4) : 0
      const copertoAmount = copertoPersons * 2
      const serviceAmount = atTable && Math.random() < 0.3
        ? Math.round((itemsTotal + copertoAmount) * 10) / 100
        : 0
      const tipAmount = Math.random() < 0.25 ? pick([0.5, 1, 1.5, 2]) : 0
      const total = itemsTotal + copertoAmount + serviceAmount + tipAmount

      // Esiti: ~92% ritirato, ~5% annullato, ~3% non ritirato.
      const roll = Math.random()
      const outcome = roll < 0.92 ? 'ritirato' : roll < 0.97 ? 'annullato' : 'non_ritirato'

      const t0 = createdAt.getTime()
      const attesaMs = rand(1, busy ? 6 : 3) * MIN
      const prepMs = rand(2, 8) * MIN
      const ritiroMs = rand(1, 6) * MIN
      const statusTimes = {}

      const base = {
        daily_number: i + 1,
        order_date: createdAt.toISOString().slice(0, 10),
        table_label: atTable ? String(randInt(1, 12)) : null,
        note: null,
        total,
        coperto_persons: copertoPersons,
        coperto_amount: copertoAmount,
        service_charge_amount: serviceAmount,
        tip_amount: tipAmount,
        service_mode: serviceMode,
        created_at: createdAt,
        items: chosen,
        inventory_applied: false,
        inventory_consumption: [],
      }

      if (outcome === 'annullato') {
        const byBartender = Math.random() < 0.5
        statusTimes.annullato = new Date(t0 + rand(1, 5) * MIN).toISOString()
        orders.push({
          ...base,
          status: 'annullato',
          status_times: statusTimes,
          cancelled_by: byBartender ? 'bartender' : 'cliente',
          cancel_kind: byBartender ? 'ordine' : null,
          cancel_phrase: byBartender ? 'bancone' : null,
          cancel_message: null,
          cancel_notify: false,
        })
        continue
      }

      statusTimes.in_preparazione = new Date(t0 + attesaMs).toISOString()
      statusTimes.pronto = new Date(t0 + attesaMs + prepMs).toISOString()
      prepStats.count += 1
      prepStats.attesa_ms += attesaMs
      prepStats.prep_ms += prepMs
      prepStats.total_ms += attesaMs + prepMs

      if (outcome === 'non_ritirato') {
        statusTimes.annullato = new Date(t0 + attesaMs + prepMs + 15 * MIN).toISOString()
        orders.push({
          ...base,
          status: 'annullato',
          status_times: statusTimes,
          cancelled_by: 'bartender',
          cancel_kind: 'non_ritirato',
          cancel_phrase: 'bancone',
          cancel_message: null,
          cancel_notify: false,
        })
        continue
      }

      statusTimes.ritirato = new Date(t0 + attesaMs + prepMs + ritiroMs).toISOString()
      if (serviceMode === 'tavolo') {
        etaStats.count += 1
        etaStats.attesa_ms += attesaMs
        etaStats.prep_ms += prepMs
        etaStats.ritiro_ms += ritiroMs
        etaStats.total_ms += attesaMs + prepMs + ritiroMs
      }
      orders.push({ ...base, status: 'ritirato', status_times: statusTimes })
    }

    // Chiusura: 30-60 min dopo l'ultimo ordine.
    const mapped = orders.map(asMapped)
    const finance = ordersFinance(mapped)

    out.push({
      day: opened.toISOString().slice(0, 10),
      incasso: finance.incasso,
      prepStats,
      etaStats,
      orders,
      lastNumber: orders.length,
    })
  }
  return out
}
