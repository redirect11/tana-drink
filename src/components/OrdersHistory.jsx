import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { subscribeOrdersHistory } from '../lib/api.js'
import { formatPrice, ORDER_STATUSES, PAYMENT_METHOD_LABELS } from '../lib/orderStatus.js'
import { paidAmount, orderTotal } from '../lib/pagamento.js'
import { printScontrino } from '../lib/printer.js'
import { toastSuccess, toastError } from '../lib/toast.js'

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

// Come è stato pagato: se ci sono più metodi si elencano tutti (conti divisi).
const metodoDi = (o) => {
  const metodi = [...new Set((o.payments || []).map((p) => p.method).filter(Boolean))]
  if (metodi.length === 0 && o.payment_method) metodi.push(o.payment_method)
  if (metodi.length === 0) return null
  return metodi.map((m) => PAYMENT_METHOD_LABELS[m] || m).join(' + ')
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
              <span className="muted small ordhist-when">
                {quando(o.created_at)}
                {/* Come è stato incassato: serve per i conti di fine serata. */}
                {st === 'chiusi' && metodoDi(o) && (
                  <span className="ordhist-pay"> · {metodoDi(o)}</span>
                )}
              </span>
              <span className={`pill small ordhist-state ${st === 'chiusi' ? 'pagato' : st === 'annullati' ? 'ritirato' : 'ricevuto'}`}>
                {st === 'chiusi' ? 'pagato' : st === 'annullati' ? 'annullato' : acconto ? 'acconto' : 'aperto'}
              </span>
              {/* Ristampa dello scontrino (anche di conti vecchi): riporta
                  articoli, sconto, totale reale e come è stato incassato. */}
              <span
                role="button"
                tabIndex={0}
                className="ordhist-print"
                title="Ristampa scontrino"
                onClick={(e) => {
                  e.stopPropagation()
                  printScontrino(o)
                    .then(() => toastSuccess(`Scontrino #${o.daily_number ?? ''} ristampato`))
                    .catch((err) => toastError(`Stampa: ${err.message}`))
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.click()
                }}
              >
                🖨
              </span>
              <span className="ordhist-tot">
                {formatPrice(orderTotal(o))}
                {(o.discount_amount || 0) > 0 && (
                  <span className="sconto-badge"> 🎁 −{formatPrice(o.discount_amount)}</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
