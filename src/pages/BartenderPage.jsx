import { useEffect, useRef, useState } from 'react'
import { fetchActiveOrders, updateOrderStatus } from '../lib/api.js'
import { supabase } from '../lib/supabaseClient.js'
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  STATUS_EMOJI,
  formatPrice,
  nextStatus,
} from '../lib/orderStatus.js'
import { ensureNotificationPermission, notify } from '../lib/notify.js'
import MenuManager from '../components/MenuManager.jsx'

export default function BartenderPage() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem('tana_bar_ok') === '1'
  )
  const [tab, setTab] = useState('coda')

  if (!authed) return <PinGate onOk={() => setAuthed(true)} />

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
      </div>
      {tab === 'coda' ? <OrderQueue /> : <MenuManager />}
    </div>
  )
}

function PinGate({ onOk }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)
  const expected = import.meta.env.VITE_BARTENDER_PIN || '2468'

  function submit(e) {
    e.preventDefault()
    if (pin === String(expected)) {
      sessionStorage.setItem('tana_bar_ok', '1')
      onOk()
    } else {
      setErr(true)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2 style={{ marginTop: 0 }}>Accesso bartender</h2>
      <label htmlFor="pin">PIN</label>
      <input
        id="pin"
        type="password"
        inputMode="numeric"
        value={pin}
        onChange={(e) => {
          setPin(e.target.value)
          setErr(false)
        }}
        placeholder="••••"
      />
      {err && <div className="banner">PIN non corretto.</div>}
      <button className="btn block" style={{ marginTop: 12 }} type="submit">
        Entra
      </button>
    </form>
  )
}

function OrderQueue() {
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const knownIds = useRef(new Set())

  useEffect(() => {
    let active = true
    ensureNotificationPermission()

    async function load() {
      try {
        const data = await fetchActiveOrders()
        if (!active) return
        knownIds.current = new Set(data.map((o) => o.id))
        setOrders(data)
      } catch (e) {
        if (active) setError(e.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()

    // Realtime: nuovi ordini e cambi di stato ricaricano la coda.
    const channel = supabase
      .channel('bar-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (
            payload.eventType === 'INSERT' &&
            !knownIds.current.has(payload.new.id)
          ) {
            notify('🆕 Nuovo ordine', `Ordine #${payload.new.daily_number} ricevuto.`)
          }
          load()
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
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
          </div>
        )
      })}
    </div>
  )
}
