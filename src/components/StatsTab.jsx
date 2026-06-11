import { useEffect, useMemo, useState } from 'react'
import {
  fetchClosedSerate,
  fetchOrdersForSerate,
  fetchDrinks,
} from '../lib/api.js'
import { formatPrice } from '../lib/orderStatus.js'
import {
  kpiSummary,
  revenueByHour,
  revenueBySerata,
  topProducts,
  revenueByCategory,
  ingredientUsage,
  prepTimeStats,
  serviceModeSplit,
  extrasBreakdown,
} from '../lib/stats.js'

const fmtMin = (m) => (m == null ? '—' : `${Math.round(m * 10) / 10} min`)
const fmtQty = (u) =>
  u.unit === 'pz' ? `${u.qty} pz` : u.qty >= 1000 ? `${(u.qty / 1000).toFixed(1)} L` : `${Math.round(u.qty)} ml`

// Statistiche del locale: calcolate dagli ordini delle serate chiuse.
const PERIOD_PRESETS = [7, 10, 20, 30, 60]

export default function StatsTab() {
  const [serate, setSerate] = useState(null)
  const [orders, setOrders] = useState([])
  const [drinks, setDrinks] = useState([])
  const [error, setError] = useState(null)
  const [period, setPeriod] = useState(10) // ultime N serate
  const [custom, setCustom] = useState(false)
  const [customInput, setCustomInput] = useState('15')
  const effective = custom ? Math.max(1, Number(customInput) || 1) : period
  // Carica abbastanza serate da coprire il periodo scelto (min 60).
  const [loadLimit, setLoadLimit] = useState(60)
  if (effective > loadLimit) setLoadLimit(Math.ceil(effective / 30) * 30)

  useEffect(() => {
    let active = true
    setSerate(null)
    Promise.all([fetchClosedSerate(loadLimit), fetchDrinks({}).catch(() => [])])
      .then(async ([s, d]) => {
        if (!active) return
        setSerate(s)
        setDrinks(d)
        const o = await fetchOrdersForSerate(s.map((x) => x.id))
        if (active) setOrders(o)
      })
      .catch((e) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [loadLimit])

  const view = useMemo(() => {
    if (!serate) return null
    const sel = serate.slice(0, effective)
    const ids = new Set(sel.map((s) => s.id))
    const ord = orders.filter((o) => ids.has(o.serata_id))
    const drinksById = Object.fromEntries(drinks.map((d) => [d.id, d]))
    return {
      sel,
      kpi: kpiSummary(ord, sel),
      byHour: revenueByHour(ord),
      bySerata: revenueBySerata(ord, sel),
      top: topProducts(ord),
      byCategory: revenueByCategory(ord, drinksById).slice(0, 10),
      ingredients: ingredientUsage(ord, drinksById),
      prep: prepTimeStats(ord),
      split: serviceModeSplit(ord),
      extras: extrasBreakdown(ord),
    }
  }, [serate, orders, drinks, effective])

  if (error) return <div className="banner">Errore: {error}</div>
  if (!serate) return <div className="empty">Carico le statistiche…</div>
  if (serate.length === 0) {
    return (
      <div className="empty">
        Nessuna serata chiusa: le statistiche compaiono dopo la prima serata.
      </div>
    )
  }

  const { kpi, byHour, bySerata, top, byCategory, ingredients, prep, split, extras } = view

  return (
    <div>
      <div className="chips-row" style={{ marginBottom: 6 }}>
        {PERIOD_PRESETS.map((v) => (
          <button
            key={v}
            className={`chip${!custom && period === v ? ' active' : ''}`}
            onClick={() => {
              setCustom(false)
              setPeriod(v)
            }}
          >
            Ultime {v}
          </button>
        ))}
        <button
          className={`chip${custom ? ' active' : ''}`}
          onClick={() => setCustom(true)}
        >
          Personalizzato
        </button>
        {custom && (
          <input
            className="setting-amount"
            type="number"
            min="1"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            style={{ width: 80 }}
            aria-label="Numero di serate"
          />
        )}
      </div>
      <p className="muted small" style={{ margin: '0 0 12px' }}>
        Statistiche sulle ultime {Math.min(effective, serate.length)} serate
        {serate.length < effective ? ` (${serate.length} disponibili)` : ''}.
      </p>

      {/* KPI */}
      <div className="kpi-grid">
        <Kpi label="Incasso" value={formatPrice(kpi.incasso)} />
        <Kpi label="Ordini" value={kpi.ordini} sub={`${kpi.serate} serate`} />
        <Kpi label="Scontrino medio" value={formatPrice(kpi.scontrinoMedio)} />
        <Kpi label="Drink venduti" value={kpi.drinkVenduti} sub={`${kpi.drinkPerOrdine.toFixed(1)}/ordine`} />
        <Kpi label="Incasso / serata" value={formatPrice(kpi.incassoPerSerata)} />
        <Kpi label="Ora di punta" value={byHour.peakLabel ?? '—'} />
        <Kpi label="Attesa media" value={fmtMin(prep.attesaMedia)} />
        <Kpi label="Preparazione media" value={fmtMin(prep.prepMedia)} />
      </div>

      <ChartCard title="📈 Incasso per serata">
        <VBars
          data={bySerata.map((s) => ({
            label: `${s.weekday} ${s.label}`,
            value: s.incasso,
            sub: `${s.ordini} ordini`,
          }))}
          format={formatPrice}
        />
      </ChartCard>

      <ChartCard title="🕙 Incasso per fascia oraria">
        <VBars
          data={byHour.buckets.map((b) => ({
            label: b.label,
            value: b.incasso,
            sub: `${b.ordini} ordini`,
          }))}
          format={formatPrice}
        />
      </ChartCard>

      <ChartCard title="💰 Top prodotti per incasso">
        <HBars data={top.byRevenue.map((p) => ({ label: p.name, value: p.revenue, text: formatPrice(p.revenue) }))} />
      </ChartCard>

      <ChartCard title="🔥 Prodotti più richiesti">
        <HBars data={top.byQty.map((p) => ({ label: p.name, value: p.qty, text: `${p.qty} pz` }))} />
      </ChartCard>

      {ingredients.length > 0 && (
        <ChartCard title="🧪 Ingredienti più usati">
          <HBars
            data={ingredients.map((u) => ({
              label: u.name,
              value: u.unit === 'pz' ? u.qty * 40 : u.qty, // scala comparabile
              text: fmtQty(u),
            }))}
          />
        </ChartCard>
      )}

      {byCategory.length > 0 && (
        <ChartCard title="🗂 Incasso per categoria">
          <HBars data={byCategory.map((c) => ({ label: c.name, value: c.revenue, text: formatPrice(c.revenue) }))} />
        </ChartCard>
      )}

      <div className="card">
        <h3 className="cat-header" style={{ marginTop: 0 }}>Dettagli</h3>
        <div className="summary-rows" style={{ margin: 0 }}>
          <Row k="Incasso drink" v={formatPrice(extras.drink)} />
          {extras.coperto > 0 && <Row k="Coperto" v={formatPrice(extras.coperto)} />}
          {extras.servizio > 0 && <Row k="Servizio" v={formatPrice(extras.servizio)} />}
          {extras.mance > 0 && <Row k="Mance" v={formatPrice(extras.mance)} />}
          <Row
            k="🍸 Al tavolo"
            v={`${split.tavolo.ordini} ordini · ${formatPrice(split.tavolo.incasso)}`}
          />
          <Row
            k="🚶 Al banco"
            v={`${split.banco.ordini} ordini · ${formatPrice(split.banco.incasso)}`}
          />
          {prep.prepMax && (
            <Row k="Preparazione più lunga" v={`#${prep.prepMax.daily_number} · ${fmtMin(prep.prepMax.minutes)}`} />
          )}
          <Row k="Ordini annullati" v={`${kpi.pctAnnullati.toFixed(1)}%`} />
          <Row k="Non ritirati/serviti" v={`${kpi.pctNonRitirati.toFixed(1)}%`} />
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub }) {
  return (
    <div className="kpi-card">
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="card">
      <h3 className="cat-header" style={{ marginTop: 0 }}>{title}</h3>
      {children}
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div className="summary-row">
      <span className="muted">{k}</span>
      <span>{v}</span>
    </div>
  )
}

// Barre verticali (trend): altezza proporzionale, valore al tap/hover.
function VBars({ data, format }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="vbars">
      {data.map((d, i) => (
        <div className="vbar-col" key={i} title={`${d.label}: ${format(d.value)} (${d.sub})`}>
          <div className="vbar-value">{format(d.value)}</div>
          <div className="vbar-track">
            <div className="vbar-fill" style={{ height: `${(d.value / max) * 100}%` }} />
          </div>
          <div className="vbar-label">{d.label}</div>
        </div>
      ))}
    </div>
  )
}

// Barre orizzontali (classifiche).
function HBars({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="hbars">
      {data.map((d, i) => (
        <div className="hbar-row" key={i}>
          <div className="hbar-label" title={d.label}>{d.label}</div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <div className="hbar-text">{d.text}</div>
        </div>
      ))}
    </div>
  )
}
