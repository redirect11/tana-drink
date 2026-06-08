import { useEffect, useRef, useState } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from '../lib/firebaseClient.js'
import { updateOrderStatus, subscribeActiveOrders, cancelOrder } from '../lib/api.js'
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  STATUS_EMOJI,
  formatPrice,
  nextStatus,
} from '../lib/orderStatus.js'
import { ensureNotificationPermission, notify } from '../lib/notify.js'
import { syncSumUpProducts } from '../lib/sumupApi.js'
import MenuManager from '../components/MenuManager.jsx'
import InventoryManager from '../components/InventoryManager.jsx'

export default function BartenderPage() {
  const [user, setUser] = useState(undefined) // undefined = caricamento, null = non loggato
  const [tab, setTab] = useState('coda')

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u ?? null))
  }, [])

  if (user === undefined) return <div className="empty">Verifica accesso…</div>
  if (!user) return <LoginForm />

  return (
    <div>
      <div className="tabs">
        <div
          className={`tab ${tab === 'coda' ? 'active' : ''}`}
          onClick={() => setTab('coda')}
        >
          🧾 Coda ordini
        </div>
        <div
          className={`tab ${tab === 'menu' ? 'active' : ''}`}
          onClick={() => setTab('menu')}
        >
          🍸 Menù
        </div>
        <div
          className={`tab ${tab === 'inventario' ? 'active' : ''}`}
          onClick={() => setTab('inventario')}
        >
          📦 Inventario
        </div>
        <button
          className="btn ghost small"
          style={{ marginLeft: 'auto', alignSelf: 'center', marginRight: 8 }}
          onClick={() => signOut(auth)}
        >
          Esci
        </button>
      </div>
      {tab === 'coda' && <OrderQueue />}
      {tab === 'menu' && <MenuTab />}
      {tab === 'inventario' && <InventoryManager />}
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
      <h2 style={{ marginTop: 0 }}>Accesso bartender</h2>
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

function OrderQueue() {
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const knownIds = useRef(new Set())

  useEffect(() => {
    let active = true
    let primed = false
    ensureNotificationPermission()

    // Realtime: la coda si aggiorna ad ogni nuovo ordine o cambio di stato.
    const unsubscribe = subscribeActiveOrders(
      (data) => {
        if (!active) return
        // Notifica solo i nuovi ordini comparsi dopo il primo caricamento.
        if (primed) {
          for (const o of data) {
            if (!knownIds.current.has(o.id)) {
              notify('🆕 Nuovo ordine', `Ordine #${o.daily_number} ricevuto.`)
            }
          }
        }
        knownIds.current = new Set(data.map((o) => o.id))
        setOrders(data)
        setLoading(false)
        primed = true
      },
      (e) => {
        if (active) {
          setError(e.message)
          setLoading(false)
        }
      }
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  async function advance(order) {
    const ns = nextStatus(order.status)
    if (!ns) return
    // Aggiornamento ottimistico.
    setOrders((prev) =>
      prev
        .map((o) => (o.id === order.id ? { ...o, status: ns } : o))
        .filter((o) => o.status !== ORDER_STATUSES.RITIRATO)
    )
    try {
      await updateOrderStatus(order.id, ns)
    } catch (e) {
      setError(e.message)
    }
  }

  async function cancel(order) {
    if (!confirm(`Annullare l'ordine #${order.daily_number}? Le scorte usate verranno ripristinate.`)) return
    // Aggiornamento ottimistico: rimuovi dalla coda.
    setOrders((prev) => prev.filter((o) => o.id !== order.id))
    try {
      await cancelOrder(order.id)
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) return <div className="empty">Carico la coda…</div>
  if (error) return <div className="banner">Errore: {error}</div>
  if (orders.length === 0)
    return <div className="empty">Nessun ordine in coda. 🎉</div>

  return (
    <div>
      {orders.map((o) => {
        const ns = nextStatus(o.status)
        return (
          <div className="card" key={o.id}>
            <div className="row between">
              <div>
                <span className="bignum" style={{ fontSize: '2rem' }}>
                  #{o.daily_number ?? '—'}
                </span>{' '}
                {o.table_label && (
                  <span className="muted">· Tavolo {o.table_label}</span>
                )}
              </div>
              <span className={`pill ${o.status}`}>
                {STATUS_EMOJI[o.status]} {STATUS_LABELS[o.status]}
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
            {ns && (
              <button className="btn block" onClick={() => advance(o)}>
                Segna come “{STATUS_LABELS[ns]}”
              </button>
            )}
            <button
              className="btn ghost small block"
              style={{ marginTop: 8 }}
              onClick={() => cancel(o)}
            >
              ✖️ Annulla ordine
            </button>
          </div>
        )
      })}
    </div>
  )
}
