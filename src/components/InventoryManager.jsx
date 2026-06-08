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

// Per prodotti con confezione (bottiglie), descrive lo stock come
// "N conf. + resto". Per i pezzi resta semplice.
function bottlesInfo(item) {
  const size = Number(item.package_size)
  if (item.unit === 'pz' || !size) return null
  const full = Math.floor(item.stock / size)
  const rem = Math.round(item.stock - full * size)
  return { full, rem }
}

export default function InventoryManager() {
  const [items, setItems] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)
  const [caricoFor, setCaricoFor] = useState(null) // id dell'item in carico

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

  async function doCarico(item, qty) {
    setError(null)
    try {
      await loadStock(item.id, qty)
      setCaricoFor(null)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  // Imposta il contenuto effettivo della scorta (es. bottiglia aperta/smezzata).
  async function rettifica(item) {
    const v = prompt(`Contenuto effettivo di "${item.name}" (${item.unit}):`, String(item.stock))
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
        const bi = bottlesInfo(it)
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
                  {bi && ` · ${bi.full} conf.${bi.rem > 0 ? ` + ${formatQty(bi.rem, it.unit)}` : ''}`}
                </div>
                {Number(it.package_size) > 0 && (
                  <div className="muted" style={{ fontSize: '0.8rem' }}>
                    1 conf. = {formatQty(it.package_size, it.unit)}
                    {Number(it.low_threshold) > 0 && ` · soglia ${formatQty(it.low_threshold, it.unit)}`}
                  </div>
                )}
              </div>
            </div>

            {caricoFor === it.id ? (
              <CaricoForm
                item={it}
                onCancel={() => setCaricoFor(null)}
                onConfirm={(qty) => doCarico(it, qty)}
              />
            ) : (
              <>
                <div className="grid-2" style={{ marginTop: 8 }}>
                  <button className="btn small" onClick={() => setCaricoFor(it.id)}>
                    ⬆ Carico
                  </button>
                  <button className="btn secondary small" onClick={() => rettifica(it)}>
                    Contenuto reale
                  </button>
                </div>
                <button
                  className="btn ghost small block"
                  style={{ marginTop: 8 }}
                  onClick={() => remove(it)}
                >
                  🗑 Elimina
                </button>
              </>
            )}
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

// Form di carico: quante bottiglie/confezioni + eventuale bottiglia aperta.
function CaricoForm({ item, onCancel, onConfirm }) {
  const [count, setCount] = useState('')
  const [open, setOpen] = useState('') // contenuto bottiglia aperta (smezzata)
  const isPz = item.unit === 'pz'
  const size = Number(item.package_size) || 0

  function confirm() {
    const n = Number(String(count).replace(',', '.')) || 0
    if (isPz) {
      if (n <= 0) return
      onConfirm(n)
      return
    }
    const openQty = Number(String(open).replace(',', '.')) || 0
    const qty = n * size + openQty
    if (qty <= 0) return
    onConfirm(qty)
  }

  return (
    <div style={{ marginTop: 8 }}>
      {isPz ? (
        <>
          <label>Quanti pezzi aggiungi?</label>
          <input type="number" step="1" min="0" value={count} onChange={(e) => setCount(e.target.value)} autoFocus />
        </>
      ) : (
        <>
          <label>Quante confezioni piene? (1 conf. = {formatQty(size, item.unit)})</label>
          <input type="number" step="1" min="0" value={count} onChange={(e) => setCount(e.target.value)} autoFocus />
          <label style={{ marginTop: 8 }}>
            Bottiglia aperta — contenuto effettivo ({item.unit}) — opzionale
          </label>
          <input
            type="number"
            step="any"
            min="0"
            value={open}
            onChange={(e) => setOpen(e.target.value)}
            placeholder="Es. 400 se ne aggiungi una già aperta"
          />
        </>
      )}
      <div className="grid-2" style={{ marginTop: 10 }}>
        <button className="btn ghost small" onClick={onCancel}>Annulla</button>
        <button className="btn small" onClick={confirm}>Conferma carico</button>
      </div>
    </div>
  )
}

// Form nuovo prodotto: definito da contenuto per confezione + numero di
// confezioni (+ eventuale bottiglia aperta). Nessuna "giacenza iniziale" grezza.
function ItemForm({ onCancel, onSave }) {
  const [form, setForm] = useState({
    name: '',
    unit: 'ml',
    package_size: '',
    bottles: '',
    open_content: '',
    low_threshold: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const isPz = form.unit === 'pz'

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const n = Number(form.bottles) || 0
      let stock
      let package_size = null
      if (isPz) {
        stock = n
      } else {
        const size = Number(form.package_size) || 0
        package_size = size || null
        stock = n * size + (Number(form.open_content) || 0)
      }
      await onSave({
        name: form.name.trim(),
        unit: form.unit,
        stock,
        package_size,
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

      <label htmlFor="iunit">Tipo</label>
      <select id="iunit" value={form.unit} onChange={set('unit')}>
        {BASE_UNITS.map((u) => (
          <option key={u} value={u}>
            {u === 'ml' ? 'Liquido (ml)' : u === 'g' ? 'Peso (g)' : 'Pezzi (es. birre)'}
          </option>
        ))}
      </select>

      {isPz ? (
        <>
          <label htmlFor="ibottles">Quantità iniziale (pezzi)</label>
          <input id="ibottles" type="number" step="1" min="0" value={form.bottles} onChange={set('bottles')} />
        </>
      ) : (
        <>
          <label htmlFor="ipkg">Contenuto per confezione ({form.unit})</label>
          <input id="ipkg" type="number" step="any" min="0" value={form.package_size} onChange={set('package_size')} placeholder="Es. 1000 per una bottiglia da 1 L" />

          <label htmlFor="ibottles">Numero di confezioni piene</label>
          <input id="ibottles" type="number" step="1" min="0" value={form.bottles} onChange={set('bottles')} placeholder="Es. 3" />

          <label htmlFor="iopen">Bottiglia aperta — contenuto ({form.unit}) — opzionale</label>
          <input id="iopen" type="number" step="any" min="0" value={form.open_content} onChange={set('open_content')} placeholder="Es. 400 se ne hai una già aperta" />
        </>
      )}

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
