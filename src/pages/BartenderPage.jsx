import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from '../lib/firebaseClient.js'
import {
  updateOrderStatus,
  cancelOrder,
  subscribeOpenSerata,
  subscribeSerataOrders,
  subscribeSettings,
  openSerata,
  closeSerata,
  DEFAULT_SETTINGS,
} from '../lib/api.js'
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  STATUS_EMOJI,
  ritiratoLabel,
  formatPrice,
  nextStatus,
  placedByName,
} from '../lib/orderStatus.js'
import { bucketByStatus, serataRecap, openOrdersCount } from '../lib/serata.js'
import { aggregateProducts, serataFinance, longestPrep, phaseAverages } from '../lib/eta.js'
import { ensureNotificationPermission, notify } from '../lib/notify.js'
import { syncSumUpProducts, isSumUpEnabled } from '../lib/sumupApi.js'
import MenuManager from '../components/MenuManager.jsx'
import InventoryManager from '../components/InventoryManager.jsx'
import SettingsTab from '../components/SettingsTab.jsx'
import StatsTab from '../components/StatsTab.jsx'
import StaffTab from '../components/StaffTab.jsx'
import ServiceQueue from '../components/ServiceQueue.jsx'
import StaffMyOrders from '../components/StaffMyOrders.jsx'
import StaffCallList from '../components/StaffCallList.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import CancelOrderDialog from '../components/CancelOrderDialog.jsx'
import DevTools from '../components/DevTools.jsx'
import StaffDrawer from '../components/StaffDrawer.jsx'
import { isDevEnvironment } from '../dev/devActions.js'

export default function BartenderPage() {
  const [user, setUser] = useState(undefined) // undefined = caricamento, null = non loggato
  const [role, setRole] = useState(null) // 'bartender' | 'staff'
  // Tab iniziale anche da query (?tab=stats): usato dal drawer nel menu.
  const [params] = useSearchParams()
  const [tab, setTab] = useState(() => params.get('tab') || 'coda')

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null)
        setRole(null)
        return
      }
      // Ruolo dai custom claims: senza claim è un CLIENTE registrato
      // (nessun accesso al gestionale).
      try {
        const token = await u.getIdTokenResult()
        setRole(token.claims.role ?? 'cliente')
      } catch {
        setRole('cliente')
      }
      setUser(u)
    })
  }, [])

  if (user === undefined || (user && role === null)) {
    return <div className="empty">Verifica accesso…</div>
  }
  if (!user) return <LoginForm />

  // Cliente registrato: nessun accesso al gestionale.
  if (role === 'cliente') {
    return (
      <div className="empty">
        🔒 Quest’area è riservata allo staff.
        <br />
        <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => signOut(auth)}>
          Esci e accedi come staff
        </button>
      </div>
    )
  }

  // Lo staff (non bartender) vede la lista da servire e i propri ordini,
  // col drawer laterale (Nuovo ordine, Esci). Il tab segue la query
  // string, così la navigazione dal drawer funziona anche dal menu.
  if (role !== 'bartender') {
    const staffTab = params.get('tab') === 'miei-ordini' ? 'miei-ordini' : 'servizio'
    return (
      <div>
        <StaffDrawer role="staff" active={staffTab} />
        <div className="bar-content">
          {staffTab === 'miei-ordini' ? <StaffMyOrders /> : <ServiceQueue />}
        </div>
      </div>
    )
  }

  return (
    <div>
      <StaffDrawer role="bartender" active={tab} onSelect={setTab} />

      <div className="bar-content">
        {tab === 'coda' && <OrderQueue />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'menu' && <MenuTab />}
        {tab === 'inventario' && <InventoryManager />}
        {tab === 'staff' && <StaffTab />}
        {tab === 'impostazioni' && <SettingsTab />}
        {tab === 'dev' && isDevEnvironment && <DevTools />}
      </div>
    </div>
  )
}

function MenuTab() {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await syncSumUpProducts()
      if (res.skipped) {
        setSyncResult({ ok: false, msg: res.message || 'SumUp non abilitato.' })
      } else {
        setSyncResult({ ok: true, msg: `Sincronizzati ${res.synced} prodotti da SumUp POS Pro.` })
      }
    } catch (e) {
      setSyncResult({ ok: false, msg: `Errore: ${e.message}` })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div>
      {/* Box sync visibile solo con l'integrazione SumUp abilitata. */}
      {isSumUpEnabled && (
      <div className="card" style={{ marginBottom: 8 }}>
        <div className="row between" style={{ alignItems: 'center' }}>
          <div>
            <strong>SumUp POS Pro</strong>
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              Importa il catalogo drink direttamente da SumUp POS Pro.
            </div>
          </div>
          <button
            className="btn small"
            disabled={syncing}
            onClick={handleSync}
            style={{ marginLeft: 12, flexShrink: 0 }}
          >
            {syncing ? 'Sync…' : '↻ Sync catalogo'}
          </button>
        </div>
        {syncResult && (
          <div
            className={syncResult.ok ? '' : 'banner'}
            style={syncResult.ok ? { marginTop: 8, color: 'var(--green, #4caf50)', fontSize: '0.9rem' } : { marginTop: 8 }}
          >
            {syncResult.msg}
          </div>
        )}
      </div>
      )}
      <MenuManager />
    </div>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setErr(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (e) {
      setErr(loginError(e.code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2 style={{ marginTop: 0 }}>Accesso staff</h2>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setErr(null) }}
        placeholder="bartender@example.com"
        required
      />
      <label htmlFor="password" style={{ marginTop: 10 }}>Password</label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => { setPassword(e.target.value); setErr(null) }}
        placeholder="••••••••"
        required
      />
      {err && <div className="banner" style={{ marginTop: 10 }}>{err}</div>}
      <button className="btn block" style={{ marginTop: 14 }} type="submit" disabled={loading}>
        {loading ? 'Accesso…' : 'Entra'}
      </button>
    </form>
  )
}

function loginError(code) {
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Email o password non corretti.'
  }
  if (code === 'auth/too-many-requests') return 'Troppi tentativi. Riprova tra qualche minuto.'
  if (code === 'auth/network-request-failed') return 'Errore di rete. Controlla la connessione.'
  return 'Errore di accesso. Riprova.'
}

const STATUS_TABS = [
  ORDER_STATUSES.RICEVUTO,
  ORDER_STATUSES.IN_PREPARAZIONE,
  ORDER_STATUSES.PRONTO,
  ORDER_STATUSES.RITIRATO,
]

// Minuti (1 decimale) tra due timestamp ISO, o null se mancanti.
function minutesBetween(fromIso, toIso) {
  const t1 = Date.parse(fromIso || '')
  const t2 = Date.parse(toIso || '')
  if (!Number.isFinite(t1) || !Number.isFinite(t2) || t2 < t1) return null
  return Math.round((t2 - t1) / 6000) / 10
}

function OrderQueue() {
  const [serata, setSerata] = useState(undefined) // undefined=caricamento, null=nessuna
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [statusTab, setStatusTab] = useState(ORDER_STATUSES.RICEVUTO)
  const [slowLoad, setSlowLoad] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // { title, message, danger, run }
  const [cancelTarget, setCancelTarget] = useState(null) // { order, kind }
  const [search, setSearch] = useState('')
  const [report, setReport] = useState(null) // resoconto mostrato dopo la chiusura
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const knownIds = useRef(new Set())

  useEffect(() => subscribeSettings((s) => setSettings(s)), [])

  // Se dopo 8s la serata non è arrivata, probabilmente il database non è
  // raggiungibile (l'SDK ritenta in silenzio): mostra un suggerimento.
  useEffect(() => {
    const t = setTimeout(() => setSlowLoad(true), 8000)
    return () => clearTimeout(t)
  }, [])

  // Osserva la serata aperta. In caso di errore esce comunque dal
  // caricamento (serata=null) così l'errore è visibile in pagina.
  useEffect(() => {
    ensureNotificationPermission()
    const unsub = subscribeOpenSerata(
      (s) => setSerata(s),
      (e) => {
        setError(e.message)
        setSerata(null)
      }
    )
    return unsub
  }, [])

  // Osserva gli ordini della serata aperta.
  const serataId = serata?.id
  useEffect(() => {
    if (!serataId) {
      setOrders([])
      knownIds.current = new Set()
      return
    }
    let primed = false
    const unsub = subscribeSerataOrders(
      serataId,
      (data) => {
        // Notifica i nuovi ordini "ricevuti" comparsi dopo il primo caricamento.
        if (primed) {
          for (const o of data) {
            if (!knownIds.current.has(o.id) && o.status === ORDER_STATUSES.RICEVUTO) {
              notify('🆕 Nuovo ordine', `Ordine #${o.daily_number} ricevuto.`)
            }
          }
        }
        knownIds.current = new Set(data.map((o) => o.id))
        setOrders(data)
        primed = true
      },
      (e) => setError(e.message)
    )
    return unsub
  }, [serataId])

  async function apri() {
    setBusy(true)
    setError(null)
    try {
      await openSerata()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  function chiudi() {
    const aperti = openOrdersCount(orders)
    const finance = serataFinance(orders)
    const righe = [
      `Incasso: ${formatPrice(finance.incasso)} (${finance.ordini} ordini)`,
      finance.servizio > 0 ? `Servizio: ${formatPrice(finance.servizio)}` : null,
      finance.mance > 0 ? `Mance: ${formatPrice(finance.mance)}` : null,
    ].filter(Boolean).join('\n')
    const msg = aperti > 0
      ? `Ci sono ancora ${aperti} ordini non conclusi.\n\n${righe}`
      : righe
    setConfirmAction({
      title: '⏹ Chiudere la serata?',
      message: msg,
      confirmLabel: 'Chiudi serata',
      run: async () => {
        setBusy(true)
        setError(null)
        // Resoconto calcolato dagli ordini correnti + statistiche tempi.
        const fullReport = {
          finance,
          products: aggregateProducts(orders),
          longest_prep: longestPrep(orders),
          phase_averages: phaseAverages(serata.prep_stats, serata.eta_stats),
          drinks_sold: aggregateProducts(orders).reduce((s, p) => s + p.qty, 0),
        }
        try {
          await closeSerata(serata.id, fullReport)
          setReport(fullReport)
        } catch (e) {
          setError(e.message)
        } finally {
          setBusy(false)
        }
      },
    })
  }

  async function advance(order) {
    const ns = nextStatus(order.status)
    if (!ns) return
    try {
      await updateOrderStatus(order.id, ns)
    } catch (e) {
      setError(e.message)
    }
  }

  // Annullamento bartender: apre il dialog con frase/motivazione/notifica.
  // kind: 'ordine' (ricevuto), 'preparazione' (in_preparazione),
  // 'non_ritirato' (pronto mai ritirato/servito).
  async function confirmCancel({ phrase, message, notify }) {
    const { order, kind } = cancelTarget
    setCancelTarget(null)
    try {
      await cancelOrder(order.id, { by: 'bartender', kind, phrase, message, notify })
    } catch (e) {
      setError(e.message)
    }
  }

  if (serata === undefined) {
    return (
      <div>
        {error && <div className="banner">Errore: {error}</div>}
        <div className="empty">
          Carico la serata…
          {slowLoad && (
            <p className="muted" style={{ fontSize: '0.85rem', marginTop: 12 }}>
              Ci sta mettendo troppo? Controlla la connessione e che il database
              sia raggiungibile (in sviluppo: emulatori avviati), poi ricarica la
              pagina.
            </p>
          )}
        </div>
      </div>
    )
  }

  // Nessuna serata aperta: invito ad aprire il conto. Subito dopo la
  // chiusura qui appare anche il resoconto della serata appena conclusa.
  if (!serata) {
    return (
      <div>
        {error && <div className="banner">Errore: {error}</div>}
        <div className="empty">Nessuna serata aperta.</div>
        <button className="btn block" onClick={apri} disabled={busy}>
          {busy ? 'Apro…' : '▶️ Apri serata'}
        </button>
        {report && <SerataReport report={report} onClose={() => setReport(null)} />}
      </div>
    )
  }

  const recap = serataRecap(orders)
  // Ricerca rapida: numero, cliente, tavolo, drink, chi ha inserito.
  const q = search.trim().toLowerCase()
  const visibleOrders = q
    ? orders.filter(
        (o) =>
          String(o.daily_number ?? '').includes(q) ||
          o.customer_name?.toLowerCase().includes(q) ||
          o.table_label?.toLowerCase().includes(q) ||
          o.placed_by?.email?.toLowerCase().includes(q) ||
          o.placed_by?.name?.toLowerCase().includes(q) ||
          (o.order_items || []).some((i) => i.name?.toLowerCase().includes(q))
      )
    : orders
  const buckets = bucketByStatus(visibleOrders)
  const listView = settings.queue_view === 'lista'
  const list = buckets[statusTab] || []
  // Vista a lista unica: ordini in corso (per numero) + evasi.
  const inCorso = [
    ...(buckets[ORDER_STATUSES.RICEVUTO] || []),
    ...(buckets[ORDER_STATUSES.IN_PREPARAZIONE] || []),
    ...(buckets[ORDER_STATUSES.PRONTO] || []),
  ].sort((a, b) => (a.daily_number || 0) - (b.daily_number || 0))
  const evasi = buckets[ORDER_STATUSES.RITIRATO] || []

  const renderCard = (o) => {
        const ns = nextStatus(o.status)
        return (
          <div className={`card order-card ${o.status}`} key={o.id}>
            <div className="row between">
              <div>
                <span className="bignum" style={{ fontSize: '2rem' }}>
                  #{o.daily_number ?? '—'}
                </span>{' '}
                {o.customer_name && <strong>{o.customer_name}</strong>}{' '}
                {o.table_label && (
                  <span className="muted">· Tavolo {o.table_label}</span>
                )}
                {o.service_mode === 'banco' && (
                  <span className="pill" style={{ marginLeft: 6 }}>🚶 Ritiro al banco</span>
                )}
                {o.service_mode === 'tavolo' && (
                  <span className="pill" style={{ marginLeft: 6 }}>🍸 Al tavolo</span>
                )}
              </div>
              <span className={`pill ${o.status}`}>
                {STATUS_EMOJI[o.status]}{' '}
                {o.status === ORDER_STATUSES.RITIRATO
                  ? ritiratoLabel(o.service_mode)
                  : STATUS_LABELS[o.status]}
              </span>
            </div>
            <div style={{ margin: '8px 0' }}>
              {(o.order_items || []).map((i) => (
                <div className="row between" key={i.id}>
                  <span>
                    {i.qty}× {i.name}
                  </span>
                  <span className="muted">{formatPrice(i.qty * i.unit_price)}</span>
                </div>
              ))}
            </div>
            {o.placed_by && (
              <p className="muted small" style={{ margin: '0 0 8px' }}>
                ✍️ Ordine manuale inserito da <strong>{placedByName(o.placed_by)}</strong> ({o.placed_by.role})
              </p>
            )}
            {o.note && (
              <div className="order-note">📝 {o.note}</div>
            )}
            {/* Tempi effettivi: preparazione sui "pronti", servizio sui serviti al tavolo. */}
            {o.status === ORDER_STATUSES.PRONTO && (() => {
              const m = minutesBetween(o.status_times?.in_preparazione, o.status_times?.pronto)
              return m != null && (
                <p className="muted small" style={{ margin: '0 0 8px' }}>
                  ⏱ Preparato in {m} min
                </p>
              )
            })()}
            {o.status === ORDER_STATUSES.RITIRATO && o.service_mode === 'tavolo' && (() => {
              const m = minutesBetween(o.status_times?.pronto, o.status_times?.ritirato)
              return m != null && (
                <p className="muted small" style={{ margin: '0 0 8px' }}>
                  ⏱ Servito in {m} min
                </p>
              )
            })()}
            {ns && (
              <button className="btn block" onClick={() => advance(o)}>
                Segna come “{STATUS_LABELS[ns]}”
              </button>
            )}
            {o.status === ORDER_STATUSES.RICEVUTO && (
              <button
                className="btn ghost small block"
                style={{ marginTop: 8 }}
                onClick={() => setCancelTarget({ order: o, kind: 'ordine' })}
              >
                ✖️ Annulla ordine
              </button>
            )}
            {o.status === ORDER_STATUSES.IN_PREPARAZIONE && (
              <button
                className="btn ghost small block"
                style={{ marginTop: 8 }}
                onClick={() => setCancelTarget({ order: o, kind: 'preparazione' })}
              >
                ✖️ Annulla preparazione
              </button>
            )}
            {o.status === ORDER_STATUSES.PRONTO && (
              <button
                className="btn ghost small block"
                style={{ marginTop: 8 }}
                onClick={() => setCancelTarget({ order: o, kind: 'non_ritirato' })}
              >
                🚫 {o.service_mode === 'tavolo' ? 'Non servito' : 'Non ritirato'}
              </button>
            )}
          </div>
        )
  }

  return (
    <div>
      {error && <div className="banner">Errore: {error}</div>}

      <div className="card row between" style={{ alignItems: 'center' }}>
        <div>
          <strong>Serata aperta</strong>
          <div className="muted">
            {recap.count} ordini · {formatPrice(recap.total)}
          </div>
        </div>
        <button className="btn ghost small" onClick={chiudi} disabled={busy}>
          ⏹ Chiudi serata
        </button>
      </div>

      <StaffCallList />

      <input
        type="search"
        className="menu-search"
        placeholder="🔍 Cerca per numero, cliente, tavolo, drink…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginTop: 8 }}
      />

      {listView ? (
        <>
          {/* Lista unica: stato indicato dal colore/etichetta della card */}
          <h3 className="cat-header">In corso ({inCorso.length})</h3>
          {inCorso.length === 0 && <div className="empty">Nessun ordine in corso.</div>}
          {inCorso.map(renderCard)}

          <h3 className="cat-header">Serviti/Ritirati ({evasi.length})</h3>
          {evasi.length === 0 && <div className="empty">Ancora nessun ordine servito o ritirato.</div>}
          {evasi.map(renderCard)}
        </>
      ) : (
        <>
          {/* Sotto-tab per stato */}
          <div className="tabs" style={{ marginTop: 8 }}>
            {STATUS_TABS.map((s) => (
              <div
                key={s}
                className={`tab ${statusTab === s ? 'active' : ''}`}
                onClick={() => setStatusTab(s)}
              >
                {STATUS_EMOJI[s]} {STATUS_LABELS[s]} ({(buckets[s] || []).length})
              </div>
            ))}
          </div>

          {list.length === 0 && <div className="empty">Nessun ordine in questo stato.</div>}
          {list.map(renderCard)}
        </>
      )}

      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel={confirmAction.confirmLabel}
          danger={confirmAction.danger}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            const { run } = confirmAction
            setConfirmAction(null)
            run()
          }}
        />
      )}

      {cancelTarget && (
        <CancelOrderDialog
          order={cancelTarget.order}
          kind={cancelTarget.kind}
          defaultPhrase={settings.cancel_phrase_default}
          onCancel={() => setCancelTarget(null)}
          onConfirm={confirmCancel}
        />
      )}
    </div>
  )
}

// Resoconto di fine serata: incassi, scontrino prodotti e mini dashboard.
function SerataReport({ report, onClose }) {
  const { finance, products, longest_prep, phase_averages, drinks_sold } = report
  const fmtMin = (m) => (m == null ? '—' : `${Math.round(m * 10) / 10} min`)
  const top = products.slice(0, 3)

  return (
    <div className="overlay" onClick={onClose}>
      <div className="summary-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="summary-head">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
          <h2>Resoconto serata</h2>
          <p className="muted" style={{ margin: 0 }}>
            {finance.ordini} ordini · {drinks_sold} drink venduti
          </p>
        </div>

        <h3 className="cat-header">Incassi</h3>
        <div className="summary-rows" style={{ margin: '4px 0 16px' }}>
          <div className="summary-row">
            <span className="muted">Drink</span>
            <span>{formatPrice(finance.drink)}</span>
          </div>
          {finance.coperto > 0 && (
            <div className="summary-row">
              <span className="muted">Coperto</span>
              <span>{formatPrice(finance.coperto)}</span>
            </div>
          )}
          {finance.servizio > 0 && (
            <div className="summary-row">
              <span className="muted">Servizio</span>
              <span>{formatPrice(finance.servizio)}</span>
            </div>
          )}
          {finance.mance > 0 && (
            <div className="summary-row">
              <span className="muted">Mance</span>
              <span>{formatPrice(finance.mance)}</span>
            </div>
          )}
          <div className="summary-row summary-total">
            <span>INCASSO</span>
            <span>{formatPrice(finance.incasso)}</span>
          </div>
        </div>

        {products.length > 0 && (
          <>
            <h3 className="cat-header">Prodotti venduti</h3>
            <div className="summary-rows" style={{ margin: '4px 0 16px' }}>
              {products.map((p) => (
                <div className="summary-row" key={p.name}>
                  <span>
                    {p.qty} × {p.name}
                  </span>
                  <span>{formatPrice(p.revenue)}</span>
                </div>
              ))}
              <div className="summary-row summary-total">
                <span>TOTALE DRINK</span>
                <span>{formatPrice(products.reduce((s, p) => s + p.revenue, 0))}</span>
              </div>
            </div>
          </>
        )}

        <h3 className="cat-header">Statistiche</h3>
        <div className="summary-rows" style={{ margin: '4px 0 16px' }}>
          {top.length > 0 && (
            <div className="summary-row">
              <span className="muted">Più venduti</span>
              <span style={{ textAlign: 'right' }}>
                {top.map((p) => `${p.name} (${p.qty})`).join(' · ')}
              </span>
            </div>
          )}
          {longest_prep && (
            <div className="summary-row">
              <span className="muted">Preparazione più lunga</span>
              <span>
                #{longest_prep.daily_number} · {fmtMin(longest_prep.minutes)}
              </span>
            </div>
          )}
          <div className="summary-row">
            <span className="muted">Attesa media</span>
            <span>{fmtMin(phase_averages?.attesa)}</span>
          </div>
          <div className="summary-row">
            <span className="muted">Preparazione media</span>
            <span>{fmtMin(phase_averages?.preparazione)}</span>
          </div>
          <div className="summary-row">
            <span className="muted">Servizio al tavolo medio</span>
            <span>{fmtMin(phase_averages?.servizio)}</span>
          </div>
          <div className="summary-row">
            <span className="muted">Ciclo completo medio</span>
            <span>{fmtMin(phase_averages?.cicloCompleto)}</span>
          </div>
        </div>

        <button className="btn block" onClick={onClose}>
          Chiudi resoconto
        </button>
      </div>
    </div>
  )
}
