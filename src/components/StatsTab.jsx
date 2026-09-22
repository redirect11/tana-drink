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
import { aggregateProducts } from '../lib/eta.js'
import { elencoSerate, etichettaSerata } from '../lib/serate.js'
import { Sottosezioni } from '../lib/sottosezioni.js'
import MagazzinoPeriodo from './MagazzinoPeriodo.jsx'

const fmtMin = (m) => (m == null ? '—' : `${Math.round(m * 10) / 10} min`)
// Prezzo compatto per le etichette dei grafici (niente centesimi).
const fmtShort = (v) => `${Math.round(v).toLocaleString('it-IT', { useGrouping: 'always' })} €`
const fmtQty = (u) =>
  u.unit === 'pz' ? `${u.qty} pz` : u.qty >= 1000 ? `${(u.qty / 1000).toFixed(1)} L` : `${Math.round(u.qty)} ml`

// Statistiche del locale, per GIORNATA COMMERCIALE o per SERATA (la finestra
// di una chiusura di cassa).
//
// IL PERIODO È UN INTERVALLO DI DATE, e le pastiglie sono scorciatoie che lo
// riempiono. Prima era un CONTATORE di giornate all'indietro, e Flavio
// (17/09/2026) ha detto cosa non funzionava: «mi appare questo counter dei
// giorni … ma qui in realtà mi dovrebbe apparire un inizio periodo fine
// periodo … così riesco a vedere realmente la fascia di periodo che mi
// interessa, così come può essere il giugno, così come può essere il periodo
// di Natale». Con un contatore giugno non si guarda: si guarda «gli ultimi
// 108 giorni», che è un'altra domanda.
const PERIOD_PRESETS = [7, 10, 20, 30, 60]

// Le date sono GIORNATE COMMERCIALI, non giorni solari: la nottata oltre la
// mezzanotte appartiene alla giornata in cui è cominciata, qui come nel
// resto dell'app.
//
// LE PASTIGLIE HANNO CAMBIATO SENSO, e l'etichetta lo dice. «Ultime 7»
// voleva dire le ultime sette giornate CON ORDINI, quante che fossero
// indietro nel tempo; adesso riempiono un intervallo, quindi sono sette
// GIORNI di calendario — e un locale chiuso il lunedì ne troverà sei
// lavorati. È la stessa unità delle due caselle qui sotto: due comandi che
// riempiono la stessa cosa non possono contare in due modi diversi.
const periodoDaPreset = (n, oggi) => ({ preset: n, dal: shiftDay(oggi, -(n - 1)), al: oggi })
const giorniFra = (dal, al) => Math.round((Date.parse(al) - Date.parse(dal)) / 86400000) + 1
// La data per esteso, non «oggi»/«ieri»: qui si sta verificando un periodo
// scelto a mano, e le parole comode costringerebbero a fidarsi.
const dataBreve = (key) => (key ? key.split('-').reverse().join('/') : '')

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
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  useEffect(() => subscribeSettings(setSettings, () => {}), [])
  const cutoff = settings.business_day_cutoff_hour
  // Il periodo guardato: due giornate commerciali, più la pastiglia che lo
  // ha riempito (null quando le date sono state scritte a mano) — serve solo
  // a sapere quale accendere e come scrivere la didascalia.
  const [periodo, setPeriodo] = useState(() =>
    periodoDaPreset(10, businessDayKey(new Date(), DEFAULT_SETTINGS.business_day_cutoff_hour))
  )
  // L'ora di taglio arriva dalle impostazioni DOPO il primo disegno: finché
  // il periodo è una pastiglia si rifà da sé, se no resta quello scritto a
  // mano, che è una scelta di chi guarda e non si tocca.
  useEffect(() => {
    setPeriodo((p) => (p.preset ? periodoDaPreset(p.preset, businessDayKey(new Date(), cutoff)) : p))
  }, [cutoff])
  // Carica abbastanza giornate da coprire il periodo scelto (min 60).
  const [loadLimit, setLoadLimit] = useState(60)
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
  // IL «VENDUTO NELLA FASCIA ORARIA» NON HA PIÙ DATE SUE (19/09/2026). Ne
  // aveva un paio, nate quando il periodo qui sopra era un contatore di
  // giornate e non un intervallo: per chiedere «sabato scorso fra le 22 e
  // l'una» serviva dirlo lì. Da quando il periodo si sceglie da data a data
  // (REQ-STAT-002) quelle due caselle dicevano la stessa cosa in un altro
  // posto, e chi le trovava non sapeva quale delle due comandasse — nella
  // foto di Daniele il periodo era impostato in alto e la fascia diceva
  // «nessuna vendita», perché guardava altrove. Adesso la fascia lavora
  // sugli stessi conti del resto della schermata: cambia solo l'ORA.
  const [dayRange, setDayRange] = useState({ from: '22:00', to: '00:00' })

  // Un periodo che guarda più indietro dei dati già scaricati: si allarga la
  // finestra.
  useEffect(() => {
    const giorni = giorniFra(periodo.dal, businessDayKey(new Date(), cutoff))
    if (Number.isFinite(giorni) && giorni > loadLimit) {
      setLoadLimit(Math.ceil(giorni / 30) * 30)
    }
  }, [periodo.dal, cutoff, loadLimit])

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
      sel = giorniAttivi.filter((g) => g >= periodo.dal && g <= periodo.al)
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
      // La classifica INTERA, che è un'altra cosa dai primi dieci a grafico:
      // «capisco cosa ho venduto di più, che cosa credevo di poter vendere e
      // invece alla fine non ho venduto» (Flavio, 17/09/2026). La coda
      // dell'elenco è metà della risposta, e un grafico a dieci barre la
      // taglia via.
      classifica: aggregateProducts(ord),
      byCategory: revenueByCategory(ord, drinksById).slice(0, 10),
      // Cosa si è venduto DAVVERO nella fascia scelta (totale, prodotti,
      // categorie), sugli STESSI conti del periodo: qui si stringe l'ora, non
      // le date — quelle le ha già dette chi ha scelto il periodo.
      fascia: hourRangeReport(ord, hourRange, drinksById),
      ingredients: ingredientUsage(ord, drinksById),
      prep: prepTimeStats(ord),
      split: serviceModeSplit(ord),
      extras: extrasBreakdown(ord),
    }
  }, [loaded, giorniAttivi, orders, drinks, periodo, hourRange, dayRange, cutoff, serata])

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
  const comandi = { hourRange, setHourRange, dayRange, setDayRange }

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
        <CorpoStatistiche
          view={view}
          comandi={comandi}
          intervallo={{
            dal: businessDayKey(serata.opened_at, cutoff),
            al: businessDayKey(serata.closed_at || new Date(), cutoff),
          }}
          cutoff={cutoff}
        />
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
            className={`chip${periodo.preset === v ? ' active' : ''}`}
            onClick={() => setPeriodo(periodoDaPreset(v, businessDayKey(new Date(), cutoff)))}
          >
            {v} giorni
          </button>
        ))}
      </div>
      {/* LE DATE SONO IL COMANDO, le pastiglie sono le scorciatoie. Scrivere
          una delle due spegne la pastiglia: da lì in poi il periodo è quello
          che c'è scritto, e non si sposta più da solo. */}
      <div className="row" style={{ gap: 8, alignItems: 'flex-end', marginBottom: 6, flexWrap: 'wrap' }}>
        <span>
          <label htmlFor="periodo-dal" className="muted small">Dal giorno</label>
          <input
            id="periodo-dal"
            type="date"
            value={periodo.dal}
            max={periodo.al}
            onChange={(e) =>
              e.target.value && setPeriodo((p) => ({ preset: null, dal: e.target.value, al: p.al }))
            }
          />
        </span>
        <span>
          <label htmlFor="periodo-al" className="muted small">Al giorno</label>
          <input
            id="periodo-al"
            type="date"
            value={periodo.al}
            min={periodo.dal}
            onChange={(e) =>
              e.target.value && setPeriodo((p) => ({ preset: null, dal: p.dal, al: e.target.value }))
            }
          />
        </span>
      </div>
      <p className="muted small" style={{ margin: '0 0 12px' }}>
        Dal {dataBreve(periodo.dal)} al {dataBreve(periodo.al)}: {view.sel.length}{' '}
        {view.sel.length === 1 ? 'giornata' : 'giornate'} con ordini su{' '}
        {giorniFra(periodo.dal, periodo.al)}.
      </p>
      <CorpoStatistiche
        view={view}
        comandi={comandi}
        intervallo={{ dal: periodo.dal, al: periodo.al }}
        cutoff={cutoff}
      />
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

// ── LA CLASSIFICA DEL VENDUTO (REQ-STAT-002) ─────────────────────────
//
// «Anche per poter capire una classifica di quello che piaceva, che me li
// metti in ordine, in modo tale capisco cosa ho venduto di più, che cosa
// credevo di poter vendere e invece alla fine, analizzando i dati, non ho
// venduto» (Flavio, 17/09/2026).
//
// PERCHÉ NON BASTAVANO I GRAFICI CHE CI SONO GIÀ: mostrano i primi dieci, e
// la domanda di Flavio riguarda soprattutto la CODA — quello che si pensava
// di vendere e non si è venduto sta in fondo, dove le barre non arrivano.
// Qui c'è l'elenco intero, nella forma della lista del magazzino.
//
// SI ORDINA PER PEZZI O PER INCASSO, e sono due classifiche diverse: dieci
// amari da tre euro battono un cocktail da dodici nella prima e perdono
// nella seconda. Di suo per pezzi, che è la domanda di partenza («cosa
// piaceva»).
function ClassificaVenduto({ righe }) {
  const [perIncasso, setPerIncasso] = useState(false)
  const ordinate = useMemo(
    () => (perIncasso ? [...righe].sort((a, b) => b.revenue - a.revenue) : righe),
    [righe, perIncasso]
  )
  if (righe.length === 0) return null
  return (
    <div className="card">
      <div className="row between" style={{ alignItems: 'center' }}>
        <h3 className="cat-header" style={{ margin: 0 }}>
          🏆 Classifica del venduto
        </h3>
        <button type="button" className="btn ghost small" onClick={() => setPerIncasso((v) => !v)}>
          {perIncasso ? 'Ordina per pezzi' : 'Ordina per incasso'}
        </button>
      </div>
      <p className="muted small" style={{ margin: '8px 0 0' }}>
        Tutte le voci battute nel periodo, dalla più venduta all’ultima.
      </p>
      <div className="inv-list">
        {ordinate.map((p, i) => (
          <div className="inv-row" key={p.name}>
            <div className="inv-row-main statica">
              <span className="muted small" style={{ minWidth: 28 }}>
                {i + 1}
              </span>
              <span className="inv-row-name">{p.name}</span>
              <span className="inv-row-cat" />
              <span className="muted small inv-row-price">{p.qty} pz</span>
              <span className="inv-row-price inv-row-stock">{formatPrice(p.revenue)}</span>
            </div>
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
function CorpoStatistiche({ view, comandi, intervallo, cutoff }) {
  const { kpi, byHour, byDay, byDayRange, top, classifica, byCategory, ingredients, prep, split, extras, fascia } =
    view
  const { hourRange, setHourRange, dayRange, setDayRange } = comandi
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
      {/* Le date non ci sono più: fa fede il periodo scelto in cima
          (19/09/2026). Qui si stringe soltanto l'ora. */}
      <ChartCard title="🧾 Venduto nella fascia oraria">
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

      {/* ── I DUE ELENCHI DEL PERIODO (REQ-STAT-002) ───────────────────
          Flavio, 17/09/2026: «tutti questi dati mi servirebbero in formato di
          lista, un po' la visualizzazione come sono i prodotti del
          magazzino». I grafici qui sopra rispondono a «com'è andata»; questi
          due rispondono a «cosa, di preciso» — e una classifica si legge in
          fila, non a barre. */}
      <ClassificaVenduto righe={classifica} />
      {intervallo?.dal && intervallo?.al && (
        <MagazzinoPeriodo dal={intervallo.dal} al={intervallo.al} cutoffHour={cutoff} />
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
