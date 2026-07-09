import { useEffect, useMemo, useState } from 'react'
import {
  fetchSuppliers,
  fetchSupplierInvoices,
  createSupplierInvoice,
  updateSupplierInvoice,
  deleteSupplierInvoice,
} from '../lib/api.js'
import { invoiceTotals } from '../lib/warehouse.js'
import { formatPrice } from '../lib/orderStatus.js'

// Scadenzario fornitori (come FORNITORI REC dell'Excel): documenti/proforma
// per fornitore con importo, stato pagato e note; totale da pagare a colpo
// d'occhio, complessivo e per fornitore.
export default function SupplierInvoicesPanel() {
  const [suppliers, setSuppliers] = useState([])
  const [invoices, setInvoices] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [onlyUnpaid, setOnlyUnpaid] = useState(false)

  async function load() {
    try {
      const [sups, invs] = await Promise.all([
        fetchSuppliers(),
        fetchSupplierInvoices({ limit: 200 }),
      ])
      setSuppliers(sups)
      setInvoices(invs)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const totals = useMemo(() => invoiceTotals(invoices), [invoices])
  const visible = useMemo(
    () =>
      invoices.filter((i) => {
        if (supplierFilter !== 'all' && i.supplier_id !== supplierFilter) return false
        if (onlyUnpaid && i.paid) return false
        return true
      }),
    [invoices, supplierFilter, onlyUnpaid]
  )

  async function togglePaid(inv) {
    setError(null)
    // Aggiornamento ottimistico.
    setInvoices((prev) => prev.map((i) => (i.id === inv.id ? { ...i, paid: !i.paid } : i)))
    try {
      await updateSupplierInvoice(inv.id, { paid: !inv.paid })
    } catch (e) {
      setError(e.message)
      await load()
    }
  }

  async function remove(inv) {
    if (!confirm(`Eliminare il documento ${inv.number || ''} di ${inv.supplier_name}?`)) return
    try {
      await deleteSupplierInvoice(inv.id)
      setInvoices((prev) => prev.filter((i) => i.id !== inv.id))
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleCreate(data) {
    setBusy(true)
    setError(null)
    try {
      await createSupplierInvoice(data)
      setAdding(false)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {error && <div className="banner">Errore: {error}</div>}

      <div className="inv-summary">
        <span className="chip" style={{ cursor: 'default' }}>
          Da pagare <strong>{formatPrice(totals.unpaid)}</strong>
        </span>
        <button className={`chip ${onlyUnpaid ? 'active' : ''}`} onClick={() => setOnlyUnpaid((v) => !v)}>
          Solo da pagare
        </button>
      </div>

      {totals.bySupplier.length > 0 && (
        <div className="muted small" style={{ margin: '0 4px 8px' }}>
          {totals.bySupplier.map((s) => `${s.supplier_name || '—'}: ${formatPrice(s.unpaid)}`).join(' · ')}
        </div>
      )}

      {suppliers.length > 0 && (
        <div className="chips-row">
          <button className={`chip ${supplierFilter === 'all' ? 'active' : ''}`} onClick={() => setSupplierFilter('all')}>
            Tutti
          </button>
          {suppliers.map((s) => (
            <button
              key={s.id}
              className={`chip ${supplierFilter === s.id ? 'active' : ''}`}
              onClick={() => setSupplierFilter(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {!adding ? (
        <button className="btn block" onClick={() => setAdding(true)}>
          + Nuovo documento
        </button>
      ) : (
        <InvoiceForm suppliers={suppliers} busy={busy} onCancel={() => setAdding(false)} onSave={handleCreate} />
      )}

      <div className="inv-list" style={{ marginTop: 8 }}>
        {visible.map((inv) => (
          <div className="inv-item" key={inv.id}>
            <div className="inv-row" style={{ cursor: 'default' }}>
              <div className="grow">
                <div className="inv-name">
                  {inv.supplier_name || '—'} {inv.number && <span className="muted small">#{inv.number}</span>}
                </div>
                <div className="muted small">
                  {inv.date || '—'} · {inv.doc_type}
                  {inv.notes && ` · ${inv.notes}`}
                </div>
              </div>
              <div className="inv-qty">
                <div>{formatPrice(inv.amount)}</div>
                <button
                  className={inv.paid ? 'chip active' : 'chip'}
                  style={{ marginTop: 4 }}
                  onClick={() => togglePaid(inv)}
                >
                  {inv.paid ? '✅ pagato' : '⏳ da pagare'}
                </button>
              </div>
              <button className="btn ghost small" onClick={() => remove(inv)}>🗑</button>
            </div>
          </div>
        ))}
      </div>

      {visible.length === 0 && <div className="empty">Nessun documento.</div>}
    </div>
  )
}

function InvoiceForm({ suppliers, busy, onCancel, onSave }) {
  const [form, setForm] = useState({
    supplier_id: '',
    number: '',
    doc_type: 'Proforma',
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    paid: false,
    notes: '',
  })
  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  function submit(e) {
    e.preventDefault()
    if (!form.supplier_id || !form.amount) return
    const sup = suppliers.find((s) => s.id === form.supplier_id)
    onSave({
      supplier_id: form.supplier_id,
      supplier_name: sup?.name ?? '',
      number: form.number.trim() || null,
      doc_type: form.doc_type,
      date: form.date,
      amount: Number(String(form.amount).replace(',', '.')) || 0,
      paid: !!form.paid,
      notes: form.notes.trim() || null,
    })
  }

  return (
    <form className="card" onSubmit={submit}>
      <strong>Nuovo documento</strong>

      <label htmlFor="if-sup" style={{ marginTop: 8 }}>Fornitore *</label>
      <select id="if-sup" value={form.supplier_id} onChange={set('supplier_id')} required>
        <option value="">— Scegli —</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>

      <div className="grid-2">
        <div>
          <label htmlFor="if-num">Numero doc.</label>
          <input id="if-num" value={form.number} onChange={set('number')} placeholder="Es. 1556" />
        </div>
        <div>
          <label htmlFor="if-date">Data</label>
          <input id="if-date" type="date" value={form.date} onChange={set('date')} />
        </div>
      </div>

      <div className="grid-2">
        <div>
          <label htmlFor="if-type">Tipo</label>
          <select id="if-type" value={form.doc_type} onChange={set('doc_type')}>
            <option>Proforma</option>
            <option>Fattura</option>
            <option>Reso</option>
            <option>Altro</option>
          </select>
        </div>
        <div>
          <label htmlFor="if-amount">Importo € *</label>
          <input id="if-amount" type="number" step="any" min="0" value={form.amount} onChange={set('amount')} required />
        </div>
      </div>

      <label htmlFor="if-notes">Note</label>
      <input id="if-notes" value={form.notes} onChange={set('notes')} placeholder="Es. -36,6 reso Ceres" />

      <label className="row" style={{ marginTop: 10 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={form.paid} onChange={set('paid')} />
        <span>Già pagato</span>
      </label>

      <div className="grid-2" style={{ marginTop: 12 }}>
        <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>Annulla</button>
        <button type="submit" className="btn" disabled={busy}>Salva</button>
      </div>
    </form>
  )
}
