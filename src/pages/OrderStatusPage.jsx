import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchOrder, subscribeOrder, updateOrderItems, cancelOrder } from '../lib/api.js'
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
  const [edits, setEdits] = useState(null) // copia editabile degli item (prima della preparazione)
  const [saving, setSaving] = useState(false)
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

  // Inizializza la copia editabile quando l'ordine è caricato.
  useEffect(() => {
    if (order && edits === null) {
      setEdits(order.order_items.map((i) => ({ ...i })))
    }
  }, [order, edits])

  async function enableNotifications() {
    const ok = await ensureNotificationPermission()
    setNotifOn(ok)
    if (ok) notify('Notifiche attive', 'Ti avviseremo quando il drink è pronto.')
  }

  function changeQty(idx, delta) {
    setEdits((es) =>
      es
        .map((it, i) => (i === idx ? { ...it, qty: it.qty + delta } : it))
        .filter((it) => it.qty > 0)
    )
  }

  async function saveEdits() {
    if (!edits || edits.length === 0) return cancelMyOrder()
    setSaving(true)
    setError(null)
    try {
      await updateOrderItems(order.id, edits)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function cancelMyOrder() {
    if (!confirm('Vuoi annullare il tuo ordine?')) return
    setSaving(true)
    setError(null)
    try {
      await cancelOrder(order.id)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (error) return <div className="banner">Errore: {error}</div>
  if (!order) return <div className="empty">Carico l’ordine…</div>

  const currentIdx = STATUS_FLOW.indexOf(order.status)
  const editable = order.status === ORDER_STATUSES.RICEVUTO
  const editItems = edits || order.order_items
  const editTotal = editItems.reduce((s, i) => s + i.qty * i.unit_price, 0)

  if (order.status === ORDER_STATUSES.ANNULLATO) {
    return (
      <div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="bignum">#{order.daily_number ?? '—'}</div>
          <div className="banner" style={{ marginTop: 12 }}>✖️ Ordine annullato</div>
        </div>
        <Link className="btn ghost block" to="/">
          ← Torna al menù
        </Link>
      </div>
    )
  }

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
        {editable && (
          <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
            Puoi modificare o annullare l’ordine finché non viene preso in preparazione.
          </p>
        )}
        {editable
          ? editItems.map((i, idx) => (
              <div className="row between" key={i.id} style={{ alignItems: 'center' }}>
                <span>{i.name}</span>
                <span className="qty">
                  <button aria-label="Riduci" onClick={() => changeQty(idx, -1)}>−</button>
                  <strong>{i.qty}</strong>
                  <button aria-label="Aumenta" onClick={() => changeQty(idx, 1)}>+</button>
                </span>
              </div>
            ))
          : (order.order_items || []).map((i) => (
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
          <strong className="price">{formatPrice(editable ? editTotal : order.total)}</strong>
        </div>
      </div>

      {editable && (
        <div className="grid-2" style={{ marginTop: 8 }}>
          <button className="btn ghost" onClick={cancelMyOrder} disabled={saving}>
            ✖️ Annulla ordine
          </button>
          <button className="btn" onClick={saveEdits} disabled={saving}>
            {saving ? 'Salvo…' : 'Salva modifiche'}
          </button>
        </div>
      )}

      <Link className="btn ghost block" to="/">
        ← Torna al menù
      </Link>
    </div>
  )
}
