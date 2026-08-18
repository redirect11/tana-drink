import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchOrdersBetween,
  fetchDrinks,
  fetchCashSessions,
  subscribeSettings,
  DEFAULT_SETTINGS,
} from '../lib/api.js'
import { businessDayKey } from '../lib/businessDay.js'
import { shiftDay } from '../lib/ore.js'
import { formatPrice } from '../lib/orderStatus.js'
import {
  kpiSummary,
  revenueByHour,
  revenueByDay,
  revenueByDayInRange,
  topProducts,
  revenueByCategory,
  hourRangeReport,
  ingredientUsage,
  prepTimeStats,
  serviceModeSplit,
  extrasBreakdown,
  DEFAULT_HOUR_RANGE,
} from '../lib/stats.js'
import MacroMonthlyTab from './MacroMonthlyTab.jsx'
import { Sottosezioni } from '../lib/sottosezioni.js'

const fmtMin = (m) => (m == null ? '—' : `${Math.round(m * 10) / 10} min`)
// Prezzo compatto per le etichette dei grafici (niente centesimi).
const fmtShort = (v) => `${Math.round(v).toLocaleString('it-IT', { useGrouping: 'always' })} €`
const fmtQty = (u) =>
  u.unit === 'pz' ? `${u.qty} pz` : u.qty >= 1000 ? `${(u.qty / 1000).toFixed(1)} L` : `${Math.round(u.qty)} ml`

// Statistiche del locale, per GIORNATA COMMERCIALE o per SERATA (la finestra
// di una chiusura di cassa).
const PERIOD_PRESETS = [7, 10, 20, 30, 60]

// Etichetta di una serata nell'elenco: data, orari e incasso, così si sceglie
// riconoscendola e non a numero di riga.
const etichettaSerata = (s) => {
  const d = (iso, opt) => {
    try {
      return new Date(iso).toLocaleString('it-IT', opt)
    } catch {
      return '—'
    }
  }
  const giorno = d(s.opened_at, { weekday: 'short', day: '2-digit', month: '2-digit' })
  const da = d(s.opened_at, { hour: '2-digit', minute: '2-digit' })
  const a = s.closed_at ? d(s.closed_at, { hour: '2-digit', minute: '2-digit' }) : 'in corso'
  const inc = Number(s.snapshot?.incassato)
  return `${giorno} · ${da}→${a}${Number.isFinite(inc) && inc > 0 ? ` · ${Math.round(inc)} €` : ''}`
}

// Le Statistiche hanno due viste: il giornaliero (finestra a giornate) e il
// mensile per macro-categoria (Dashboard A).
// Le due viste sono SOTTOSEZIONI della pagina, come in Magazzino e
// Impostazioni: stanno nel menu (che su queste pagine resta aperto a
// lato) invece che in una riga di chip sopra il contenuto. Erano l'unica
// pagina con le sue sezioni in pagina, e una riga costa altezza a una
// schermata che è già fatta di tabelle.
const SEZIONI_STATS = [
  { id: 'giornaliero', icona: '📊', label: 'Giornaliero' },
  { id: 'mensile', icona: '🗂', label: 'Mensile per macro' },
]

export default function StatsTab() {
  const [sub, setSub] = useState('giornaliero') // 'giornaliero' | 'mensile'
  return (
    <div>
      <Sottosezioni voci={SEZIONI_STATS} attiva={sub} scegli={setSub} />
      {sub === 'giornaliero' ? <DailyStats /> : <MacroMonthlyTab />}
    </div>
  )
}

function DailyStats() {
  const [loaded, setLoaded] = useState(false)
  const [orders, setOrders] = useState([])
  const [drinks, setDrinks] = useState([])
  const [error, setError] = useState(null)
  const [period, setPeriod] = useState(10) // ultime N giornate
  const [custom, setCustom] = useState(false)
  const [customInput, setCustomInput] = useState('15')
  const effective = custom ? Math.max(1, Number(customInput) || 1) : period
  // Carica abbastanza giornate da coprire il periodo scelto (min 60).
  const [loadLimit, setLoadLimit] = useState(60)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  useEffect(() => subscribeSettings(setSettings, () => {}), [])
  const cutoff = settings.business_day_cutoff_hour
  if (effective > loadLimit) setLoadLimit(Math.ceil(effective / 30) * 30)
  // Range orari configurabili dei grafici.
  const [hourRange, setHourRange] = useState(DEFAULT_HOUR_RANGE)
  // SERATA (chiusura di cassa): in alternativa alle ultime N giornate si
  // guardano le statistiche di UNA serata, dall'apertura alla chiusura della
  // cassa. È il taglio con cui si ragiona davvero al bancone ("com'è andata
  // sabato"), e non coincide con la giornata solare: la cassa scavalca la
  // mezzanotte.
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState(null)
  // Si apre sull'ULTIMA CHIUSURA, non su sette giorni: la domanda del
  // mattino dopo è «com'è andata ieri sera». Solo la prima volta — se poi
  // si sceglie un altro periodo, quella scelta resta.
  const primaScelta = useRef(true)
  useEffect(() => {
    let vivo = true
    fetchCashSessions({ limit: 60 })
      .then((list) => {
        if (!vivo) return
        const utili = list.filter((x) => x.opened_at)
        setSessions(utili)
        const ultimaChiusa = utili.find((x) => x.status !== 'open')
        if (primaScelta.current && ultimaChiusa) {
          primaScelta.current = false
          setSessionId(ultimaChiusa.id)
        }
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])
  const serata = useMemo(
    () => sessions.find((x) => x.id === sessionId) || null,
    [sessions, sessionId]
  )
  // Una serata vecchia può stare fuori dalla finestra già scaricata.
  useEffect(() => {
    if (!serata) return
    const oggi = businessDayKey(new Date(), cutoff)
    const giorni = Math.ceil((Date.parse(oggi) - Date.parse(businessDayKey(serata.opened_at, cutoff))) / 86400000) + 2
    if (Number.isFinite(giorni) && giorni > loadLimit) setLoadLimit(Math.ceil(giorni / 30) * 30)
  }, [serata, cutoff, loadLimit])
  // Sezione "venduto nella fascia oraria": ha un suo intervallo di DATE, così
  // si può chiedere "sabato scorso, fra le 22 e l'una" indipendentemente dal
  // periodo generale scelto sopra.
  const [fasciaDal, setFasciaDal] = useState(() => businessDayKey(new Date(), cutoff))
  const [fasciaAl, setFasciaAl] = useState(() => businessDayKey(new Date(), cutoff))
  const [dayRange, setDayRange] = useState({ from: '22:00', to: '00:00' })

  // Date scelte fuori dai dati già scaricati: si allarga la finestra.
  useEffect(() => {
    const oggi = businessDayKey(new Date(), cutoff)
    const giorni = Math.ceil((Date.parse(oggi) - Date.parse(fasciaDal)) / 86400000) + 1
    if (Number.isFinite(giorni) && giorni > loadLimit) {
      setLoadLimit(Math.ceil(giorni / 30) * 30)
    }
  }, [fasciaDal, cutoff, loadLimit])

  useEffect(() => {
    let active = true
    setLoaded(false)
    const oggi = businessDayKey(new Date(), cutoff)
    const from = shiftDay(oggi, -(loadLimit - 1))
    Promise.all([
      fetchOrdersBetween(from, oggi, cutoff),
      fetchDrinks({}).catch(() => []),
    ])
      .then(([o, d]) => {
        if (!active) return
        setOrders(o)
        setDrinks(d)
        setLoaded(true)
      })
      .catch((e) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [loadLimit, cutoff])

  // Giornate che hanno avuto attività, più recenti prima.
  const giorniAttivi = useMemo(() => {
    const set = new Set()
    for (const o of orders) {
      const k = businessDayKey(o.created_at, cutoff)
      if (k) set.add(k)
    }
    return [...set].sort().reverse()
  }, [orders, cutoff])

  const view = useMemo(() => {
    if (!loaded) return null
    // Serata scelta → finestra della cassa; altrimenti le ultime N giornate.
    let sel
    let ord
    if (serata) {
      const da = serata.opened_at
      const a = serata.closed_at || new Date().toISOString()
      ord = orders.filter((o) => o.created_at >= da && o.created_at <= a)
      sel = [...new Set(ord.map((o) => businessDayKey(o.created_at, cutoff)).filter(Boolean))]
    } else {
      sel = giorniAttivi.slice(0, effective)
      const selSet = new Set(sel)
      ord = orders.filter((o) => selSet.has(businessDayKey(o.created_at, cutoff)))
    }
    const drinksById = Object.fromEntries(drinks.map((d) => [d.id, d]))
    return {
      sel,
      kpi: kpiSummary(ord, sel),
      byHour: revenueByHour(ord, hourRange),
      byDay: revenueByDay(ord, cutoff),
      byDayRange: revenueByDayInRange(ord, dayRange, cutoff),
      top: topProducts(ord),
      byCategory: revenueByCategory(ord, drinksById).slice(0, 10),
      // Cosa si è venduto DAVVERO nella fascia scelta (totale, prodotti,
      // categorie), sulle GIORNATE indicate qui sotto — non sul periodo sopra.
      fascia: hourRangeReport(
        orders.filter((o) => {
          const k = businessDayKey(o.created_at, cutoff)
          return k && k >= fasciaDal && k <= fasciaAl
        }),
        hourRange,
        drinksById
      ),
      ingredients: ingredientUsage(ord, drinksById),
      prep: prepTimeStats(ord),
      split: serviceModeSplit(ord),
      extras: extrasBreakdown(ord),
    }
  }, [loaded, giorniAttivi, orders, drinks, effective, hourRange, dayRange, cutoff, fasciaDal, fasciaAl, serata])

  if (error) return <div className="banner">Errore: {error}</div>
  if (!loaded) return <div className="empty">Carico le statistiche…</div>
  if (giorniAttivi.length === 0) {
    return (
      <div className="empty">
        Nessun ordine ancora: le statistiche compaiono dopo la prima giornata di lavoro.
      </div>
    )
  }

  const { kpi, byHour, byDay, byDayRange, top, byCategory, ingredients, prep, split, extras, fascia } = view

  return (
    <div>
      <div className="chips-row" style={{ marginBottom: 6 }}>
        {/* LA SERATA PER PRIMA, ED È QUELLA DI PARTENZA. La domanda del
            mattino dopo è «com'è andata ieri sera», non «com'è andata la
            settimana»: era in fondo alla riga e si apriva sempre su sette
            giorni, che è un'altra domanda. */}
        {sessions.length > 0 && (
          <button
            className={`chip${serata ? ' active' : ''}`}
            onClick={() => {
              setCustom(false)
              setSessionId(serata ? null : (sessions.find((x) => x.status !== 'open') || sessions[0]).id)
            }}
          >
            🧾 Ultima chiusura
          </button>
        )}
        {PERIOD_PRESETS.map((v) => (
          <button
            key={v}
            className={`chip${!custom && !serata && period === v ? ' active' : ''}`}
            onClick={() => {
              setSessionId(null)
              setCustom(false)
              setPeriod(v)
            }}
          >
            Ultime {v}
          </button>
        ))}
        <button
          className={`chip${custom ? ' active' : ''}`}
          onClick={() => {
            setSessionId(null)
            setCustom(true)
          }}
        >
          Personalizzato
        </button>
        {serata && (
          <select
            className="setting-amount"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            aria-label="Scegli la serata"
            style={{ maxWidth: 260 }}
          >
            {sessions.map((x) => (
              <option key={x.id} value={x.id}>
                {etichettaSerata(x)}
              </option>
            ))}
          </select>
        )}
        {custom && (
          <input
            className="setting-amount"
            type="number"
            min="1"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            style={{ width: 80 }}
            aria-label="Numero di giornate"
          />
        )}
      </div>
      <p className="muted small" style={{ margin: '0 0 12px' }}>
        {serata ? (
          <>
            Serata del {etichettaSerata(serata)} — dall’apertura alla chiusura della cassa,
            mezzanotte compresa.
          </>
        ) : (
          <>
            Statistiche sulle ultime {Math.min(effective, giorniAttivi.length)} giornate
            {giorniAttivi.length < effective ? ` (${giorniAttivi.length} disponibili)` : ''}.
          </>
        )}
      </p>

      {/* KPI */}
      <div className="kpi-grid">
        <Kpi label="Incasso" value={formatPrice(kpi.incasso)} />
        <Kpi label="Ordini" value={kpi.ordini} sub={`${kpi.giorni} giornate`} />
        <Kpi label="Scontrino medio" value={formatPrice(kpi.scontrinoMedio)} />
        <Kpi label="Drink venduti" value={kpi.drinkVenduti} sub={`${kpi.drinkPerOrdine.toFixed(1)}/ordine`} />
        <Kpi label="Incasso / giornata" value={formatPrice(kpi.incassoPerGiorno)} />
        <Kpi label="Ora di punta" value={byHour.peakLabel ?? '—'} />
        <Kpi label="Attesa media" value={fmtMin(prep.attesaMedia)} />
        <Kpi label="Preparazione media" value={fmtMin(prep.prepMedia)} />
      </div>

      <ChartCard title="📈 Incasso per giornata">
        <VBars
          data={byDay.map((s) => ({
            label: `${s.weekday} ${s.label}`,
            value: s.incasso,
            sub: `${s.ordini} ordini`,
          }))}
          format={fmtShort}
        />
      </ChartCard>

      <ChartCard title="🕙 Incasso per fascia oraria">
        <TimeRange value={hourRange} onChange={setHourRange} />
        <VBars
          data={byHour.buckets.map((b) => ({
            label: b.label,
            value: b.incasso,
            sub: `${b.ordini} ordini`,
          }))}
          format={fmtShort}
        />
      </ChartCard>

      {/* Cosa si è venduto nella fascia oraria scelta qui sopra: totale, tutti
          i prodotti e le categorie. Risponde a "fra le 22 e l'una cosa vendo?" */}
      <ChartCard title="🧾 Venduto nella fascia oraria">
        <div className="grid-2" style={{ gap: 8, marginBottom: 8 }}>
          <div>
            <label htmlFor="fascia-dal" className="muted small">Dal giorno</label>
            <input
              id="fascia-dal"
              type="date"
              value={fasciaDal}
              max={fasciaAl}
              onChange={(e) => setFasciaDal(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="fascia-al" className="muted small">Al giorno</label>
            <input
              id="fascia-al"
              type="date"
              value={fasciaAl}
              min={fasciaDal}
              onChange={(e) => setFasciaAl(e.target.value)}
            />
          </div>
        </div>
        <TimeRange value={hourRange} onChange={setHourRange} />
        <div className="row between" style={{ alignItems: 'baseline', margin: '8px 0' }}>
          <span className="muted small">
            {hourRange.from}–{hourRange.to} · {fascia.nOrdini} cont{fascia.nOrdini === 1 ? 'o' : 'i'}
          </span>
          <strong className="price" style={{ fontSize: '1.3rem' }}>{formatPrice(fascia.totale)}</strong>
        </div>
        {fascia.prodotti.length === 0 ? (
          <p className="muted small">Nessuna vendita in questa fascia.</p>
        ) : (
          <>
            <div className="muted small" style={{ margin: '6px 0 4px' }}>Categorie</div>
            <HBars
              data={fascia.categorie.map((c) => ({
                label: `${c.name} (${c.qty})`,
                value: c.revenue,
                text: formatPrice(c.revenue),
              }))}
            />
            <div className="muted small" style={{ margin: '10px 0 4px' }}>
              Prodotti venduti ({fascia.prodotti.length})
            </div>
            <div className="fascia-prodotti">
              {fascia.prodotti.map((p) => (
                <div className="row between fascia-riga" key={p.name}>
                  <span className="grow">{p.qty}× {p.name}</span>
                  <span className="muted">{formatPrice(p.revenue)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </ChartCard>

      <ChartCard title="📅 Incasso per giornata nella fascia scelta">
        <TimeRange value={dayRange} onChange={setDayRange} />
        <VBars
          data={byDayRange.map((s) => ({
            label: `${s.weekday} ${s.label}`,
            value: s.incasso,
            sub: `${s.ordini} ordini`,
          }))}
          format={fmtShort}
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
          {/* Gli sconti sono già scalati dagli incassi qui sopra: si mostrano
              per sapere quanto si è lasciato sul tavolo. */}
          {extras.sconti > 0 && (
            <Row k="Sconti concessi (già dedotti)" v={`−${formatPrice(extras.sconti)}`} />
          )}
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

// Selettore di fascia oraria (da → a, anche oltre la mezzanotte).
function TimeRange({ value, onChange }) {
  return (
    <div className="time-range">
      <label>
        Dalle
        <input
          type="time"
          value={value.from}
          onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
        />
      </label>
      <label>
        alle
        <input
          type="time"
          value={value.to}
          onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
        />
      </label>
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
