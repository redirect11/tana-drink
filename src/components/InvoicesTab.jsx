import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { subscribeInvoices, markInvoiceSent } from '../lib/api.js'
import { formatPrice } from '../lib/orderStatus.js'
import { printFattura, loadPrinterSettings } from '../lib/printer.js'

// ── Gestore FATTURE di cortesia (gestionale, solo bartender) ───────────
// Elenco delle fatture emesse dalla schermata Pagamento: numero
// progressivo per anno, cliente, totale; da qui si reinviano via email
// e si ristampano.

export default function InvoicesTab() {
  const [invoices, setInvoices] = useState([])
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => subscribeInvoices(setInvoices, (e) => setError(e.message)), [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return invoices
    return invoices.filter(
      (f) =>
        f.number?.toLowerCase().includes(q) ||
        f.customer?.denominazione?.toLowerCase().includes(q) ||
        f.customer?.piva?.toLowerCase().includes(q) ||
        f.customer?.email?.toLowerCase().includes(q)
    )
  }, [invoices, search])

  function mailto(f) {
    const s = loadPrinterSettings()
    const righe = (f.items || [])
      .map((i) => `${i.qty}x ${i.name} — ${formatPrice(i.qty * i.unit_price)}`)
      .join('\n')
    const c = f.customer || {}
    const body = [
      `Fattura di cortesia n. ${f.number}`,
      `${s.businessName || ''}`,
      '',
      `Intestata a: ${c.denominazione || ''}`,
      c.piva ? `P.IVA: ${c.piva}` : null,
      c.cf ? `CF: ${c.cf}` : null,
      c.indirizzo ? `Indirizzo: ${c.indirizzo}` : null,
      '',
      righe,
      f.discount_amount > 0 ? `Sconto: −${formatPrice(f.discount_amount)}` : null,
      `Totale: ${formatPrice(f.total)}`,
      '',
      'Documento non fiscale — copia di cortesia.',
    ]
      .filter((r) => r !== null)
      .join('\n')
    return `mailto:${encodeURIComponent(c.email || '')}?subject=${encodeURIComponent(
      `Fattura di cortesia n. ${f.number}`
    )}&body=${encodeURIComponent(body)}`
  }

  function invia(f) {
    window.location.href = mailto(f)
    markInvoiceSent(f.id, f.customer?.email || null).catch(() => {})
  }

  return (
    <div>
      <h2>📄 Fatture</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Fatture di cortesia emesse dalla schermata Pagamento. Non è
        fatturazione elettronica: per lo SDI passa i dati al commercialista.
      </p>
      {error && <div className="banner">Errore: {error}</div>}

      <input
        type="search"
        placeholder="🔍 Cerca per numero, cliente, P.IVA, email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: 10 }}
      />

      {filtered.length === 0 && (
        <p className="muted">Nessuna fattura{search ? ' trovata' : ' emessa'}.</p>
      )}

      {filtered.map((f) => (
        <div className="card" key={f.id} style={{ marginTop: 10, padding: 12 }}>
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <strong>Fattura n. {f.number}</strong>
            <strong className="price">{formatPrice(f.total)}</strong>
          </div>
          <div className="muted small" style={{ marginTop: 2 }}>
            {String(f.created_at || '').slice(0, 10)} · {f.customer?.denominazione}
            {f.customer?.piva ? ` · P.IVA ${f.customer.piva}` : ''}
            {f.order_id ? (
              <>
                {' · '}
                <Link to={`/ordine/${f.order_id}`}>ordine #{f.order_daily_number ?? '—'}</Link>
              </>
            ) : null}
          </div>
          {f.sent_at && (
            <div className="muted small">
              📧 Inviata{f.sent_to ? ` a ${f.sent_to}` : ''} il {String(f.sent_at).slice(0, 10)}
            </div>
          )}
          <div className="grid-2" style={{ marginTop: 8, gap: 6 }}>
            <button className="btn ghost small" onClick={() => invia(f)}>
              📧 Invia via email
            </button>
            <button
              className="btn ghost small"
              onClick={() => printFattura(f).catch((e) => setError(`Stampa: ${e.message}`))}
            >
              🖨 Stampa
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
