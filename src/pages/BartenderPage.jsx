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
  subscribeActiveOrders,
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
  placedByLetter,
} from '../lib/orderStatus.js'
import { bucketByStatus, ordersRecap } from '../lib/coda.js'
import { allServed } from '../lib/comande.js'
import { paidAmount } from '../lib/pagamento.js'
import { businessDayKey, businessDayLabel, businessDayShort } from '../lib/businessDay.js'
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
import StaffPage from '../components/StaffPage.jsx'
import VipTab from '../components/VipTab.jsx'
import ServiceQueue from '../components/ServiceQueue.jsx'
import StaffMyOrders from '../components/StaffMyOrders.jsx'
import StaffCallList from '../components/StaffCallList.jsx'
import GroupsPanel from '../components/GroupsPanel.jsx'
import GroupView from '../components/GroupView.jsx'
import CashFlow from '../components/CashFlow.jsx'
import InvoicesTab from '../components/InvoicesTab.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import CancelOrderDialog from '../components/CancelOrderDialog.jsx'
import DevTools from '../components/DevTools.jsx'
import StaffDrawer from '../components/StaffDrawer.jsx'
import { devToolsEnabled } from '../dev/devActions.js'

// Badge accanto al numero d'ordine: la LETTERA del dipendente che l'ha aperto,
// oppure il segno del CLIENTE se l'ha aperto lui dall'app.
function OrderBy({ order }) {
  const L = placedByLetter(order?.placed_by)
  return L ? (
    <span className="order-by staff" title={`Aperto da ${placedByName(order.placed_by)}`}>{L}</span>
  ) : (
    <span className="order-by client" title="Aperto dal cliente (app)">🌐</span>
  )
}

export default function BartenderPage() {
  const navigate = useNavigate()
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

  // Inventario: vista tabellare a TUTTA LARGHEZZA col menu laterale a scomparsa
  // (riusa la modalità fullbleed della griglia). Solo per il bartender.
  const wideTab = role === 'bartender' && tab === 'inventario'
  useEffect(() => {
    if (!wideTab) return undefined
    document.body.classList.add('fullbleed', 'inv-wide')
    return () => document.body.classList.remove('fullbleed', 'inv-wide')
  }, [wideTab])

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

      {/* Toccando un gruppo (menu laterale) si ENTRA nella sua vista: la
          lista dei suoi ordini col conto. La coda resta com'è — lì ci
          vanno solo gli ordini, i pannelli restano dietro il loro tasto. */}
      {params.get('group') && (
        <GroupView groupId={params.get('group')} onClose={() => navigate('/bar')} />
      )}

      <div className={`bar-content${wideTab ? ' bar-content-wide' : ''}`}>
        {tab === 'coda' && <OrderQueue />}
        {tab === 'pagamenti' && <CashFlow canManageStaff={role === 'bartender'} />}
        {tab === 'fatture' && <InvoicesTab />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'menu' && <MenuTab />}
        {tab === 'inventario' && <InventoryManager />}
        {(tab === 'staff' || tab === 'ore') && <StaffPage />}
        {tab === 'vip' && <VipTab />}
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
  const [ordersReady, setOrdersReady] = useState(false) // primo snapshot arrivato
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)
  const [statusTab, setStatusTab] = useState(ORDER_STATUSES.RICEVUTO)
  const [boardFilter, setBoardFilter] = useState('attivi') // 'attivi' | 'chiusi' | 'tutti'
  const [soloOggi, setSoloOggi] = useState(false) // nasconde i conti dei giorni scorsi
  const [nascondiPagati, setNascondiPagati] = useState(false) // pagati non ancora serviti

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

  // Se dopo 8s gli ordini non sono arrivati, probabilmente il database non è
  // raggiungibile (l'SDK ritenta in silenzio): mostra un suggerimento.
  useEffect(() => {
    const t = setTimeout(() => setSlowLoad(true), 8000)
    return () => clearTimeout(t)
  }, [])

  // Registrazione push del dispositivo (indipendente dagli ordini).
  useEffect(() => {
    installAudioUnlock() // sblocca il bip al primo tocco (richiesto da iOS)
    // Registra il token push del dispositivo del bartender: senza questo la
    // push "nuovo ordine" non arriverebbe a chi sta solo sul gestionale.
    const uid = auth.currentUser?.uid
    ensureNotificationPermission().then(async (ok) => {
      if (!ok || !uid) return
      const token = await getPushToken()
      if (token) saveStaffToken(uid, token, 'bartender').catch(() => {})
    })
  }, [])

  // Osserva la CODA: conti aperti (sempre, per sempre) + chiusi di oggi.
  const cutoffHour = settings.business_day_cutoff_hour
  // Gestione preparazione: se spenta spariscono stati e avanzamenti.
  const workflowOn = settings.workflow_enabled !== false
  useEffect(() => {
    let primed = false
    const awaiting = new Set() // ordini in attesa di pagamento obbligatorio
    const unsub = subscribeActiveOrders(
      (data) => {
        // Notifica i nuovi ordini "ricevuti" comparsi dopo il primo
        // caricamento. Quelli con pagamento obbligatorio vengono
        // notificati solo QUANDO risultano pagati (prima non si preparano).
        if (primed) {
          const printerSettings = loadPrinterSettings()
          for (const o of data) {
            const isNew = !knownIds.current.has(o.id)
            if (o.workflow_status !== ORDER_STATUSES.RICEVUTO) continue
            // Niente notifica per gli ordini inseriti dal bartender stesso:
            // avvisano solo quelli di clienti o staff.
            if (o.placed_by?.role === 'bartender') continue
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
        setOrdersReady(true)
        primed = true
      },
      (e) => {
        setError(e.message)
        setOrdersReady(true) // errore visibile in pagina, niente spinner infinito
      },
      { cutoffHour }
    )
    return unsub
  }, [cutoffHour])

  // Scambio placeholder → ordine reale: appena l'ordine con il
  // client_temp_id del placeholder arriva dalla sottoscrizione, il
  // placeholder si toglie (lo scambio è sul posto: mai due card né buchi).
  useEffect(() => {
    for (const p of pend.pending) {
      if (orders.some((o) => o.client_temp_id === p.tempId)) dismissPending(p.tempId)
    }
  }, [orders, pend.pending])

  // Nessuna apertura/chiusura di serata: il servizio è perpetuo. I conti
  // restano aperti finché non li si chiude a mano; la giornata commerciale
  // serve solo a raggruppare (statistiche e progressivo #N).

  function advance(order) {
    const ns = nextStatus(order.workflow_status)
    if (!ns) return
    setQueueOverrides((m) => ({ ...m, [order.id]: ns }))
    ;(async () => {
      try {
        await updateOrderStatus(order.id, ns)
        // NIENTE rimozione qui: la scrittura risponde PRIMA che arrivi lo
        // snapshot aggiornato, quindi togliere subito l'override farebbe
        // riapparire per un attimo lo stato vecchio (il tasto "rimbalza").
        // Lo toglie l'effetto sotto, quando il server ha davvero recepito.
      } catch (e) {
        setError(e.message)
        showToast(`⚠️ Avanzamento non riuscito: ${e.message}`, { kind: 'error' })
        setQueueOverrides((m) => {
          const n = { ...m }
          delete n[order.id]
          return n
        })
      }
    })()
  }

  // L'override ottimistico vive finché il server non è allineato: appena
  // l'ordine arriva con lo stato atteso (o più avanti), si toglie.
  useEffect(() => {
    setQueueOverrides((m) => {
      if (Object.keys(m).length === 0) return m
      const next = { ...m }
      let changed = false
      for (const o of orders) {
        if (next[o.id] && o.workflow_status === next[o.id]) {
          delete next[o.id]
          changed = true
        }
      }
      return changed ? next : m
    })
  }, [orders])

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

  // Attesa del primo snapshot: si mostra SOLO se non c'è già qualcosa da
  // vedere. Un ordine appena battuto è un segnaposto locale, quindi deve
  // comparire subito — la sincronizzazione col server viene dopo, non
  // prima (era il caso del primo ordine della giornata: il contatore del
  // giorno non è ancora in cache e la scrittura passa dal server).
  if (!ordersReady && pend.pending.length === 0) {
    return (
      <div>
        {error && <div className="banner">Errore: {error}</div>}
        <div className="empty">
          Carico gli ordini…
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

  // Ordini "effettivi" a schermo: stato del server + override ottimistici.
  const effOrders = orders.map((o) =>
    queueOverrides[o.id] && o.workflow_status !== queueOverrides[o.id]
      ? { ...o, workflow_status: queueOverrides[o.id] }
      : o
  )
  // ── DA CHIUDERE: conti rimasti aperti dalle giornate precedenti ──
  // Restano fuori dalla schermata principale (altrimenti si mescolano agli
  // ordini di oggi e i numeri del giorno sembrano duplicati): stanno nella
  // loro tab dedicata, con la data ben visibile sulla card.
  const oggiKey = businessDayKey(new Date(), cutoffHour)
  const dayOf = (o) => o.order_date || businessDayKey(o.created_at, cutoffHour)
  // Un conto è CHIUSO — e quindi esce dalla coda — solo quando non c'è più
  // nulla da fare. Con la preparazione attiva servono DUE cose: pagato E
  // servito. Un ordine pagato in anticipo ma non ancora consegnato è
  // lavoro ancora da fare, e sparire sarebbe il modo migliore per
  // dimenticarselo. Senza la preparazione, invece, il pagamento chiude.
  const pagato = (o) =>
    o.payment_status === 'pagato' || o.workflow_status === ORDER_STATUSES.PAGATO
  const servito = (o) => allServed(o) || o.workflow_status === ORDER_STATUSES.RITIRATO
  const isChiuso = (o) =>
    o.workflow_status === ORDER_STATUSES.ANNULLATO ||
    (workflowOn ? pagato(o) && servito(o) : pagato(o))
  // Pagati ma non ancora serviti: restano in coda, si possono nascondere.
  const pagatiDaServire = effOrders.filter((o) => workflowOn && pagato(o) && !servito(o))
  const arretrati = effOrders
    .filter((o) => !isChiuso(o) && dayOf(o) && dayOf(o) !== oggiKey)
    .sort((a, b) => String(dayOf(a)).localeCompare(String(dayOf(b))))
  const arretratiIds = new Set(arretrati.map((o) => o.id))
  // Etichetta della giornata dell'ordine: "oggi", "ieri" o la data estesa.
  const dayLabel = (o) => businessDayShort(dayOf(o), new Date(), cutoffHour)
  // Raggruppa una lista per giornata: prima oggi, poi i giorni scorsi dal
  // più recente. Serve a separare con una riga i conti ancora da chiudere.
  const groupByDay = (list) => {
    const map = new Map()
    for (const o of list) {
      const k = dayOf(o) || '—'
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(o)
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] === oggiKey ? -1 : b[0] === oggiKey ? 1 : b[0].localeCompare(a[0])))
      .map(([day, orders]) => ({ day, orders }))
  }
  const ordersOggi = effOrders.filter((o) => !arretratiIds.has(o.id))
  const ordersInVista = soloOggi ? ordersOggi : effOrders
  // Riepilogo di testata: solo la giornata corrente (gli arretrati stanno
  // nella loro tab e non devono gonfiare i totali di oggi).
  const recap = ordersRecap(ordersOggi, isChiuso)

  // Leggenda "chi ha aperto l'ordine": lettera → nome per lo staff che ha
  // battuto ordini oggi, più l'eventuale voce Cliente (ordini dall'app).
  // Calcolo semplice (non hook: qui siamo dopo eventuali early-return).
  const legenda = (() => {
    const staff = new Map()
    let hasClient = false
    for (const o of ordersOggi) {
      const L = placedByLetter(o.placed_by)
      if (L) { if (!staff.has(L)) staff.set(L, placedByName(o.placed_by)) }
      else hasClient = true
    }
    return { staff: [...staff.entries()].sort((a, b) => a[0].localeCompare(b[0])), hasClient }
  })()

  // Ricerca rapida: numero, cliente, tavolo, drink, chi ha inserito.
  const q = search.trim().toLowerCase()
  // Cercando esplicitamente si trovano anche i conti dei giorni scorsi
  // (altrimenti sarebbero raggiungibili solo dalla tab "Da chiudere").
  const visibleOrders = q
    ? ordersInVista.filter(
        (o) =>
          String(o.daily_number ?? '').includes(q) ||
          o.customer_name?.toLowerCase().includes(q) ||
          o.table_label?.toLowerCase().includes(q) ||
          o.placed_by?.email?.toLowerCase().includes(q) ||
          o.placed_by?.name?.toLowerCase().includes(q) ||
          (o.order_items || []).some((i) => i.name?.toLowerCase().includes(q))
      )
    : ordersInVista
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
  // anche i chiusi/pagati o TUTTI gli ordini in vista.
  const isClosed = isChiuso
  const nascosti = new Set(nascondiPagati ? pagatiDaServire.map((o) => o.id) : [])
  const boardOrders = visibleOrders
    .filter((o) => !nascosti.has(o.id))
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
  const boardGroups = groupByDay(visibleBoard)

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
    // Senza gestione della preparazione l'ordine resta "ricevuto": legare
    // l'incasso agli stati lo renderebbe impossibile.
    const canCollect =
      o.payment_status !== 'pagato' &&
      (!workflowOn || [ORDER_STATUSES.PRONTO, ORDER_STATUSES.RITIRATO].includes(o.workflow_status))
    return (
      <>
        {workflowOn && ns && o.workflow_status !== ORDER_STATUSES.RITIRATO && !awaiting && (
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
        {canCollect && (
          <button
            className="btn block"
            style={{ marginTop: 8 }}
            disabled={readerPending}
            onClick={() => markOrderPaid(o.id, 'banco', { autoServe: !workflowOn }).catch((e) => setError(e.message))}
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
        className={`card order-card grid-card ${o.workflow_status}${
          workflowOn && pagato(o) && !servito(o) ? ' pagato-da-servire' : ''
        }`}
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
            <span className="bignum">#{o.daily_number ?? '—'} <OrderBy order={o} /></span>
            {/* Il badge di preparazione compare solo se si tracciano gli stati:
                a gestione preparazione spenta l'ordine è solo ricevuto→pagato. */}
            {workflowOn && (
              <span className={`pill ${o.workflow_status}`}>
                {STATUS_EMOJI[o.workflow_status]}{' '}
                {o.workflow_status === ORDER_STATUSES.RITIRATO
                  ? ritiratoLabel(o.service_mode)
                  : STATUS_LABELS[o.workflow_status]}
              </span>
            )}
          </div>
          <div className="grid-card-sub row between" style={{ gap: 6 }}>
            <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {o.customer_name && <strong>{o.customer_name}</strong>}
              {o.table_label && <span className="muted"> · Tavolo {o.table_label}</span>}
            </span>
            {/* Pagamento allineato a DESTRA, fra il badge di stato (sopra) e
                il prezzo (sotto). Il gruppo, se c'è, gli sta accanto. */}
            <span className="row" style={{ gap: 4, flexShrink: 0 }}>
              {o.group_name_snapshot && (
                <span className="pill small">👥 {o.group_name_snapshot}</span>
              )}
              {o.payment_status === 'pagato' && o.workflow_status !== ORDER_STATUSES.PAGATO && (
                <span className="pill pagato small">💳 Pagato</span>
              )}
              {o.payment_status === 'parziale' && (
                <span className="pill ricevuto small" title={`Incassati ${formatPrice(paidAmount(o))}`}>
                  💳 Acconto
                </span>
              )}
            </span>
          </div>
          <div className="row between" style={{ alignItems: 'baseline', marginTop: 'auto' }}>
            <span className="grid-card-meta">
              {count} prodott{count === 1 ? 'o' : 'i'} · {dayLabel(o)}
            </span>
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
            <span className="bignum">#{o.daily_number ?? '…'} <OrderBy order={o} /></span>
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
            className={`card order-card ${o.workflow_status}${
              workflowOn && pagato(o) && !servito(o) ? ' pagato-da-servire' : ''
            }`}
            key={o.id}
            style={awaiting ? { opacity: 0.55 } : undefined}
          >
            <div className="row between">
              <div>
                <span className="bignum" style={{ fontSize: '1.4rem', fontWeight: 600 }}>
                  #{o.daily_number ?? '—'} <OrderBy order={o} />
                </span>{' '}
                {o.customer_name && <strong>{o.customer_name}</strong>}{' '}
                {o.table_label && (
                  <span className="muted">· Tavolo {o.table_label}</span>
                )}{' '}
                {o.group_name_snapshot && (
                  <span className="pill small">👥 {o.group_name_snapshot}</span>
                )}{' '}
                <span className="muted small">📅 {dayLabel(o)}</span>
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
                {o.payment_status === 'parziale' && (
                  <span className="pill ricevuto" style={{ marginLeft: 6 }}>
                    💳 Parziale · incassati {formatPrice(paidAmount(o))}
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
              {workflowOn && (
                <span className={`pill ${o.workflow_status}`}>
                  {STATUS_EMOJI[o.workflow_status]}{' '}
                  {o.workflow_status === ORDER_STATUSES.RITIRATO
                    ? ritiratoLabel(o.service_mode)
                    : STATUS_LABELS[o.workflow_status]}
                </span>
              )}
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
        // Testata compatta della griglia: info giornata, ricerca e, in alto a
        // destra, il «+» per battere un nuovo ordine (apre il POS cassa).
        <div className="board-head">
          <div className="board-title">
            <strong>In servizio</strong>
            <span className="muted"> · {recap.aperti} apert{recap.aperti === 1 ? 'o' : 'i'} · {recap.chiusi} chius{recap.chiusi === 1 ? 'o' : 'i'} · {formatPrice(recap.total)}</span>
            {(legenda.staff.length > 0 || legenda.hasClient) && (
              <div className="order-legend">
                {legenda.staff.map(([L, name]) => (
                  <span key={L}><span className="order-by staff">{L}</span> {name}</span>
                ))}
                {legenda.hasClient && (
                  <span><span className="order-by client">🌐</span> Cliente</span>
                )}
              </div>
            )}
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
            <strong>Oggi</strong>
            <div className="muted">
              {recap.aperti} apert{recap.aperti === 1 ? 'o' : 'i'} · {recap.chiusi} chius{recap.chiusi === 1 ? 'o' : 'i'} · {formatPrice(recap.total)}
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
            <GroupsPanel orders={orders} role="bartender" />
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
          {/* Filtro: in corso (default) / chiusi / tutti / da chiudere */}
          <div className="chips-row" style={{ margin: '8px 0 0' }}>
            {[
              ['attivi', 'In corso'],
              ['chiusi', '💶 Chiusi'],
              ['tutti', 'Tutti'],
            ].map(([k, label]) => (
              <button
                key={k}
                className={`chip ${boardFilter === k ? 'active' : ''}`}
                onClick={() => setBoardFilter(k)}
              >
                {label}
              </button>
            ))}
            {/* Conti dei giorni scorsi: di default sono in coda, sotto la
                loro data. Questo tasto li nasconde e lascia solo oggi. */}
            {(pagatiDaServire.length > 0 || nascondiPagati) && (
              <button
                className={`chip ${nascondiPagati ? 'active' : ''}`}
                onClick={() => setNascondiPagati((v) => !v)}
                title="Nascondi i conti già pagati ma non ancora serviti"
              >
                💶 Nascondi pagati{pagatiDaServire.length ? ` (${pagatiDaServire.length})` : ''}
              </button>
            )}
            {(arretrati.length > 0 || soloOggi) && (
              <button
                className={`chip ${soloOggi ? 'active' : ''}`}
                onClick={() => setSoloOggi((v) => !v)}
                title="Nascondi i conti rimasti aperti dai giorni scorsi"
              >
                📅 Solo oggi{arretrati.length ? ` (${arretrati.length} da chiudere)` : ''}
              </button>
            )}
          </div>
          {/* Griglia: ordini in invio (grigi) + ordini secondo il filtro */}
          {pend.pending.length === 0 && visibleBoard.length === 0 && (
            <div className="empty">
              {`Nessun ordine${boardFilter === 'chiusi' ? ' chiuso' : boardFilter === 'attivi' ? ' in corso' : ''}${soloOggi ? ' oggi' : ''}.`}
            </div>
          )}
          {/* I nuovi ordini vanno IN FONDO (numeri più alti): il placeholder
              in sync sta già lì, così alla conferma non cambia posizione. */}
          {/* Una griglia per giornata: oggi in cima, poi i conti ancora
              aperti dei giorni scorsi, ciascuno sotto la sua data. */}
          {!boardGroups.some((g) => g.day === oggiKey) && pend.pending.length > 0 && (
            <div className="order-grid">{pend.pending.map(renderPendingCard)}</div>
          )}
          {boardGroups.map(({ day, orders: gOrders }) => (
            <div key={day}>
              {day !== oggiKey && (
                <div className="day-sep">
                  ⏳ Da chiudere · {businessDayLabel(day, new Date(), cutoffHour)}
                </div>
              )}
              <div className="order-grid">
                {gOrders.map(renderGridCard)}
                {day === oggiKey && pend.pending.map(renderPendingCard)}
              </div>
            </div>
          ))}
        </>
      ) : listView ? (
        <>
          {/* Lista unica: stato indicato dal colore/etichetta della card */}
          <h3 className="cat-header">In corso ({inCorso.length})</h3>
          {inCorso.length === 0 && <div className="empty">Nessun ordine in corso.</div>}
          {groupByDay(inCorso).map(({ day, orders: gOrders }) => (
            <div key={day}>
              {day !== oggiKey && (
                <div className="day-sep">
                  ⏳ Da chiudere · {businessDayLabel(day, new Date(), cutoffHour)}
                </div>
              )}
              {gOrders.map(renderCard)}
            </div>
          ))}

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
