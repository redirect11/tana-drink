import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { subscribeOrdersHistory } from '../lib/api.js'
import { formatPrice, ORDER_STATUSES } from '../lib/orderStatus.js'
import { paidAmount } from '../lib/pagamento.js'

// STORICO ORDINI (nel Flusso cassa): la lista CRONOLOGICA di tutti i conti —
// aperti, chiusi, annullati — col nome se gliene è stato dato uno, altrimenti
// il solo progressivo. Diversa dalla coda, che mostra il lavoro in corso.

const FILTRI = [
  ['tutti', 'Tutti'],
  ['aperti', 'Aperti'],
  ['chiusi', 'Chiusi'],
  ['annullati', 'Annullati'],
]

const statoDi = (o) => {
  if (o.status === ORDER_STATUSES.ANNULLATO || o.workflow_status === ORDER_STATUSES.ANNULLATO)
    return 'annullati'
  if (o.payment_status === 'pagato') return 'chiusi'
  return 'aperti'
}

const quando = (iso) => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function OrdersHistory() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtro, setFiltro] = useState('tutti')
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  // Realtime + LOCAL-FIRST: la lista compare subito (anche offline, dalla
  // cache) e si aggiorna da sola quando cambiano gli ordini.
  useEffect(
    () =>
      subscribeOrdersHistory(
        (list) => {
          setOrders(list)
          setLoading(false)
        },
        (e) => {
          setError(e.message)
          setLoading(false) // altrimenti resta "Carico lo storico…" per sempre
        }
      ),
    []
  )

  const visibili = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return orders.filter((o) => {
      if (filtro !== 'tutti' && statoDi(o) !== filtro) return false
      if (!needle) return true
      return (
        String(o.daily_number ?? '').includes(needle) ||
        (o.customer_name || '').toLowerCase().includes(needle) ||
        (o.table_label || '').toLowerCase().includes(needle)
      )
    })
  }, [orders, filtro, q])

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <strong>🧾 Storico ordini</strong>
      <div className="muted small" style={{ margin: '2px 0 8px' }}>
        Tutti i conti in ordine di tempo, dal più recente.
      </div>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 Cerca numero, nome, tavolo…"
      />
      <div className="chips-row" style={{ margin: '8px 0' }}>
        {FILTRI.map(([id, label]) => (
          <button
            key={id}
            className={`chip ${filtro === id ? 'active' : ''}`}
            onClick={() => setFiltro(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="banner">Errore: {error}</div>}
      {loading && <p className="muted small">Carico lo storico…</p>}
      {!loading && visibili.length === 0 && (
        <p className="muted small">Nessun ordine con questi filtri.</p>
      )}

      <div className="ordhist">
        {visibili.map((o) => {
          const st = statoDi(o)
          const acconto = st === 'aperti' && paidAmount(o) > 0
          return (
            <button
              key={o.id}
              type="button"
              className={`ordhist-row ordhist-${st}`}
              onClick={() => navigate(`/ordine/${o.id}`)}
            >
              <span className="ordhist-num">#{o.daily_number ?? '—'}</span>
              <span className="ordhist-name">
                {o.customer_name || <span className="muted">senza nome</span>}
                {o.table_label && <span className="muted small"> · Tavolo {o.table_label}</span>}
              </span>
              <span className="muted small ordhist-when">{quando(o.created_at)}</span>
              <span className={`pill small ordhist-state ${st === 'chiusi' ? 'pagato' : st === 'annullati' ? 'ritirato' : 'ricevuto'}`}>
                {st === 'chiusi' ? 'pagato' : st === 'annullati' ? 'annullato' : acconto ? 'acconto' : 'aperto'}
              </span>
              <span className="ordhist-tot">{formatPrice(o.total)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
