import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from '../lib/firebaseClient.js'
import {
  updateOrderStatus,
  markOrderPaid,
  cancelOrder,
  subscribeOpenSerata,
  subscribeSerataOrders,
  subscribeSettings,
  DEFAULT_SETTINGS,
  saveStaffToken,
} from '../lib/api.js'
import { getPushToken } from '../lib/push.js'
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  STATUS_EMOJI,
  ritiratoLabel,
  formatPrice,
  nextStatus,
  placedByName,
} from '../lib/orderStatus.js'
import { bucketByStatus, serataRecap } from '../lib/serata.js'
import { isAwaitingPayment } from '../lib/payments.js'
import { readerCheckout, readerTerminate } from '../lib/paymentsApi.js'
import { ensureNotificationPermission, notify } from '../lib/notify.js'
import { showToast } from '../lib/toast.js'
import { beep, installAudioUnlock } from '../lib/beep.js'
import { subscribePending, dismissPending, dismissBanner } from '../lib/pendingOrders.js'
import { syncSumUpProducts, isSumUpEnabled } from '../lib/sumupApi.js'
import { printComanda, printScontrino, loadPrinterSettings } from '../lib/printer.js'
import MenuManager from '../components/MenuManager.jsx'
import PrinterSetup from '../components/PrinterSetup.jsx'
import InventoryManager from '../components/InventoryManager.jsx'
import SettingsTab from '../components/SettingsTab.jsx'
import StatsTab from '../components/StatsTab.jsx'
import StaffTab from '../components/StaffTab.jsx'
import ServiceQueue from '../components/ServiceQueue.jsx'
import StaffMyOrders from '../components/StaffMyOrders.jsx'
import StaffCallList from '../components/StaffCallList.jsx'
import GroupsPanel from '../components/GroupsPanel.jsx'
import PaymentsHistory from '../components/PaymentsHistory.jsx'
import InvoicesTab from '../components/InvoicesTab.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import CancelOrderDialog from '../components/CancelOrderDialog.jsx'
import DevTools from '../components/DevTools.jsx'
import StaffDrawer from '../components/StaffDrawer.jsx'
import { devToolsEnabled } from '../dev/devActions.js'

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
        {tab === 'pagamenti' && <PaymentsHistory />}
        {tab === 'fatture' && <InvoicesTab />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'menu' && <MenuTab />}
        {tab === 'inventario' && <InventoryManager />}
        {tab === 'staff' && <StaffTab />}
        {tab === 'impostazioni' && <SettingsTab />}
        {tab === 'stampante' && <PrinterSetup />}
        {tab === 'dev' && devToolsEnabled && <DevTools />}
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
  ORDER_STATUSES.PAGATO,
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
  const [statusTab, setStatusTab] = useState(ORDER_STATUSES.RICEVUTO)
  const [boardFilter, setBoardFilter] = useState('attivi') // 'attivi' | 'chiusi' | 'tutti'
  // Avanzamenti OTTIMISTICI dalla card: lo stato cambia al tap, il server
  // segue in background (in errore si torna allo stato reale).
  const [queueOverrides, setQueueOverrides] = useState({}) // id -> workflow_status
  const [slowLoad, setSlowLoad] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // { title, message, danger, run }
  const [cancelTarget, setCancelTarget] = useState(null) // { order, kind }
  const [search, setSearch] = useState('')
  const [showPanels, setShowPanels] = useState(false) // pannelli (chiamate/gruppi) nella griglia
  const [openCards, setOpenCards] = useState(() => new Set()) // card-griglia coi tasti aperti
  const [pend, setPend] = useState({ pending: [], banners: [] }) // ordini POS in invio
  const [report, setReport] = useState(null) // resoconto mostrato dopo la chiusura
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const knownIds = useRef(new Set())
  const knownComande = useRef(new Map()) // id ordine -> n. comande (per il toast aggiunte)
  const navigate = useNavigate()

  useEffect(() => subscribeSettings((s) => setSettings(s)), [])
  useEffect(() => subscribePending(setPend), [])

  // Vista a griglia: a tutto schermo. Aggiunge `fullbleed` al body così la
  // pagina esce dal contenitore centrato (.app, max 760px) e riempie larghezza
  // e altezza. Rimosso quando si lascia la griglia o si smonta la coda.
  const gridView = settings.queue_view === 'griglia'
  useEffect(() => {
    if (!gridView) return undefined
    document.body.classList.add('fullbleed')
    return () => document.body.classList.remove('fullbleed')
  }, [gridView])

  // Se dopo 8s la serata non è arrivata, probabilmente il database non è
  // raggiungibile (l'SDK ritenta in silenzio): mostra un suggerimento.
  useEffect(() => {
    const t = setTimeout(() => setSlowLoad(true), 8000)
    return () => clearTimeout(t)
  }, [])

  // Osserva la serata aperta. In caso di errore esce comunque dal
  // caricamento (serata=null) così l'errore è visibile in pagina.
  useEffect(() => {
    installAudioUnlock() // sblocca il bip al primo tocco (richiesto da iOS)
    // Registra il token push del dispositivo del bartender: senza questo la
    // push "nuovo ordine" non arriverebbe a chi sta solo sul gestionale.
    const uid = auth.currentUser?.uid
    ensureNotificationPermission().then(async (ok) => {
      if (!ok || !uid) return
      const token = await getPushToken()
      if (token) saveStaffToken(uid, token).catch(() => {})
    })
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
      knownComande.current = new Map()
      return
    }
    let primed = false
    const awaiting = new Set() // ordini in attesa di pagamento obbligatorio
    const unsub = subscribeSerataOrders(
      serataId,
      (data) => {
        // Notifica i nuovi ordini "ricevuti" comparsi dopo il primo
        // caricamento. Quelli con pagamento obbligatorio vengono
        // notificati solo QUANDO risultano pagati (prima non si preparano).
        if (primed) {
          const printerSettings = loadPrinterSettings()
          for (const o of data) {
            const isNew = !knownIds.current.has(o.id)
            if (o.workflow_status !== ORDER_STATUSES.RICEVUTO) continue
            if (isAwaitingPayment(o)) {
              if (isNew) awaiting.add(o.id)
              continue
            }
            if (isNew || awaiting.has(o.id)) {
              awaiting.delete(o.id)
              beep() // avviso sonoro: su iPad in primo piano il banner è soppresso
              notify('🆕 Nuovo ordine', `Ordine #${o.daily_number} ricevuto.`)
              // Auto-stampa comanda se abilitata nelle impostazioni stampante.
              if (printerSettings.autoPrintComanda) {
                printComanda(o, o.comande?.find((cc) => cc.id === o.active_comanda_id) ?? null).catch((e) => console.warn('[printer] auto-comanda:', e.message))
              }
            }
          }
          // Auto-stampa scontrino quando un ordine diventa "pronto".
          if (printerSettings.autoPrintScontrino) {
            for (const o of data) {
              if (o.workflow_status === ORDER_STATUSES.PRONTO && !knownIds.current.has(o.id + '_pronto')) {
                knownIds.current.add(o.id + '_pronto')
                printScontrino(o).catch((e) => console.warn('[printer] auto-scontrino:', e.message))
              }
            }
          }
          // AGGIUNTE a conti esistenti (da altro dispositivo/staff): toast
          // in app. Le proprie aggiunte non passano di qua: si fanno dal
          // dettaglio ordine, dove questa vista non è montata.
          for (const o of data) {
            const prev = knownComande.current.get(o.id)
            const n = (o.comande || []).length
            if (prev != null && n > prev && o.status === 'aperto') {
              showToast(`➕ Aggiunta all'ordine #${o.daily_number ?? '—'}${o.customer_name ? ` (${o.customer_name})` : ''}`)
            }
          }
        }
        knownIds.current = new Set(data.map((o) => o.id))
        knownComande.current = new Map(data.map((o) => [o.id, (o.comande || []).length]))
        setOrders(data)
        primed = true
      },
      (e) => setError(e.message)
    )
    return unsub
  }, [serataId])

  // Scambio placeholder → ordine reale: appena l'ordine con il
  // client_temp_id del placeholder arriva dalla sottoscrizione, il
  // placeholder si toglie (lo scambio è sul posto: mai due card né buchi).
  useEffect(() => {
    for (const p of pend.pending) {
      if (orders.some((o) => o.client_temp_id === p.tempId)) dismissPending(p.tempId)
    }
  }, [orders, pend.pending])

  // Apertura/chiusura serata NON esistono più come gesti: la serata di
  // oggi nasce col primo ordine e quella di ieri si chiude da sola
  // (rollover in ensureTodaySerata). Il resoconto vive nelle Statistiche.

  function advance(order) {
    const ns = nextStatus(order.workflow_status)
    if (!ns) return
    setQueueOverrides((m) => ({ ...m, [order.id]: ns }))
    ;(async () => {
      try {
        await updateOrderStatus(order.id, ns)
      } catch (e) {
        setError(e.message)
        showToast(`⚠️ Avanzamento non riuscito: ${e.message}`, { kind: 'error' })
      } finally {
        setQueueOverrides((m) => {
          const n = { ...m }
          delete n[order.id]
          return n
        })
      }
    })()
  }

  // Annullamento bartender: apre il dialog con frase/motivazione/notifica.
  // kind: 'ordine' (ricevuto), 'preparazione' (in_preparazione),
  // 'non_ritirato' (pronto mai ritirato/servito).
  function confirmCancel({ phrase, message, notify }) {
    const { order, kind } = cancelTarget
    setCancelTarget(null)
    // In background: il dialog si chiude subito, la card sparisce con lo
    // snapshot; in errore arriva il toast.
    cancelOrder(order.id, { by: 'bartender', kind, phrase, message, notify }).catch((e) => {
      setError(e.message)
      showToast(`⚠️ Annullo non riuscito: ${e.message}`, { kind: 'error' })
    })
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

  // Nessuna serata in corso: NON blocca — la serata di oggi nasce da
  // sola col primo ordine dal POS. Gli ordini appena battuti (in sync,
  // serata inclusa) sono GIÀ qui, senza aspettare il server.
  if (!serata) {
    return (
      <div>
        {error && <div className="banner">Errore: {error}</div>}
        {pend.pending.length > 0 ? (
          <div className="order-grid" style={{ marginTop: 8 }}>
            {pend.pending.map(renderPendingCard)}
          </div>
        ) : (
          <div className="empty">
            Ancora nessun ordine oggi: la serata parte col primo ordine.
          </div>
        )}
        <Link className="btn block" to="/pos" style={{ marginTop: 8 }}>🍸 Nuovo ordine (POS cassa)</Link>
        {report && <SerataReport report={report} onClose={() => setReport(null)} />}
      </div>
    )
  }

  const recap = serataRecap(orders)
  // Ordini "effettivi" a schermo: stato del server + override ottimistici.
  const effOrders = orders.map((o) =>
    queueOverrides[o.id] && o.workflow_status !== queueOverrides[o.id]
      ? { ...o, workflow_status: queueOverrides[o.id] }
      : o
  )
  // Ricerca rapida: numero, cliente, tavolo, drink, chi ha inserito.
  const q = search.trim().toLowerCase()
  const visibleOrders = q
    ? effOrders.filter(
        (o) =>
          String(o.daily_number ?? '').includes(q) ||
          o.customer_name?.toLowerCase().includes(q) ||
          o.table_label?.toLowerCase().includes(q) ||
          o.placed_by?.email?.toLowerCase().includes(q) ||
          o.placed_by?.name?.toLowerCase().includes(q) ||
          (o.order_items || []).some((i) => i.name?.toLowerCase().includes(q))
      )
    : effOrders
  const buckets = bucketByStatus(visibleOrders)
  const listView = settings.queue_view === 'lista'
  const list = buckets[statusTab] || []
  // Vista a lista unica: ordini in corso (per numero) + evasi.
  const inCorso = [
    ...(buckets[ORDER_STATUSES.RICEVUTO] || []),
    ...(buckets[ORDER_STATUSES.IN_PREPARAZIONE] || []),
    ...(buckets[ORDER_STATUSES.PRONTO] || []),
  ].sort((a, b) => (a.daily_number || 0) - (b.daily_number || 0))
  const evasi = [
    ...(buckets[ORDER_STATUSES.RITIRATO] || []),
    ...(buckets[ORDER_STATUSES.PAGATO] || []),
  ]
  // Vista a griglia: di default gli ordini in corso; col filtro si vedono
  // anche i chiusi/pagati o TUTTI gli ordini della serata.
  const isClosed = (o) =>
    o.workflow_status === ORDER_STATUSES.PAGATO || o.workflow_status === ORDER_STATUSES.ANNULLATO
  const boardOrders = visibleOrders
    .filter((o) =>
      boardFilter === 'tutti' ? true : boardFilter === 'chiusi' ? isClosed(o) : !isClosed(o)
    )
    .sort((a, b) => (a.daily_number || 0) - (b.daily_number || 0))
  // Ordini POS in invio. Finché il placeholder è attivo l'ordine reale
  // resta nascosto: il match usa il client_temp_id scritto sull'ordine
  // (deterministico anche se lo snapshot arriva PRIMA che il placeholder
  // conosca il realId — era la causa del doppione per un attimo).
  const pendingRealIds = new Set(pend.pending.filter((p) => p.realId).map((p) => p.realId))
  const pendingTempIds = new Set(pend.pending.map((p) => p.tempId))
  const visibleBoard = boardOrders.filter(
    (o) =>
      !pendingRealIds.has(o.id) &&
      !(o.client_temp_id && pendingTempIds.has(o.client_temp_id))
  )

  async function incassaSuLettore(o) {
    setError(null)
    try {
      const res = await readerCheckout(o.id)
      if (res.unavailable) {
        setError('Lettore non disponibile in ambiente di sviluppo: simula dai DevTools.')
      }
    } catch (e) {
      setError(e.message)
    }
  }

  async function annullaSuLettore(o) {
    setError(null)
    try {
      await readerTerminate(o.id)
    } catch (e) {
      setError(e.message)
    }
  }

  const toggleCard = (id) =>
    setOpenCards((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  // Pulsanti azione di un ordine (avanza stato, incasso, stampe, annullo).
  // Condivisi dalla card piena (liste) e dalla card-griglia (a scomparsa).
  const orderActions = (o) => {
    const ns = nextStatus(o.workflow_status)
    const awaiting = isAwaitingPayment(o) && o.workflow_status === ORDER_STATUSES.RICEVUTO
    const readerReady = settings.payments_reader_enabled && settings.sumup_reader_id
    const readerPending = o.payment_method === 'lettore' && o.payment_status === 'in_attesa'
    const canCollect =
      o.payment_status !== 'pagato' &&
      [ORDER_STATUSES.PRONTO, ORDER_STATUSES.RITIRATO].includes(o.workflow_status)
    return (
      <>
        {ns && o.workflow_status !== ORDER_STATUSES.RITIRATO && !awaiting && (
          <button className="btn block" onClick={() => advance(o)}>
            Segna come “{STATUS_LABELS[ns]}”
          </button>
        )}
        {readerPending ? (
          <div style={{ marginTop: 8 }}>
            <p className="muted small" style={{ margin: '0 0 6px', textAlign: 'center' }}>
              📟 In corso sul lettore… carta del cliente sul Solo.
            </p>
            <button className="btn ghost small block" onClick={() => annullaSuLettore(o)}>
              ✖️ Annulla sul lettore
            </button>
          </div>
        ) : (
          canCollect &&
          readerReady && (
            <button
              className="btn secondary block"
              style={{ marginTop: o.workflow_status === ORDER_STATUSES.PRONTO ? 8 : 0 }}
              onClick={() => incassaSuLettore(o)}
            >
              📟 Incassa sul lettore
            </button>
          )
        )}
        {o.workflow_status === ORDER_STATUSES.RITIRATO && o.payment_status !== 'pagato' && (
          <button
            className="btn block"
            style={{ marginTop: 8 }}
            disabled={readerPending}
            onClick={() => markOrderPaid(o.id, 'banco').catch((e) => setError(e.message))}
          >
            💶 Incassato (contanti)
          </button>
        )}
        <div className="grid-2" style={{ marginTop: 8 }}>
          <button
            className="btn ghost small"
            onClick={() => printComanda(o, o.comande?.find((cc) => cc.id === o.active_comanda_id) ?? null).catch((e) => setError(`Stampa: ${e.message}`))}
          >
            🖨 Comanda
          </button>
          <button
            className="btn ghost small"
            onClick={() => printScontrino(o).catch((e) => setError(`Stampa: ${e.message}`))}
          >
            🧾 Scontrino
          </button>
        </div>
        {o.workflow_status === ORDER_STATUSES.RICEVUTO && (
          <button
            className="btn ghost small block"
            style={{ marginTop: 8 }}
            onClick={() => setCancelTarget({ order: o, kind: 'ordine' })}
          >
            ✖️ Annulla ordine
          </button>
        )}
        {o.workflow_status === ORDER_STATUSES.IN_PREPARAZIONE && (
          <button
            className="btn ghost small block"
            style={{ marginTop: 8 }}
            onClick={() => setCancelTarget({ order: o, kind: 'preparazione' })}
          >
            ✖️ Annulla preparazione
          </button>
        )}
        {o.workflow_status === ORDER_STATUSES.PRONTO && (
          <button
            className="btn ghost small block"
            style={{ marginTop: 8 }}
            onClick={() => setCancelTarget({ order: o, kind: 'non_ritirato' })}
          >
            🚫 {o.service_mode === 'tavolo' ? 'Non servito' : 'Non ritirato'}
          </button>
        )}
      </>
    )
  }

  // Card-griglia compatta: tutte uguali, più larghe che alte. Mostra solo
  // numero, cliente/tavolo, stato, n° prodotti e subtotale. I tasti sono a
  // scomparsa: nascosti di default, compaiono toccando la card.
  const renderGridCard = (o) => {
    const awaiting = isAwaitingPayment(o) && o.workflow_status === ORDER_STATUSES.RICEVUTO
    const count = (o.order_items || []).reduce((s, i) => s + i.qty, 0)
    const open = openCards.has(o.id)
    return (
      <div
        className={`card order-card grid-card ${o.workflow_status}`}
        key={o.id}
        style={awaiting ? { opacity: 0.55 } : undefined}
      >
        {/* Corpo: click → dettaglio ordine */}
        <div
          className="grid-card-main"
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/ordine/${o.id}`)}
        >
          <div className="row between">
            <span className="bignum">#{o.daily_number ?? '—'}</span>
            <span className={`pill ${o.workflow_status}`}>
              {STATUS_EMOJI[o.workflow_status]}{' '}
              {o.workflow_status === ORDER_STATUSES.RITIRATO
                ? ritiratoLabel(o.service_mode)
                : STATUS_LABELS[o.workflow_status]}
            </span>
          </div>
          <div className="grid-card-sub">
            {o.customer_name && <strong>{o.customer_name}</strong>}
            {o.table_label && <span className="muted"> · Tavolo {o.table_label}</span>}
            {o.payment_status === 'pagato' && o.workflow_status !== ORDER_STATUSES.PAGATO && (
              <span className="pill pagato" style={{ marginLeft: 6 }}>💳</span>
            )}
          </div>
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <span className="muted">{count} prodott{count === 1 ? 'o' : 'i'}</span>
            <span className="grid-card-tot">{formatPrice(o.total)}</span>
          </div>
        </div>
        {/* Pulsante separato: apre/chiude i tasti azione (non va al dettaglio) */}
        <button
          type="button"
          className="grid-card-toggle"
          onClick={() => toggleCard(o.id)}
          aria-expanded={open}
        >
          {open ? '▴ Chiudi' : '⋯ Azioni'}
        </button>
        {open && <div className="grid-card-actions">{orderActions(o)}</div>}
      </div>
    )
  }

  // Ordine POS in invio: a schermo è GIÀ un ordine a tutti gli effetti
  // (stessa card, stessi colori, info complete) — la sincronizzazione la
  // racconta il toast, non la card. Solo in errore si distingue.
  // Function declaration (hoisted): è usata anche PRIMA di questo punto,
  // nella schermata senza serata.
  function renderPendingCard(p) {
    const o = p.order
    const count = (o.order_items || []).reduce((s, i) => s + i.qty, 0)
    const isError = p.state === 'error'
    return (
      <div
        className={`card order-card grid-card ${isError ? 'grid-card-pending error' : o.workflow_status}`}
        key={p.tempId}
      >
        <div className="grid-card-main" style={{ cursor: 'default' }}>
          <div className="row between">
            <span className="bignum">#{o.daily_number ?? '…'}</span>
            <span className={`pill ${isError ? '' : o.workflow_status}`}>
              {isError
                ? '⚠️ Errore invio'
                : `${STATUS_EMOJI[o.workflow_status]} ${STATUS_LABELS[o.workflow_status]}`}
            </span>
          </div>
          <div className="grid-card-sub">
            {o.customer_name && <strong>{o.customer_name}</strong>}
            {o.table_label && <span className="muted"> · Tavolo {o.table_label}</span>}
          </div>
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <span className="muted">{count} prodott{count === 1 ? 'o' : 'i'}</span>
            <span className="grid-card-tot">{formatPrice(o.total)}</span>
          </div>
        </div>
        {/* Footer identico alla card reale (stessa altezza prima e dopo
            la sincronizzazione); le azioni arrivano con l'ordine vero. */}
        {!isError && (
          <button type="button" className="grid-card-toggle" disabled>
            ⋯ Azioni
          </button>
        )}
        {isError && (
          <div className="grid-card-actions">
            <p className="muted small" style={{ margin: '0 0 6px' }}>{p.error}</p>
            <button className="btn ghost small block" onClick={() => dismissPending(p.tempId)}>
              Rimuovi
            </button>
          </div>
        )}
      </div>
    )
  }

  const renderCard = (o) => {
        const awaiting = isAwaitingPayment(o) && o.workflow_status === ORDER_STATUSES.RICEVUTO
        return (
          <div
            className={`card order-card ${o.workflow_status}`}
            key={o.id}
            style={awaiting ? { opacity: 0.55 } : undefined}
          >
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
                {/* Stato pagamento */}
                {o.payment_status === 'pagato' && o.workflow_status !== ORDER_STATUSES.PAGATO && (
                  <span className="pill pagato" style={{ marginLeft: 6 }}>
                    💳 Pagato{o.payment_method === 'online' ? ' online' : ''}
                  </span>
                )}
                {awaiting && (
                  <span className="pill ricevuto" style={{ marginLeft: 6 }}>
                    ⏳ In attesa di pagamento
                  </span>
                )}
                {o.payment_status === 'fallito' && (
                  <span className="pill" style={{ marginLeft: 6, background: 'rgba(231,76,60,0.25)', color: '#ffb3a7' }}>
                    ❌ Pagamento fallito
                  </span>
                )}
                {o.payment_after_cancel && (
                  <span className="pill" style={{ marginLeft: 6, background: 'rgba(231,76,60,0.25)', color: '#ffb3a7' }}>
                    ⚠️ Pagato dopo annullo
                  </span>
                )}
              </div>
              <span className={`pill ${o.workflow_status}`}>
                {STATUS_EMOJI[o.workflow_status]}{' '}
                {o.workflow_status === ORDER_STATUSES.RITIRATO
                  ? ritiratoLabel(o.service_mode)
                  : STATUS_LABELS[o.workflow_status]}
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
            {o.workflow_status === ORDER_STATUSES.PRONTO && (() => {
              const m = minutesBetween(o.status_times?.in_preparazione, o.status_times?.pronto)
              return m != null && (
                <p className="muted small" style={{ margin: '0 0 8px' }}>
                  ⏱ Preparato in {m} min
                </p>
              )
            })()}
            {o.workflow_status === ORDER_STATUSES.RITIRATO && o.service_mode === 'tavolo' && (() => {
              const m = minutesBetween(o.status_times?.pronto, o.status_times?.ritirato)
              return m != null && (
                <p className="muted small" style={{ margin: '0 0 8px' }}>
                  ⏱ Servito in {m} min
                </p>
              )
            })()}
            {awaiting && (
              <p className="muted small" style={{ margin: '0 0 8px' }}>
                ⏳ Entra in coda al pagamento: non preparare.
              </p>
            )}
            {orderActions(o)}
          </div>
        )
  }

  return (
    <div className={gridView ? 'queue-board' : undefined}>
      {error && <div className="banner">Errore: {error}</div>}

      {gridView ? (
        // Testata compatta della griglia: info serata, ricerca e, in alto a
        // destra, il «+» per battere un nuovo ordine (apre il POS cassa).
        <div className="board-head">
          <div className="board-title">
            <strong>Serata aperta</strong>
            <span className="muted"> · {recap.count} ordini · {formatPrice(recap.total)}</span>
          </div>
          <input
            type="search"
            className="menu-search board-search"
            placeholder="🔍 Cerca numero, cliente, tavolo, drink…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="board-actions">
            <button
              className={`btn ghost small${showPanels ? ' active' : ''}`}
              onClick={() => setShowPanels((v) => !v)}
              title="Chiamate staff e gruppi"
            >
              {showPanels ? '▴' : '▾'} Pannelli
            </button>
            <Link className="btn board-add" to="/pos" aria-label="Nuovo ordine" title="Nuovo ordine" />
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <strong>Serata</strong>
            <div className="muted">
              {recap.count} ordini · {formatPrice(recap.total)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <Link className="btn" to="/pos" style={{ flex: 1 }}>
              🍸 POS cassa
            </Link>
            <Link className="btn ghost" to="/menu" style={{ flex: 1 }}>
              ✍️ Vista cliente
            </Link>
          </div>
        </>
      )}

      {/* Pannelli chiamate/gruppi: nella griglia compaiono solo col toggle
          «Pannelli»; nelle altre viste restano sempre visibili. */}
      {(!gridView || showPanels) && (
        <>
          <StaffCallList />
          {settings.groups_enabled && settings.groups_in_queue && (
            <GroupsPanel serataId={serata?.id} orders={orders} role="bartender" />
          )}
        </>
      )}

      {!gridView && (
        <input
          type="search"
          className="menu-search"
          placeholder="🔍 Cerca per numero, cliente, tavolo, drink…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginTop: 8 }}
        />
      )}

      {gridView ? (
        <>
          {/* Avvisi (es. comanda non stampata) dagli invii in background */}
          {pend.banners.map((b) => (
            <div className="banner" key={b.id} onClick={() => dismissBanner(b.id)} style={{ cursor: 'pointer' }}>
              🖨 {b.msg} <span className="muted">(tocca per chiudere)</span>
            </div>
          ))}
          {/* Filtro: in corso (default) / chiusi / tutta la serata */}
          <div className="chips-row" style={{ margin: '8px 0 0' }}>
            {[
              ['attivi', 'In corso'],
              ['chiusi', '💶 Chiusi'],
              ['tutti', 'Tutta la serata'],
            ].map(([k, label]) => (
              <button
                key={k}
                className={`chip ${boardFilter === k ? 'active' : ''}`}
                onClick={() => setBoardFilter(k)}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Griglia: ordini in invio (grigi) + ordini secondo il filtro */}
          {pend.pending.length === 0 && visibleBoard.length === 0 && (
            <div className="empty">Nessun ordine{boardFilter === 'chiusi' ? ' chiuso' : boardFilter === 'attivi' ? ' in corso' : ''}.</div>
          )}
          {/* I nuovi ordini vanno IN FONDO (numeri più alti): il placeholder
              in sync sta già lì, così alla conferma non cambia posizione. */}
          <div className="order-grid">
            {visibleBoard.map(renderGridCard)}
            {pend.pending.map(renderPendingCard)}
          </div>
        </>
      ) : listView ? (
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
