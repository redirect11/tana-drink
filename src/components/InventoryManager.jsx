import { useEffect, useMemo, useState } from 'react'
import {
  fetchInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  loadStock,
  receiveBottles,
  adjustStock,
  fetchStockMovements,
  fetchInventoryCategories,
  createInventoryCategory,
  updateInventoryCategory,
  deleteInventoryCategory,
} from '../lib/api.js'
import {
  BASE_UNITS,
  formatQty,
  stockStatus,
  bottleBreakdown,
  inventorySummary,
  filterItems,
} from '../lib/inventory.js'

const STATUS_LABEL = { ok: '', low: 'in esaurimento', empty: 'esaurito' }

export default function InventoryManager() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [editing, setEditing] = useState(null) // null | 'new' | item
  const [showCats, setShowCats] = useState(false)
  const [showMovs, setShowMovs] = useState(false)

  // Filtri
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Riga espansa + carico in corso
  const [expandedId, setExpandedId] = useState(null)
  const [caricoFor, setCaricoFor] = useState(null)

  const catName = (id) => categories.find((c) => c.id === id)?.name

  async function load() {
    setLoading(true)
    try {
      const [its, cats, movs] = await Promise.all([
        fetchInventoryItems(),
        fetchInventoryCategories().catch(() => []),
        fetchStockMovements({ limit: 30 }).catch(() => []),
      ])
      setItems(its)
      setCategories(cats)
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

  const summary = useMemo(() => inventorySummary(items), [items])
  const visible = useMemo(
    () => filterItems(items, { query, categoryId: categoryFilter, status: statusFilter }),
    [items, query, categoryFilter, statusFilter]
  )

  async function handleSave(payload) {
    setError(null)
    try {
      if (editing && editing !== 'new') {
        await updateInventoryItem(editing.id, payload)
      } else {
        await createInventoryItem(payload)
      }
      setEditing(null)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function doCarico(item, { count, open }) {
    setError(null)
    try {
      if (item.unit === 'pz') await loadStock(item.id, count)
      else await receiveBottles(item.id, count, open)
      setCaricoFor(null)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

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

  if (editing) {
    return (
      <ItemForm
        initial={editing === 'new' ? null : editing}
        categories={categories}
        onCancel={() => setEditing(null)}
        onSave={handleSave}
      />
    )
  }

  function toggleStatus(s) {
    setStatusFilter((cur) => (cur === s ? 'all' : s))
  }

  return (
    <div>
      {/* Riepilogo a colpo d'occhio (anche filtri di stato) */}
      <div className="inv-summary">
        <button className={`chip ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>
          Totale <strong>{summary.total}</strong>
        </button>
        <button className={`chip warn ${statusFilter === 'low' ? 'active' : ''}`} onClick={() => toggleStatus('low')}>
          In esaurimento <strong>{summary.low}</strong>
        </button>
        <button className={`chip danger ${statusFilter === 'empty' ? 'active' : ''}`} onClick={() => toggleStatus('empty')}>
          Esauriti <strong>{summary.empty}</strong>
        </button>
      </div>

      {/* Ricerca */}
      <input
        className="inv-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 Cerca prodotto…"
      />

      {/* Filtro categorie */}
      {categories.length > 0 && (
        <div className="chips-row">
          <button className={`chip ${categoryFilter === 'all' ? 'active' : ''}`} onClick={() => setCategoryFilter('all')}>
            Tutte
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`chip ${categoryFilter === c.id ? 'active' : ''}`}
              onClick={() => setCategoryFilter(c.id)}
            >
              {c.name}
            </button>
          ))}
          <button className={`chip ${categoryFilter === 'none' ? 'active' : ''}`} onClick={() => setCategoryFilter('none')}>
            Senza categoria
          </button>
        </div>
      )}

      <div className="grid-2" style={{ marginTop: 8 }}>
        <button className="btn small" onClick={() => setEditing('new')}>+ Nuovo prodotto</button>
        <button className="btn ghost small" onClick={() => setShowCats((v) => !v)}>🏷 Categorie</button>
      </div>

      {showCats && (
        <InvCategoryManager
          categories={categories}
          onChange={async () => setCategories(await fetchInventoryCategories())}
        />
      )}

      {error && <div className="banner" style={{ marginTop: 8 }}>Errore: {error}</div>}
      {loading && <div className="empty">Carico l’inventario…</div>}

      {/* Lista compatta */}
      <div className="inv-list">
        {visible.map((it) => {
          const st = stockStatus(it)
          const bd = bottleBreakdown(it)
          const expanded = expandedId === it.id
          return (
            <div className="inv-item" key={it.id}>
              <div
                className="inv-row"
                onClick={() => {
                  setExpandedId(expanded ? null : it.id)
                  setCaricoFor(null)
                }}
              >
                <span className={`dot dot-${st}`} title={STATUS_LABEL[st] || 'ok'} />
                <div className="grow">
                  <div className="inv-name">{it.name}</div>
                  <div className="muted small">{catName(it.category_id) || 'Senza categoria'}</div>
                </div>
                <div className="inv-qty">
                  <div>{formatQty(it.stock, it.unit)}</div>
                  {bd && (
                    <div className="muted small">
                      {bd.full} piene{bd.hasOpen ? ' +1' : ''}
                    </div>
                  )}
                </div>
                <span className="chev">{expanded ? '▴' : '▾'}</span>
              </div>

              {expanded && (
                <div className="inv-detail">
                  {bd ? (
                    <div className="muted small">
                      🍾 {bd.full} piene
                      {bd.hasOpen && ` · 1 aperta (${formatQty(bd.openRemaining, it.unit)})`}
                      {bd.finished > 0 && ` · ${bd.finished} finite`}
                      {' · '}1 conf. = {formatQty(it.package_size, it.unit)}
                    </div>
                  ) : (
                    it.unit !== 'pz' && Number(it.package_size) > 0 && (
                      <div className="muted small">1 conf. = {formatQty(it.package_size, it.unit)}</div>
                    )
                  )}
                  {Number(it.low_threshold) > 0 && (
                    <div className="muted small">Soglia avviso: {formatQty(it.low_threshold, it.unit)}</div>
                  )}

                  {caricoFor === it.id ? (
                    <CaricoForm item={it} onCancel={() => setCaricoFor(null)} onConfirm={(p) => doCarico(it, p)} />
                  ) : (
                    <>
                      <div className="grid-2" style={{ marginTop: 8 }}>
                        <button className="btn small" onClick={() => setCaricoFor(it.id)}>⬆ Carico</button>
                        <button className="btn secondary small" onClick={() => rettifica(it)}>Contenuto reale</button>
                      </div>
                      <div className="grid-2" style={{ marginTop: 8 }}>
                        <button className="btn ghost small" onClick={() => setEditing(it)}>✏️ Modifica</button>
                        <button className="btn ghost small" onClick={() => remove(it)}>🗑 Elimina</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!loading && items.length === 0 && (
        <div className="empty">Nessun prodotto in inventario. Aggiungine uno!</div>
      )}
      {!loading && items.length > 0 && visible.length === 0 && (
        <div className="empty">Nessun prodotto corrisponde ai filtri.</div>
      )}

      {/* Movimenti (collassabile) */}
      {movements.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <button className="btn ghost small block" onClick={() => setShowMovs((v) => !v)}>
            {showMovs ? 'Nascondi movimenti' : '📜 Ultimi movimenti'}
          </button>
          {showMovs &&
            movements.map((m) => (
              <div className="row between" key={m.id} style={{ marginTop: 6 }}>
                <span className="muted small">
                  {m.type === 'load' ? '⬆' : '⬇'} {m.item_name} · {m.reason}
                </span>
                <span className="muted small">
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

// --- Gestione categorie inventario --------------------------------------

function InvCategoryManager({ categories, onChange }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await createInventoryCategory({ name: name.trim(), sort_order: categories.length })
      setName('')
      await onChange()
    } finally {
      setBusy(false)
    }
  }
  async function rename(c) {
    const n = prompt('Nuovo nome categoria:', c.name)
    if (n == null || !n.trim()) return
    await updateInventoryCategory(c.id, { name: n.trim() })
    await onChange()
  }
  async function remove(c) {
    if (!confirm(`Eliminare la categoria “${c.name}”? I prodotti resteranno, senza categoria.`)) return
    await deleteInventoryCategory(c.id)
    await onChange()
  }
  async function move(idx, dir) {
    const j = idx + dir
    if (j < 0 || j >= categories.length) return
    const a = categories[idx]
    const b = categories[j]
    await Promise.all([
      updateInventoryCategory(a.id, { sort_order: b.sort_order }),
      updateInventoryCategory(b.id, { sort_order: a.sort_order }),
    ])
    await onChange()
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row" style={{ gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuova categoria (es. Distillati)" />
        <button className="btn small" onClick={add} disabled={busy}>Aggiungi</button>
      </div>
      {categories.length === 0 && (
        <div className="muted small" style={{ marginTop: 8 }}>Nessuna categoria.</div>
      )}
      {categories.map((c, idx) => (
        <div className="row between" key={c.id} style={{ marginTop: 8 }}>
          <span>{c.name}</span>
          <span className="row" style={{ gap: 4 }}>
            <button className="btn ghost small" onClick={() => move(idx, -1)} disabled={idx === 0}>↑</button>
            <button className="btn ghost small" onClick={() => move(idx, 1)} disabled={idx === categories.length - 1}>↓</button>
            <button className="btn ghost small" onClick={() => rename(c)}>✏️</button>
            <button className="btn ghost small" onClick={() => remove(c)}>🗑</button>
          </span>
        </div>
      ))}
    </div>
  )
}

// --- Form di carico -----------------------------------------------------

function CaricoForm({ item, onCancel, onConfirm }) {
  const [count, setCount] = useState('')
  const [open, setOpen] = useState('')
  const isPz = item.unit === 'pz'
  const size = Number(item.package_size) || 0

  function confirm() {
    const n = Number(String(count).replace(',', '.')) || 0
    if (isPz) {
      if (n <= 0) return
      onConfirm({ count: n, open: 0 })
      return
    }
    const openQty = Number(String(open).replace(',', '.')) || 0
    if (n <= 0 && openQty <= 0) return
    onConfirm({ count: n, open: openQty })
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
          <label style={{ marginTop: 8 }}>Bottiglia aperta — contenuto ({item.unit}) — opzionale</label>
          <input type="number" step="any" min="0" value={open} onChange={(e) => setOpen(e.target.value)} placeholder="Es. 400 se ne aggiungi una già aperta" />
        </>
      )}
      <div className="grid-2" style={{ marginTop: 10 }}>
        <button className="btn ghost small" onClick={onCancel}>Annulla</button>
        <button className="btn small" onClick={confirm}>Conferma carico</button>
      </div>
    </div>
  )
}

// --- Form prodotto (creazione + modifica) -------------------------------

function ItemForm({ initial, categories, onCancel, onSave }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    unit: initial?.unit ?? 'ml',
    category_id: initial?.category_id ?? '',
    package_size: initial?.package_size ?? '',
    low_threshold: initial?.low_threshold ?? '',
    // solo in creazione: giacenza iniziale espressa in confezioni
    bottles: '',
    open_content: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const isPz = form.unit === 'pz'

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const base = {
        name: form.name.trim(),
        unit: form.unit,
        category_id: form.category_id || null,
        package_size: isPz ? null : (Number(form.package_size) || null),
        low_threshold: Number(form.low_threshold) || 0,
      }
      if (isEdit) {
        // In modifica la giacenza non si tocca (si usa Carico/Contenuto reale).
        await onSave(base)
      } else {
        const n = Number(form.bottles) || 0
        let stock
        let bottles_total = 0
        if (isPz) {
          stock = n
        } else {
          const size = Number(form.package_size) || 0
          const open = Number(form.open_content) || 0
          stock = n * size + open
          bottles_total = n + (open > 0 ? 1 : 0)
        }
        await onSave({ ...base, stock, bottles_total })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3 style={{ marginTop: 0 }}>{isEdit ? 'Modifica prodotto' : 'Nuovo prodotto'}</h3>

      <label htmlFor="iname">Nome *</label>
      <input id="iname" value={form.name} onChange={set('name')} placeholder="Es. Rum Zacapa" required />

      <label htmlFor="icat">Categoria</label>
      <select id="icat" value={form.category_id || ''} onChange={set('category_id')}>
        <option value="">— Nessuna —</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <label htmlFor="iunit">Tipo</label>
      <select id="iunit" value={form.unit} onChange={set('unit')} disabled={isEdit}>
        {BASE_UNITS.map((u) => (
          <option key={u} value={u}>
            {u === 'ml' ? 'Liquido (ml)' : u === 'g' ? 'Peso (g)' : 'Pezzi (es. birre)'}
          </option>
        ))}
      </select>

      {!isPz && (
        <>
          <label htmlFor="ipkg">Contenuto per confezione ({form.unit})</label>
          <input id="ipkg" type="number" step="any" min="0" value={form.package_size} onChange={set('package_size')} placeholder="Es. 1000 per una bottiglia da 1 L" />
        </>
      )}

      {!isEdit && (
        isPz ? (
          <>
            <label htmlFor="ibottles">Quantità iniziale (pezzi)</label>
            <input id="ibottles" type="number" step="1" min="0" value={form.bottles} onChange={set('bottles')} />
          </>
        ) : (
          <>
            <label htmlFor="ibottles">Numero di confezioni piene</label>
            <input id="ibottles" type="number" step="1" min="0" value={form.bottles} onChange={set('bottles')} placeholder="Es. 3" />
            <label htmlFor="iopen">Bottiglia aperta — contenuto ({form.unit}) — opzionale</label>
            <input id="iopen" type="number" step="any" min="0" value={form.open_content} onChange={set('open_content')} placeholder="Es. 400 se ne hai una già aperta" />
          </>
        )
      )}

      <label htmlFor="ithr">Soglia di avviso ({form.unit})</label>
      <input id="ithr" type="number" step="any" min="0" value={form.low_threshold} onChange={set('low_threshold')} placeholder="Es. 500" />

      <div className="grid-2" style={{ marginTop: 16 }}>
        <button type="button" className="btn ghost" onClick={onCancel} disabled={saving}>Annulla</button>
        <button type="submit" className="btn" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva'}</button>
      </div>
    </form>
  )
}
