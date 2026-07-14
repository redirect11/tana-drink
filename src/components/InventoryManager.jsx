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
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../lib/api.js'
import {
  BASE_UNITS,
  formatQty,
  stockStatus,
  bottleBreakdown,
  inventorySummary,
  filterItems,
  costWithVat,
  stockValue,
  costPerCl,
  inventoryTotalValue,
} from '../lib/inventory.js'
import { formatPrice } from '../lib/orderStatus.js'
import StockCountPanel from './StockCountPanel.jsx'
import PurchaseOrdersPanel from './PurchaseOrdersPanel.jsx'
import SupplierInvoicesPanel from './SupplierInvoicesPanel.jsx'

const STATUS_ITEM = [
  { value: 'linea', label: 'In linea' },
  { value: 'premium', label: 'Premium' },
  { value: 'out', label: 'Fuori assortimento' },
]

const STATUS_LABEL = { ok: '', low: 'in esaurimento', empty: 'esaurito' }

// Sezioni del magazzino: prodotti (giacenze), conta periodica, ordini
// fornitore e scadenzario — la controparte software dei fogli Excel storici.
const INV_VIEWS = [
  ['prodotti', '📦 Prodotti'],
  ['conta', '📋 Conta'],
  ['ordini', '🛒 Ordini'],
  ['scadenzario', '📄 Scadenzario'],
]

export default function InventoryManager() {
  const [view, setView] = useState('prodotti')
  return (
    <div>
      <div className="chips-row" style={{ marginBottom: 8 }}>
        {INV_VIEWS.map(([id, label]) => (
          <button
            key={id}
            className={`chip ${view === id ? 'active' : ''}`}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {view === 'prodotti' && <ProductsPanel />}
      {view === 'conta' && <StockCountPanel />}
      {view === 'ordini' && <PurchaseOrdersPanel />}
      {view === 'scadenzario' && <SupplierInvoicesPanel />}
    </div>
  )
}

function ProductsPanel() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [editing, setEditing] = useState(null) // null | 'new' | item
  const [showCats, setShowCats] = useState(false)
  const [showSup, setShowSup] = useState(false)
  const [showMovs, setShowMovs] = useState(false)

  // Filtri
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Riga espansa + carico in corso
  const [expandedId, setExpandedId] = useState(null)
  const [caricoFor, setCaricoFor] = useState(null)

  const catName = (id) => categories.find((c) => c.id === id)?.name
  const supName = (id) => suppliers.find((s) => s.id === id)?.name

  async function load() {
    setLoading(true)
    try {
      const [its, cats, sups, movs] = await Promise.all([
        fetchInventoryItems(),
        fetchInventoryCategories().catch(() => []),
        fetchSuppliers().catch(() => []),
        fetchStockMovements({ limit: 30 }).catch(() => []),
      ])
      setItems(its)
      setCategories(cats)
      setSuppliers(sups)
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
  const totalValue = useMemo(() => inventoryTotalValue(items), [items])
  const visible = useMemo(
    () => filterItems(items, { query, categoryId: categoryFilter, supplierId: supplierFilter, status: statusFilter }),
    [items, query, categoryFilter, supplierFilter, statusFilter]
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
        suppliers={suppliers}
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

      <div className="chip" style={{ width: '100%', justifyContent: 'center', marginBottom: 8, cursor: 'default' }}>
        💶 Valore magazzino <strong>{formatPrice(totalValue)}</strong>
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

      {/* Filtro fornitori */}
      {suppliers.length > 0 && (
        <div className="chips-row">
          <button className={`chip ${supplierFilter === 'all' ? 'active' : ''}`} onClick={() => setSupplierFilter('all')}>
            🏭 Tutti
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

      <button className="btn block" onClick={() => setEditing('new')}>+ Nuovo prodotto</button>
      <div className="grid-2" style={{ marginTop: 8 }}>
        <button className="btn ghost small" onClick={() => setShowCats((v) => !v)}>🏷 Categorie</button>
        <button className="btn ghost small" onClick={() => setShowSup((v) => !v)}>🏭 Fornitori</button>
      </div>

      {showCats && (
        <InvCategoryManager
          categories={categories}
          onChange={async () => setCategories(await fetchInventoryCategories())}
        />
      )}
      {showSup && (
        <SupplierManager
          suppliers={suppliers}
          onChange={async () => setSuppliers(await fetchSuppliers())}
        />
      )}

      {error && <div className="banner" style={{ marginTop: 8 }}>Errore: {error}</div>}
      {loading && <div className="empty">Carico l’inventario…</div>}

      {/* Card compatte in griglia (stessa UX delle card ordini): striscia
          colorata per lo stato scorte, dettagli e azioni a scomparsa. */}
      <div className="admin-grid">
        {visible.map((it) => {
          const st = stockStatus(it)
          const bd = bottleBreakdown(it)
          const expanded = expandedId === it.id
          return (
            <div className={`card grid-card admin-card inv-${st}`} key={it.id}>
              <div
                className="grid-card-main"
                role="button"
                tabIndex={0}
                onClick={() => {
                  setExpandedId(expanded ? null : it.id)
                  setCaricoFor(null)
                }}
              >
                <div className="row between" style={{ alignItems: 'flex-start', gap: 6 }}>
                  <strong style={{ fontSize: '0.92rem', lineHeight: 1.25 }}>
                    {it.name}{' '}
                    {it.status === 'out' && <span className="badge-empty">OUT</span>}
                  </strong>
                  <span className={`dot dot-${st}`} title={STATUS_LABEL[st] || 'ok'} />
                </div>
                <div className="row between" style={{ alignItems: 'baseline' }}>
                  <span className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {catName(it.category_id) || 'Senza categoria'}
                    {supName(it.supplier_id) ? ` · ${supName(it.supplier_id)}` : ''}
                  </span>
                  <span className="grid-card-tot" style={{ fontSize: '1.05rem', whiteSpace: 'nowrap' }}>
                    {formatQty(it.stock, it.unit)}
                  </span>
                </div>
                {bd && (
                  <div className="muted small">🍾 {bd.full} piene{bd.hasOpen ? ' +1 aperta' : ''}</div>
                )}
              </div>
              <button
                type="button"
                className="grid-card-toggle"
                onClick={() => {
                  setExpandedId(expanded ? null : it.id)
                  setCaricoFor(null)
                }}
                aria-expanded={expanded}
              >
                {expanded ? '▴ Chiudi' : '⋯ Azioni'}
              </button>
              {expanded && (
                <div className="grid-card-actions">
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
                  {it.cost != null && (
                    <div className="muted small">
                      💶 {formatPrice(it.cost)}/pz (+IVA {formatPrice(costWithVat(it.cost, it.vat))})
                      {costPerCl(it) != null && ` · ${formatPrice(costPerCl(it))}/cl`}
                      {' · valore '} <strong>{formatPrice(stockValue(it))}</strong>
                    </div>
                  )}

                  {caricoFor === it.id ? (
                    <CaricoForm item={it} onCancel={() => setCaricoFor(null)} onConfirm={(p) => doCarico(it, p)} />
                  ) : (
                    <>
                      <button className="btn small block" style={{ marginTop: 8 }} onClick={() => setCaricoFor(it.id)}>
                        ⬆ Carico
                      </button>
                      <button className="btn secondary small block" style={{ marginTop: 6 }} onClick={() => rettifica(it)}>
                        Contenuto reale
                      </button>
                      <div className="grid-2" style={{ marginTop: 6, gap: 6 }}>
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

// --- Gestione fornitori --------------------------------------------------

function SupplierManager({ suppliers, onChange }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await createSupplier({ name: name.trim(), sort_order: suppliers.length })
      setName('')
      await onChange()
    } finally {
      setBusy(false)
    }
  }
  async function rename(s) {
    const n = prompt('Nuovo nome fornitore:', s.name)
    if (n == null || !n.trim()) return
    await updateSupplier(s.id, { name: n.trim() })
    await onChange()
  }
  // Email per l'invio degli ordini d'acquisto (bottone 📧 negli Ordini).
  async function setEmail(s) {
    const e = prompt(`Email di ${s.name} (per inviare gli ordini):`, s.email || '')
    if (e == null) return
    await updateSupplier(s.id, { email: e.trim() || null })
    await onChange()
  }
  async function remove(s) {
    if (!confirm(`Eliminare il fornitore “${s.name}”? I prodotti resteranno, senza fornitore.`)) return
    await deleteSupplier(s.id)
    await onChange()
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row" style={{ gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuovo fornitore (es. NOVA)" />
        <button className="btn small" onClick={add} disabled={busy}>Aggiungi</button>
      </div>
      {suppliers.length === 0 && (
        <div className="muted small" style={{ marginTop: 8 }}>Nessun fornitore.</div>
      )}
      {suppliers.map((s) => (
        <div className="row between" key={s.id} style={{ marginTop: 8 }}>
          <span>
            {s.name}
            {s.email && <span className="muted small"> · {s.email}</span>}
          </span>
          <span className="row" style={{ gap: 4 }}>
            <button className="btn ghost small" title="Email per gli ordini" onClick={() => setEmail(s)}>📧</button>
            <button className="btn ghost small" onClick={() => rename(s)}>✏️</button>
            <button className="btn ghost small" onClick={() => remove(s)}>🗑</button>
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

function ItemForm({ initial, categories, suppliers, onCancel, onSave }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    unit: initial?.unit ?? 'ml',
    category_id: initial?.category_id ?? '',
    supplier_id: initial?.supplier_id ?? '',
    cost: initial?.cost ?? '',
    vat: initial?.vat ?? 22,
    status: initial?.status ?? 'linea',
    package_size: initial?.package_size ?? '',
    low_threshold: initial?.low_threshold ?? '',
    // solo in creazione: giacenza iniziale espressa in confezioni
    bottles: '',
    open_content: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const isPz = form.unit === 'pz'
  const costNum = Number(String(form.cost).replace(',', '.')) || 0
  const clPerConf = !isPz && Number(form.package_size) > 0 ? Number(form.package_size) / 10 : 0

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const base = {
        name: form.name.trim(),
        unit: form.unit,
        category_id: form.category_id || null,
        supplier_id: form.supplier_id || null,
        cost: form.cost === '' ? null : costNum,
        vat: Number(form.vat) || 0,
        status: form.status || 'linea',
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

      <label htmlFor="isup">Fornitore</label>
      <select id="isup" value={form.supplier_id || ''} onChange={set('supplier_id')}>
        <option value="">— Nessuno —</option>
        {(suppliers || []).map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>

      <div className="grid-2">
        <div>
          <label htmlFor="icost">Costo €/pz (netto)</label>
          <input id="icost" type="number" step="any" min="0" value={form.cost} onChange={set('cost')} placeholder="Es. 12,9" />
        </div>
        <div>
          <label htmlFor="ivat">IVA %</label>
          <input id="ivat" type="number" step="any" min="0" value={form.vat} onChange={set('vat')} />
        </div>
      </div>
      {costNum > 0 && (
        <div className="muted small">
          +IVA {formatPrice(costWithVat(costNum, form.vat))}
          {clPerConf > 0 && ` · ${formatPrice(costWithVat(costNum, form.vat) / clPerConf)}/cl`}
        </div>
      )}

      <label htmlFor="istatus">Stato</label>
      <select id="istatus" value={form.status} onChange={set('status')}>
        {STATUS_ITEM.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
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
