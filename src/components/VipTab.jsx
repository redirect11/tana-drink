import { useEffect, useMemo, useState } from 'react'
import { subscribeVouchers, createVoucher, topUpVoucher, deleteVoucher } from '../lib/api.js'
import { formatPrice } from '../lib/orderStatus.js'
import { totalOutstanding } from '../lib/vouchers.js'
import ConfirmDialog from './ConfirmDialog.jsx'

// Sezione VIP: buoni (credito ricaricabile) associati a una persona.
// Si creano, si ricaricano e si spendono al pagamento (metodo Buono).
export default function VipTab() {
  const [vouchers, setVouchers] = useState([])
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)

  // Nuovo buono
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  // Ricarica in corso: id -> importo digitato
  const [topUp, setTopUp] = useState({})

  useEffect(() => subscribeVouchers(setVouchers, (e) => setError(e.message)), [])

  const outstanding = useMemo(() => totalOutstanding(vouchers), [vouchers])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? vouchers.filter((v) => v.holder_name?.toLowerCase().includes(q)) : vouchers
  }, [vouchers, search])

  function crea(e) {
    e.preventDefault()
    if (!name.trim()) return
    createVoucher({ holder_name: name.trim(), amount: Number(String(amount).replace(',', '.')) || 0, note: note.trim() || null })
      .then(() => {
        setName('')
        setAmount('')
        setNote('')
      })
      .catch((err) => setError(err.message))
  }

  function ricarica(v) {
    const val = Number(String(topUp[v.id] || '').replace(',', '.')) || 0
    if (!(val > 0)) return
    topUpVoucher(v.id, val)
      .then(() => setTopUp((t) => ({ ...t, [v.id]: '' })))
      .catch((err) => setError(err.message))
  }

  return (
    <div>
      <h2>🎟 Buoni VIP</h2>
      {error && <div className="banner">Errore: {error}</div>}

      <div className="chip" style={{ width: '100%', justifyContent: 'center', marginBottom: 8, cursor: 'default' }}>
        💳 Credito in circolazione <strong>{formatPrice(outstanding)}</strong>
      </div>

      {/* Nuovo buono */}
      <form className="card" onSubmit={crea}>
        <strong>Nuovo buono</strong>
        <div className="grid-2" style={{ marginTop: 8 }}>
          <div>
            <label htmlFor="vip-name">Intestatario *</label>
            <input id="vip-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" required />
          </div>
          <div>
            <label htmlFor="vip-amount">Credito iniziale (€)</label>
            <input id="vip-amount" type="number" min="0" step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Es. 50" />
          </div>
        </div>
        <label htmlFor="vip-note" style={{ marginTop: 6, display: 'block' }}>Note</label>
        <input id="vip-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. regalo, staff…" />
        <button className="btn block" type="submit" style={{ marginTop: 10 }} disabled={!name.trim()}>
          Crea buono
        </button>
      </form>

      <input
        type="search"
        placeholder="🔍 Cerca intestatario…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', margin: '10px 0' }}
      />

      {filtered.length === 0 && (
        <p className="muted">Nessun buono{search ? ' trovato' : ''}.</p>
      )}

      {filtered.map((v) => (
        <div className="card" key={v.id} style={{ marginTop: 10, padding: 12 }}>
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <strong>{v.holder_name}</strong>
            <strong className="price">{formatPrice(v.balance)}</strong>
          </div>
          {v.note && <div className="muted small">{v.note}</div>}
          <div className="muted small">
            Caricato in tutto: {formatPrice(v.initial || 0)}
            {(v.movements || []).some((m) => m.type === 'uso') &&
              ` · usato: ${formatPrice((v.movements || []).filter((m) => m.type === 'uso').reduce((s, m) => s - m.amount, 0))}`}
          </div>
          <div className="row" style={{ gap: 6, marginTop: 8, alignItems: 'center' }}>
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="Ricarica €"
              value={topUp[v.id] ?? ''}
              onChange={(e) => setTopUp((t) => ({ ...t, [v.id]: e.target.value }))}
              style={{ width: 110 }}
            />
            <button className="btn small" onClick={() => ricarica(v)}>⬆ Ricarica</button>
            <span className="grow" />
            {Number(v.balance) === 0 && (
              <button className="btn ghost small" onClick={() => setConfirmDel(v)}>🗑</button>
            )}
          </div>
        </div>
      ))}

      {confirmDel && (
        <ConfirmDialog
          title="🗑 Eliminare il buono?"
          message={`Il buono di ${confirmDel.holder_name} (saldo ${formatPrice(confirmDel.balance)}) verrà eliminato.`}
          confirmLabel="Elimina"
          danger
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => {
            const v = confirmDel
            setConfirmDel(null)
            deleteVoucher(v.id).catch((err) => setError(err.message))
          }}
        />
      )}
    </div>
  )
}
