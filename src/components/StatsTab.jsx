import { useEffect, useMemo, useState } from 'react'
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
import { elencoSerate, etichettaSerata } from '../lib/serate.js'
import { Sottosezioni } from '../lib/sottosezioni.js'

const fmtMin = (m) => (m == null ? '—' : `${Math.round(m * 10) / 10} min`)
// Prezzo compatto per le etichette dei grafici (niente centesimi).
const fmtShort = (v) => `${Math.round(v).toLocaleString('it-IT', { useGrouping: 'always' })} €`
const fmtQty = (u) =>
  u.unit === 'pz' ? `${u.qty} pz` : u.qty >= 1000 ? `${(u.qty / 1000).toFixed(1)} L` : `${Math.round(u.qty)} ml`

// Statistiche del locale, per GIORNATA COMMERCIALE o per SERATA (la finestra
// di una chiusura di cassa).
const PERIOD_PRESETS = [7, 10, 20, 30, 60]

// LE DUE DOMANDE, DUE SOTTOSEZIONI. «È la cosa principale che si vuole
// vedere, il resto dei filtri sono secondari» (l'utente, 22/08/2026): la
// serata viene prima e si apre di suo, il periodo resta per chi guarda
// l'andamento. Stanno nel menu laterale come in Magazzino e in Cassa —
// docs/navigazione.md — e non in una riga di pastiglie in pagina, che su una
// schermata di grafici costerebbe altezza tutto il giorno.
//
// (Il «Mensile per macro» non c'entra: ha traslocato in Bilancio → Venduto ×
// Incassato, ed è per quello che le sottosezioni erano sparite — una sola
// voce spuntata da sé nel menu è una scelta che non è una scelta.)
const SEZIONI = [
  { id: 'serate', icona: '📒', label: 'Per serata' },
  { id: 'periodo', icona: '📈', label: 'Per periodo' },
]

export default function StatsTab() {
  const [sezione, setSezione] = useState('serate')
  return (
    <div>
      <Sottosezioni voci={SEZIONI} attiva={sezione} scegli={setSezione} />
      <DailyStats sezione={sezione} />
    </div>
  )
}

// I dati stanno QUI, sopra le due sottosezioni: sono gli stessi ordini e le
// stesse sessioni: caricarli una volta sola vuol dire che passare da una
// vista all'altra non fa aspettare nessuno.
function DailyStats({ sezione = 'serate' }) {
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
  useEffect(() => {
    let vivo = true
    fetchCashSessions({ limit: 60 })
      .then((list) => vivo && setSessions(list.filter((x) => x.opened_at)))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])
  // La serata aperta nel dettaglio esiste solo dentro la sua sottosezione.
  const serata = useMemo(
    () => (sezione === 'serate' && sessions.find((x) => x.id === sessionId)) || null,
    [sessions, sessionId, sezione]
  )
  // E USCENDO SI DIMENTICA: rientrando si riparte dalla lista. Il dettaglio
  // era stato chiuso apposta, e ritrovarcisi dentro vuol dire non sapere più
  // cosa fa la freccia in cima — se sta chiudendo qualcosa che si era aperto
  // o riportando indietro di due passi.
  useEffect(() => {
    if (sezione !== 'serate') setSessionId(null)
  }, [sezione])
  // Le righe dell'elenco: costruite da quello che c'è già in mano — nessuna
  // lettura, nessuna attesa fra il tocco e la lista.
  const righe = useMemo(() => elencoSerate(sessions, orders), [sessions, orders])
  // Una serata vecchia può stare fuori dalla finestra già scaricata: allora
  // si allarga, ed è l'UNICO punto in cui si aspetta qualcosa. Succede
  // aprendo il dettaglio di una serata vecchia, mai scorrendo la lista — che
  // per quelle mostra i numeri congelati alla chiusura (vedi serate.js).
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

  // A) PER SERATA — l'elenco è la schermata di partenza, il dettaglio si apre
  // toccando una riga.
  if (sezione === 'serate' && !serata) return <ElencoSerate righe={righe} onApri={setSessionId} />

  if (giorniAttivi.length === 0) {
    return (
      <div className="empty">
        Nessun ordine ancora: le statistiche compaiono dopo la prima giornata di lavoro.
      </div>
    )
  }

  // Gli stessi comandi valgono per tutte e due le sottosezioni: le fasce
  // orarie e l'intervallo del «venduto nella fascia» sono di chi guarda, non
  // del periodo guardato.
  const comandi = {
    hourRange,
    setHourRange,
    dayRange,
    setDayRange,
    fasciaDal,
    setFasciaDal,
    fasciaAl,
    setFasciaAl,
  }

  if (serata) {
    return (
      <div>
        {/* UNA SOLA VIA D'USCITA, e dice dove riporta — non «indietro», che
            si capisce solo ricordandosi da dove si è arrivati. */}
        <button className="btn ghost small" onClick={() => setSessionId(null)}>
          ← Chiusure
        </button>
        <p className="muted small" style={{ margin: '8px 0 12px' }}>
          Serata del {etichettaSerata(serata)} — dall’apertura alla chiusura della cassa,
          mezzanotte compresa.
        </p>
        <CorpoStatistiche view={view} comandi={comandi} />
      </div>
    )
  }

  // B) PER PERIODO — le pastiglie di sempre, senza quelle della serata: la
  // serata ha una sottosezione sua e qui non servono più.
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
        <button className={`chip${custom ? ' active' : ''}`} onClick={() => setCustom(true)}>
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
            aria-label="Numero di giornate"
          />
        )}
      </div>
      <p className="muted small" style={{ margin: '0 0 12px' }}>
        Statistiche sulle ultime {Math.min(effective, giorniAttivi.length)} giornate
        {giorniAttivi.length < effective ? ` (${giorniAttivi.length} disponibili)` : ''}.
      </p>
      <CorpoStatistiche view={view} comandi={comandi} />
    </div>
  )
}

// ── L'ELENCO DELLE CHIUSURE ──────────────────────────────────────────
// La forma è quella della lista del magazzino (`inv-list`/`inv-row`), che
// l'utente ha indicato come la lista fatta bene: una famiglia sola di righe
// per tutto il gestionale, invece di una forma nuova per ogni schermata.
// I numeri stanno in colonne allineate a destra e si LEGGONO DA SOLI («12
// conti», «24,00 € medio»): senza intestazione da tenere a mente, e
// sopravvivono al capo riga sul telefono.
function ElencoSerate({ righe, onApri }) {
  if (righe.length === 0) {
    return <div className="empty">Nessuna chiusura di cassa registrata.</div>
  }
  return (
    <div>
      <p className="muted small" style={{ margin: '0 0 8px' }}>
        Tocca una serata per vederne le statistiche.
      </p>
      <div className="inv-list">
        {righe.map((r) => (
          <div className="inv-row" key={r.id}>
            <button
              type="button"
              className="inv-row-main"
              onClick={() => onApri(r.id)}
              title={
                r.inCorso
                  ? 'Cassa ancora aperta: i numeri sono quelli di adesso.'
                  : r.daSnapshot
                    ? 'Numeri della chiusura di cassa: gli ordini di questa serata sono troppo vecchi per essere qui.'
                    : undefined
              }
            >
              <span className="inv-row-name">{r.giorno}</span>
              <span className="muted small inv-row-cat">
                {r.orario}
                {r.durata ? ` · ${r.durata}` : ''}
              </span>
              <span className="muted small inv-row-price">
                {r.conti} cont{r.conti === 1 ? 'o' : 'i'}
              </span>
              <span className="muted small inv-row-price">{formatPrice(r.scontrinoMedio)} medio</span>
              <span className="inv-row-price inv-row-stock">{formatPrice(r.incasso)}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── IL CORPO DELLE STATISTICHE ───────────────────────────────────────
// Gli stessi grafici per tutte e due le sottosezioni: cambia solo QUALI
// ordini ci finiscono dentro (una serata, o le ultime N giornate), e quello
// lo decide chi chiama. I conti non si duplicano: arrivano già fatti in
// `view`.
function CorpoStatistiche({ view, comandi }) {
  const { kpi, byHour, byDay, byDayRange, top, byCategory, ingredients, prep, split, extras, fascia } = view
  const { hourRange, setHourRange, dayRange, setDayRange, fasciaDal, setFasciaDal, fasciaAl, setFasciaAl } =
    comandi
  return (
    <div>
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
