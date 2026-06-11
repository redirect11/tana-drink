import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { auth } from '../lib/firebaseClient.js'
import { subscribeOpenSerata, subscribeSerataOrders } from '../lib/api.js'
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  STATUS_EMOJI,
  ritiratoLabel,
  formatPrice,
} from '../lib/orderStatus.js'

// Ordini manuali inseriti da QUESTO membro dello staff nella serata
// aperta: per ritrovarli, vederne lo stato e riaprire il QR da mostrare
// al cliente.
export default function StaffMyOrders() {
  const [serata, setSerata] = useState(undefined)
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    return subscribeOpenSerata(
      (s) => setSerata(s),
      () => setSerata(null)
    )
  }, [])

  const serataId = serata?.id
  useEffect(() => {
    if (!serataId) {
      setOrders([])
      return
    }
    return subscribeSerataOrders(serataId, setOrders, (e) => setError(e.message))
  }, [serataId])

  const myEmail = auth.currentUser?.email
  const miei = orders
    .filter((o) => o.placed_by?.email === myEmail)
    .sort((a, b) => (b.daily_number || 0) - (a.daily_number || 0))

  return (
    <div>
      <div className="card">
        <strong>🧾 I miei ordini</strong>
        <div className="muted">
          {serata === undefined
            ? 'Carico…'
            : serata
              ? `${miei.length} inseriti da te in questa serata`
              : 'Nessuna serata aperta'}
        </div>
        <Link className="btn block" style={{ marginTop: 12 }} to="/">
          ✍️ Nuovo ordine dal menù
        </Link>
      </div>

      {error && <div className="banner">Errore: {error}</div>}

      {serata && miei.length === 0 && (
        <div className="empty">
          Non hai ancora inserito ordini in questa serata.
        </div>
      )}

      {miei.map((o) => (
        <Link
          key={o.id}
          to={`/ordine/${o.id}`}
          className={`card order-card ${o.status}`}
          style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
        >
          <div className="row between">
            <div>
              <span className="bignum" style={{ fontSize: '1.6rem' }}>
                #{o.daily_number ?? '—'}
              </span>{' '}
              {o.customer_name && <strong>{o.customer_name}</strong>}{' '}
              {o.table_label && <span className="muted">· Tavolo {o.table_label}</span>}
            </div>
            <span className="price">{formatPrice(o.total)}</span>
          </div>
          <div style={{ margin: '6px 0' }}>
            {(o.order_items || []).map((i) => (
              <div className="row between" key={i.id}>
                <span className="muted small">{i.qty}× {i.name}</span>
              </div>
            ))}
          </div>
          <span className={`pill ${o.status}`}>
            {STATUS_EMOJI[o.status]}{' '}
            {o.status === ORDER_STATUSES.RITIRATO
              ? ritiratoLabel(o.service_mode)
              : STATUS_LABELS[o.status]}
          </span>
        </Link>
      ))}
    </div>
  )
}
