import { useEffect, useState } from 'react'
import {
  fetchInventoryItems,
  createInventoryItem,
  deleteInventoryItem,
  loadStock,
  adjustStock,
  fetchStockMovements,
} from '../lib/api.js'
import { BASE_UNITS, formatQty, stockStatus } from '../lib/inventory.js'

const STATUS_LABEL = { ok: '', low: 'in esaurimento', empty: 'esaurito' }

export default function InventoryManager() {
  const [items, setItems] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [its, movs] = await Promise.all([
        fetchInventoryItems(),
        fetchStockMovements({ limit: 30 }).catch(() => []),
      ])
      setItems(its)
      setMovements(movs)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(item) {
    setError(null)
    try {
      await createInventoryItem(item)
      setAdding(false)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function carico(item) {
    const hasPkg = Number(item.package_size) > 0
    const msg = hasPkg
      ? `Quante confezioni carichi? (1 confezione = ${item.package_size} ${item.unit})`
      : `Quanto carichi? (${item.unit})`
    const v = prompt(msg)
    if (v == null) return
    const n = Number(v.replace(',', '.'))
    if (!n || n <= 0) return
    const qty = hasPkg ? n * Number(item.package_size) : n
    try {
      await loadStock(item.id, qty)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function rettifica(item) {
    const v = prompt(`Giacenza reale di "${item.name}" (${item.unit}):`, String(item.stock))
    if (v == null) return
    const n = Number(v.replace(',', '.'))
    if (Number.isNaN(n)) return
    try {
      await adjustStock(item.id, n)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function remove(item) {
    if (!confirm(`Eliminare "${item.name}" dall'inventario?`)) return
    try {
      await deleteInventoryItem(item.id)
      setItems((prev) => prev.filter((x) => x.id !== item.id))
    } catch (e) {
      setError(e.message)
    }
  }

  if (adding) {
    return <ItemForm onCancel={() => setAdding(false)} onSave={handleCreate} />
  }

  return (
    <div>
      <button className="btn block" onClick={() => setAdding(true)}>
        + Aggiungi prodotto
      </button>

      {error && <div className="banner">Errore: {error}</div>}
      {loading && <div className="empty">Carico l’inventario…</div>}

      {items.map((it) => {
        const st = stockStatus(it)
        return (
          <div className="card" key={it.id}>
            <div className="row between">
              <div className="grow">
                <strong>{it.name}</strong>{' '}
                {st !== 'ok' && (
                  <span className={st === 'empty' ? 'badge-empty' : 'badge-low'}>
                    {STATUS_LABEL[st]}
                  </span>
                )}
                <div className="muted">
                  Giacenza: {formatQty(it.stock, it.unit)}
                  {Number(it.low_threshold) > 0 &&
                    ` · soglia ${formatQty(it.low_threshold, it.unit)}`}
                </div>
              </div>
            </div>
            <div className="grid-2" style={{ marginTop: 8 }}>
              <button className="btn small" onClick={() => carico(it)}>
                ⬆ Carico
              </button>
              <button className="btn secondary small" onClick={() => rettifica(it)}>
                Rettifica
              </button>
            </div>
            <button
              className="btn ghost small block"
              style={{ marginTop: 8 }}
              onClick={() => remove(it)}
            >
              🗑 Elimina
            </button>
          </div>
        )
      })}

      {!loading && items.length === 0 && (
        <div className="empty">Nessun prodotto in inventario. Aggiungine uno!</div>
      )}

      {movements.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>Ultimi movimenti</strong>
          {movements.map((m) => (
            <div className="row between" key={m.id} style={{ marginTop: 6 }}>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                {m.type === 'load' ? '⬆' : '⬇'} {m.item_name} · {m.reason}
              </span>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                {m.type === 'load' ? '+' : '−'}
                {formatQty(m.qty, m.unit)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ItemForm({ onCancel, onSave }) {
  const [form, setForm] = useState({
    name: '',
    unit: 'ml',
    stock: '',
    package_size: '',
    low_threshold: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: form.name.trim(),
        unit: form.unit,
        stock: Number(form.stock) || 0,
        package_size: form.package_size ? Number(form.package_size) : null,
        low_threshold: Number(form.low_threshold) || 0,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3 style={{ marginTop: 0 }}>Nuovo prodotto</h3>

      <label htmlFor="iname">Nome *</label>
      <input id="iname" value={form.name} onChange={set('name')} placeholder="Es. Rum Zacapa" required />

      <label htmlFor="iunit">Unità di misura</label>
      <select id="iunit" value={form.unit} onChange={set('unit')}>
        {BASE_UNITS.map((u) => (
          <option key={u} value={u}>{u === 'ml' ? 'ml (volume)' : u === 'g' ? 'g (peso)' : 'pz (pezzi)'}</option>
        ))}
      </select>

      <label htmlFor="istock">Giacenza iniziale ({form.unit})</label>
      <input id="istock" type="number" step="any" min="0" value={form.stock} onChange={set('stock')} />

      <label htmlFor="ipkg">Confezione ({form.unit} per confezione) — opzionale</label>
      <input id="ipkg" type="number" step="any" min="0" value={form.package_size} onChange={set('package_size')} placeholder="Es. 1000 per una bottiglia da 1 L" />

      <label htmlFor="ithr">Soglia di avviso ({form.unit})</label>
      <input id="ithr" type="number" step="any" min="0" value={form.low_threshold} onChange={set('low_threshold')} placeholder="Es. 500" />

      <div className="grid-2" style={{ marginTop: 16 }}>
        <button type="button" className="btn ghost" onClick={onCancel} disabled={saving}>
          Annulla
        </button>
        <button type="submit" className="btn" disabled={saving}>
          {saving ? 'Salvataggio…' : 'Salva'}
        </button>
      </div>
    </form>
  )
}
