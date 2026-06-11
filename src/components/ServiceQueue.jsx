import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebaseClient.js'
import {
  subscribeOpenSerata,
  subscribeSerataOrders,
  updateOrderStatus,
} from '../lib/api.js'
import { ORDER_STATUSES, formatPrice } from '../lib/orderStatus.js'

// Vista cameriera: SOLO gli ordini pronti da servire ai tavoli, con il
// tasto per segnarli come serviti. Nessun'altra funzione del gestionale.
export default function ServiceQueue() {
  const [serata, setSerata] = useState(undefined)
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

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

  async function servito(o) {
    setBusyId(o.id)
    setError(null)
    try {
      await updateOrderStatus(o.id, ORDER_STATUSES.RITIRATO)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  // Da servire: pronti, al tavolo (il ritiro al banco lo gestisce il bancone).
  const daServire = orders
    .filter((o) => o.status === ORDER_STATUSES.PRONTO && o.service_mode !== 'banco')
    .sort((a, b) => (a.daily_number || 0) - (b.daily_number || 0))

  return (
    <div>
      <div className="card row between" style={{ alignItems: 'center' }}>
        <div>
          <strong>🫱 Servizio ai tavoli</strong>
          <div className="muted">
            {serata === undefined
              ? 'Carico…'
              : serata
                ? `${daServire.length} da servire`
                : 'Nessuna serata aperta'}
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <Link className="btn small" to="/">
            ✍️ Nuovo ordine
          </Link>
          <button className="btn ghost small" onClick={() => signOut(auth)}>
            Esci
          </button>
        </div>
      </div>

      {error && <div className="banner">Errore: {error}</div>}

      {serata && daServire.length === 0 && (
        <div className="empty">Nessun drink pronto da servire. 🎉</div>
      )}

      {daServire.map((o) => (
        <div className="card order-card pronto" key={o.id}>
          <div className="row between">
            <div>
              <span className="bignum" style={{ fontSize: '2rem' }}>
                #{o.daily_number ?? '—'}
              </span>{' '}
              {o.table_label && <span className="muted">· Tavolo {o.table_label}</span>}
            </div>
            <span className="price">{formatPrice(o.total)}</span>
          </div>
          <div style={{ margin: '8px 0' }}>
            {(o.order_items || []).map((i) => (
              <div className="row between" key={i.id}>
                <span>{i.qty}× {i.name}</span>
              </div>
            ))}
          </div>
          {o.placed_by && (
            <p className="muted small" style={{ margin: '0 0 8px' }}>
              ✍️ Inserito da {o.placed_by.email}
            </p>
          )}
          {o.note && <div className="order-note">📝 {o.note}</div>}
          <button
            className="btn block"
            disabled={busyId === o.id}
            onClick={() => servito(o)}
          >
            {busyId === o.id ? 'Segno…' : '✓ Servito'}
          </button>
        </div>
      ))}
    </div>
  )
}
