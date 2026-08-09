// Stima dei tempi di servizio/ritiro e statistiche di incasso.
// Logica pura, senza dipendenze da Firestore: testabile in isolamento.
//
// Due gruppi di statistiche accumulati sul documento del servizio:
// - prep_stats  → attesa + preparazione (ricevuto→in_preparazione→pronto),
//                 misurate su TUTTI gli ordini al passaggio a "pronto"
// - eta_stats   → ciclo completo fino a ritirato/servito, misurato SOLO
//                 sugli ordini serviti al tavolo (il ritiro al banco dipende
//                 dal cliente e falserebbe la stima)
import { ORDER_STATUSES } from './orderStatus.js'

// Peso del tempo base impostato dal bartender: la stima parte dal base e i
// tempi reali prendono il sopravvento man mano che gli ordini si completano.
export const ETA_PRIOR_WEIGHT = 3

// Quota del tempo base attribuita alle prime due fasi (attesa+preparazione),
// usata come prior per la stima "ritiro al banco" finché mancano dati reali.
export const PREP_BASE_FRACTION = 0.8

function blend(baseMinutes, totalMs, count) {
  const base = Math.max(0, Number(baseMinutes) || 0)
  const n = Number(count) || 0
  if (n <= 0) return base
  const measuredMin = (Number(totalMs) || 0) / 60000
  return (base * ETA_PRIOR_WEIGHT + measuredMin) / (ETA_PRIOR_WEIGHT + n)
}

// Stima del ciclo completo (servizio al tavolo): ordine→servito.
export function etaFullMinutes(etaStats, baseMinutes) {
  return Math.round(blend(baseMinutes, etaStats?.total_ms, etaStats?.count))
}

// Stima fino al "pronto" (ritiro al banco): solo attesa + preparazione.
export function etaPrepMinutes(prepStats, baseMinutes) {
  const base = (Number(baseMinutes) || 0) * PREP_BASE_FRACTION
  return Math.round(blend(base, prepStats?.total_ms, prepStats?.count))
}

// Stima da mostrare per una modalità di consegna.
export function etaForMode(mode, { etaStats, prepStats, baseMinutes }) {
  return mode === 'tavolo'
    ? etaFullMinutes(etaStats, baseMinutes)
    : etaPrepMinutes(prepStats, baseMinutes)
}

// Quota del tempo base attribuita alla sola fase di preparazione (prior per
// il tempo-per-ordine quando mancano dati reali).
export const PREP_PHASE_FRACTION = 0.5

// Tempo medio di preparazione di UN ordine (per il modello di coda).
export function avgPrepPerOrderMinutes(prepStats, baseMinutes) {
  const base = (Number(baseMinutes) || 0) * PREP_PHASE_FRACTION
  return blend(base, prepStats?.prep_ms, prepStats?.count)
}

// Stima personalizzata per un ordine, tenendo conto della coda: gli ordini
// attivi davanti vengono preparati prima del suo (modello sequenziale).
// `position` = numero di ordini attivi (ricevuto/in_preparazione) davanti.
export function queueEtaMinutes({ status, position, prepStats, etaStats, baseMinutes, mode }) {
  if (
    status === ORDER_STATUSES.PRONTO ||
    status === ORDER_STATUSES.RITIRATO ||
    status === ORDER_STATUSES.PAGATO
  )
    return 0

  const prepAvg = avgPrepPerOrderMinutes(prepStats, baseMinutes)
  let remaining
  if (status === ORDER_STATUSES.IN_PREPARAZIONE) {
    // Già sul banco di lavoro: in media è a metà preparazione.
    remaining = prepAvg * 0.5
  } else {
    // In coda: prima vengono preparati gli ordini davanti, poi il suo.
    remaining = (Math.max(0, Number(position) || 0) + 1) * prepAvg
  }

  // Per il servizio al tavolo si aggiunge il tempo medio di consegna.
  if (mode === 'tavolo') {
    const servingBase = (Number(baseMinutes) || 0) * (1 - PREP_BASE_FRACTION)
    remaining += blend(servingBase, etaStats?.ritiro_ms, etaStats?.count)
  }

  return Math.max(1, Math.round(remaining))
}

// Medie per fase in minuti (per il resoconto). Combina i due gruppi:
// attesa/preparazione da prep_stats (campione più ampio), servizio da eta_stats.
export function phaseAverages(prepStats, etaStats) {
  const avg = (sum, count) => {
    const n = Number(count) || 0
    return n > 0 ? (Number(sum) || 0) / 60000 / n : null
  }
  return {
    attesa: avg(prepStats?.attesa_ms, prepStats?.count),
    preparazione: avg(prepStats?.prep_ms, prepStats?.count),
    servizio: avg(etaStats?.ritiro_ms, etaStats?.count),
    cicloCompleto: avg(etaStats?.total_ms, etaStats?.count),
  }
}

// --- Statistiche di incasso (da ordini mappati) ---

const isCancelled = (o) => o.status === ORDER_STATUSES.ANNULLATO

// SCONTO SPALMATO SULLE RIGHE. Lo sconto è un importo sul CONTO, mentre le
// righe portano il prezzo di LISTINO: sommando i listini si legge un incasso
// che non è mai entrato in cassa (4 coca cola a 3€ = 12€ anche se il conto è
// stato chiuso a 9€). Il fattore ripartisce lo sconto in proporzione, così
// "venduto per prodotto" e "per categoria" tornano col totale incassato.
export function discountFactor(order) {
  const lordo = (order?.order_items || []).reduce(
    (s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_price) || 0),
    0
  )
  const sconto = Number(order?.discount_amount) || 0
  if (!(lordo > 0) || !(sconto > 0)) return 1
  return Math.max(0, 1 - sconto / lordo)
}

const cent = (n) => Math.round((Number(n) || 0) * 100) / 100

// Vendite per prodotto: [{ name, qty, revenue }] ordinate per quantità.
// `revenue` è AL NETTO degli sconti applicati al conto.
export function aggregateProducts(orders) {
  const byName = new Map()
  for (const o of orders) {
    if (isCancelled(o)) continue
    const f = discountFactor(o)
    for (const i of o.order_items || []) {
      const cur = byName.get(i.name) || { name: i.name, qty: 0, revenue: 0 }
      cur.qty += Number(i.qty) || 0
      cur.revenue += (Number(i.qty) || 0) * (Number(i.unit_price) || 0) * f
      byName.set(i.name, cur)
    }
  }
  return [...byName.values()]
    .map((x) => ({ ...x, revenue: cent(x.revenue) }))
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name))
}

// Incassi, esclusi gli ordini annullati.
export function ordersFinance(orders) {
  const valid = orders.filter((o) => !isCancelled(o))
  const sum = (fn) => valid.reduce((s, o) => s + (Number(fn(o)) || 0), 0)
  const incasso = sum((o) => o.total)
  const coperto = sum((o) => o.coperto_amount)
  const servizio = sum((o) => o.service_charge_amount)
  const mance = sum((o) => o.tip_amount)
  return {
    ordini: valid.length,
    incasso,
    drink: incasso - coperto - servizio - mance,
    coperto,
    servizio,
    mance,
  }
}

// Ordine con la preparazione più lunga (in_preparazione → pronto).
export function longestPrep(orders) {
  let best = null
  for (const o of orders) {
    if (isCancelled(o)) continue
    const t1 = Date.parse(o.status_times?.[ORDER_STATUSES.IN_PREPARAZIONE] || '')
    const t2 = Date.parse(o.status_times?.[ORDER_STATUSES.PRONTO] || '')
    if (!Number.isFinite(t1) || !Number.isFinite(t2) || t2 < t1) continue
    const minutes = (t2 - t1) / 60000
    if (!best || minutes > best.minutes) {
      best = { daily_number: o.daily_number, minutes }
    }
  }
  return best
}
