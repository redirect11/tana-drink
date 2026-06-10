// =====================================================================
//  Generatore di ordini mock condiviso: usato da scripts/mock-orders.js
//  (Node, Admin SDK) e dal pannello sviluppatore in-app.
//  Genera oggetti puri: created_at è un Date, i timestamp di stato ISO.
// =====================================================================

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

// Genera ordini mock per una serata. `drinks` = [{id, name, price}],
// `startNumber` = ultimo numero progressivo già usato.
// Restituisce { orders, prepStats, etaStats, lastNumber }.
export function generateMockOrders(drinks, serataId, startNumber = 0) {
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
      serata_id: serataId,
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
