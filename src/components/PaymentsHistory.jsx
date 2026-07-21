import { useEffect, useMemo, useState } from 'react'
import { subscribePayments } from '../lib/api.js'
import { formatPrice } from '../lib/orderStatus.js'

// Storico degli incassi della giornata: importo, metodo, gruppo, ora, e
// per i conti divisi la quota (k/N).
export default function PaymentsHistory() {
  const [payments, setPayments] = useState([])

  useEffect(() => subscribePayments(setPayments, () => {}), [])

  const totals = useMemo(() => {
    const t = { all: 0, banco: 0, lettore: 0, online: 0 }
    for (const p of payments) {
      if (p.status !== 'pagato') continue
      const a = Number(p.amount) || 0
      t.all += a
      t[p.method] = (t[p.method] || 0) + a
    }
    return t
  }, [payments])

  const fmtTime = (iso) => {
    if (!iso) return ''
    try {
      return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }
  const methodLabel = { banco: '💶 Contanti', lettore: '📟 Lettore', online: '💳 Online' }

  return (
    <div>
      <div className="card row between" style={{ alignItems: 'center' }}>
        <div>
          <strong>💳 Incassato</strong>
          <div className="muted small">
            {payments.filter((p) => p.status === 'pagato').length} pagamenti
          </div>
        </div>
        <strong className="price">{formatPrice(totals.all)}</strong>
      </div>

      {(totals.banco > 0 || totals.lettore > 0 || totals.online > 0) && (
        <div className="chips-row" style={{ marginBottom: 8 }}>
          {totals.banco > 0 && <span className="chip">💶 {formatPrice(totals.banco)}</span>}
          {totals.lettore > 0 && <span className="chip">📟 {formatPrice(totals.lettore)}</span>}
          {totals.online > 0 && <span className="chip">💳 {formatPrice(totals.online)}</span>}
        </div>
      )}

      {payments.length === 0 && <div className="empty">Ancora nessun incasso.</div>}

      {payments.map((p) => (
        <div className="card" key={p.id} style={{ padding: 12 }}>
          <div className="row between">
            <div>
              <strong>{formatPrice(p.amount)}</strong>{' '}
              <span className="muted small">{methodLabel[p.method] || p.method}</span>
              {p.split_count ? (
                <span className="muted small"> · quota {p.split_index}/{p.split_count}</span>
              ) : null}
            </div>
            <span className="muted small">{fmtTime(p.created_at)}</span>
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {p.order_ids.length} ordini
            {p.by?.email ? ` · ${p.by.email.split('@')[0]}` : ''}
          </div>
        </div>
      ))}
    </div>
  )
}
