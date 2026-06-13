import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchOrdersByIds, fetchOrdersByCustomer } from '../lib/api.js'
import { getMyOrderIds } from '../lib/cart.js'
import { useCustomer } from '../lib/customerAuth.js'
import {
  STATUS_LABELS,
  STATUS_EMOJI,
  formatPrice,
} from '../lib/orderStatus.js'

export default function MyOrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { user, loading: authLoading } = useCustomer()

  useEffect(() => {
    if (authLoading) return
    const ids = getMyOrderIds()
    if (ids.length === 0 && !user) {
      setLoading(false)
      return
    }
    // Con account: unione tra gli ordini del profilo (tutti i dispositivi)
    // e quelli salvati su questo dispositivo.
    Promise.all([
      ids.length ? fetchOrdersByIds(ids) : Promise.resolve([]),
      user ? fetchOrdersByCustomer(user.uid).catch(() => []) : Promise.resolve([]),
    ])
      .then(([byId, byAccount]) => {
        const seen = new Set()
        const merged = [...byAccount, ...byId].filter((o) => {
          if (seen.has(o.id)) return false
          seen.add(o.id)
          return true
        })
        merged.sort((a, b) =>
          String(b.created_at || '').localeCompare(String(a.created_at || ''))
        )
        setOrders(merged)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [authLoading, user])

  if (loading) return <div className="empty">Carico i tuoi ordini…</div>
  if (error) return <div className="banner">Errore: {error}</div>

  if (orders.length === 0)
    return (
      <div className="empty">
        Non hai ancora effettuato ordini da questo dispositivo.
        <br />
        <Link className="btn block" to="/menu" style={{ marginTop: 16 }}>
          Vai al menù
        </Link>
      </div>
    )

  return (
    <div>
      <h2 style={{ margin: '8px 4px' }}>I miei ordini</h2>
      <Link className="btn ghost block" to="/menu">
        ← Torna al menù
      </Link>
      {orders.map((o) => (
        <Link
          key={o.id}
          to={`/ordine/${o.id}`}
          className="card row between"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div>
            <div>
              <strong>#{o.daily_number ?? '—'}</strong>{' '}
              <span className="muted">
                · {(o.order_items || []).reduce((s, i) => s + i.qty, 0)} drink
              </span>
            </div>
            <span className={`pill ${o.status}`}>
              {STATUS_EMOJI[o.status]} {STATUS_LABELS[o.status]}
            </span>
          </div>
          <span className="price">{formatPrice(o.total)}</span>
        </Link>
      ))}
    </div>
  )
}
