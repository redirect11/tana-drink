import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchOrder, subscribeOrder } from '../lib/api.js'
import {
  ORDER_STATUSES,
  STATUS_FLOW,
  STATUS_LABELS,
  STATUS_EMOJI,
  formatPrice,
} from '../lib/orderStatus.js'
import { ensureNotificationPermission, notify } from '../lib/notify.js'

export default function OrderStatusPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [notifOn, setNotifOn] = useState(false)
  const prevStatus = useRef(null)

  useEffect(() => {
    let active = true
    fetchOrder(id)
      .then((o) => {
        if (!active) return
        setOrder(o)
        prevStatus.current = o.status
      })
      .catch((e) => active && setError(e.message))

    // Realtime: ascolta gli aggiornamenti di QUESTO ordine.
    const unsubscribe = subscribeOrder(
      id,
      (updated) => {
        if (!active || !updated) return
        setOrder((prev) => ({ ...prev, ...updated }))
        if (
          prevStatus.current !== updated.status &&
          updated.status === ORDER_STATUSES.PRONTO
        ) {
          notify(
            '🔔 Il tuo drink è pronto!',
            `Ordine #${updated.daily_number} pronto al ritiro.`
          )
        }
        prevStatus.current = updated.status
      },
      (e) => active && setError(e.message)
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [id])

  async function enableNotifications() {
    const ok = await ensureNotificationPermission()
    setNotifOn(ok)
    if (ok) notify('Notifiche attive', 'Ti avviseremo quando il drink è pronto.')
  }

  if (error) return <div className="banner">Errore: {error}</div>
  if (!order) return <div className="empty">Carico l’ordine…</div>

  const currentIdx = STATUS_FLOW.indexOf(order.status)

  return (
    <div>
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="muted">Il tuo numero</div>
        <div className="bignum">#{order.daily_number ?? '—'}</div>
        <div style={{ marginTop: 8 }}>
          <span className={`pill ${order.status}`}>
            {STATUS_EMOJI[order.status]} {STATUS_LABELS[order.status]}
          </span>
        </div>
      </div>

      <div className="steps">
        {STATUS_FLOW.filter((s) => s !== ORDER_STATUSES.RITIRATO).map((s) => {
          const idx = STATUS_FLOW.indexOf(s)
          const cls =
            idx < currentIdx ? 'done' : idx === currentIdx ? 'active' : ''
          return (
            <div className={`step ${cls}`} key={s}>
              {STATUS_EMOJI[s]}
              <br />
              {STATUS_LABELS[s]}
            </div>
          )
        })}
      </div>

      {'Notification' in window && !notifOn && (
        <button className="btn secondary block" onClick={enableNotifications}>
          🔔 Avvisami quando è pronto
        </button>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Riepilogo</h3>
        {order.table_label && (
          <p className="muted" style={{ marginTop: 0 }}>
            Tavolo {order.table_label}
          </p>
        )}
        {(order.order_items || []).map((i) => (
          <div className="row between" key={i.id}>
            <span>
              {i.qty}× {i.name}
            </span>
            <span className="price">{formatPrice(i.qty * i.unit_price)}</span>
          </div>
        ))}
        <hr style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        <div className="row between">
          <strong>Totale</strong>
          <strong className="price">{formatPrice(order.total)}</strong>
        </div>
      </div>

      <Link className="btn ghost block" to="/">
        ← Torna al menù
      </Link>
    </div>
  )
}
