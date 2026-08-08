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
  fetchMacroCategories,
  createMacroCategory,
  updateMacroCategory,
  deleteMacroCategory,
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  subscribeSettings,
  DEFAULT_SETTINGS,
} from '../lib/api.js'
import {
  formatQty,
  fmtItem,
  baseUnit,
  fromBaseQty,
  toBaseQty,
  stockStatus,
  bottleSummary,
  bottleBreakdown,
  inventorySummary,
  filterItems,
  costWithVat,
  stockValue,
  smallUnits,
  costPerUnit,
  inventoryTotalValue,
} from '../lib/inventory.js'
import { formatPrice } from '../lib/orderStatus.js'
import { parseSupplierList } from '../lib/warehouse.js'
import { groupCategoriesByMacro } from '../lib/macros.js'
import { toastSuccess, toastError } from '../lib/toast.js'
import StockCountPanel from './StockCountPanel.jsx'
import PurchaseOrdersPanel from './PurchaseOrdersPanel.jsx'
import SupplierInvoicesPanel from './SupplierInvoicesPanel.jsx'
import CategoryRail from './CategoryRail.jsx'

const STATUS_ITEM = [
  { value: 'linea', label: 'In linea' },
  { value: 'premium', label: 'Premium' },
  { value: 'out', label: 'Fuori assortimento' },
]

const STATUS_LABEL = { ok: '', low: 'in esaurimento', empty: 'esaurito' }

// Prezzo unitario dell'item con l'unità di misura selezionabile (cl/ml per i
// liquidi, g/mg per i solidi, pz per i pezzi): costo REALE al dettaglio +
// prezzo CONSIGLIATO a ricarico (×3 di default) e GUADAGNO che ne resta.
// È qui che si legge la marginalità dell'ingrediente, per unità.
function UnitPrice({ item, markup }) {
  const units = smallUnits(item)
  const [unit, setUnit] = useState(units[0])
  const cost = costPerUnit(item, unit)
  if (cost == null) return null
  const m = Number(markup) > 0 ? Number(markup) : 3
  const consigliato = cost * m
  const guadagno = consigliato - cost
  return (
    <div className="inv-info-row">
      <dt>
        Al {unit}
        {units.length > 1 &&
          units.map((u) => (
            <button
              key={u}
              type="button"
              className={`chip ${u === unit ? 'active' : ''}`}
              style={{ padding: '0 6px', fontSize: '0.68rem' }}
              onClick={(e) => {
                e.stopPropagation()
                setUnit(u)
              }}
            >
              {u}
            </button>
          ))}
      </dt>
      <dd className="inv-unitprice">
        <span>costo <strong>{formatPrice(cost)}</strong></span>
        <span>consigliato ×{m} <strong className="price">{formatPrice(consigliato)}</strong></span>
        <span className="muted">guadagno {formatPrice(guadagno)}</span>
      </dd>
    </div>
  )
}

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
  const [macros, setMacros] = useState([])
  const [showCats, setShowCats] = useState(false)
  const [showMacros, setShowMacros] = useState(false)
  const [showSup, setShowSup] = useState(false)
  const [showMovs, setShowMovs] = useState(false)

  // Filtri
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Riga espansa + carico in corso
  const [invView, setInvView] = useState('lista') // 'lista' | 'card' — default LISTA
  // Ordinamento della tabella: click sull'intestazione, ri-click inverte.
  const [sort, setSort] = useState({ col: 'name', dir: 'asc' })
  const toggleSort = (col) =>
    setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))
  const [expandedId, setExpandedId] = useState(null)
  const [caricoFor, setCaricoFor] = useState(null)

  // Ricarico (×N) per il prezzo consigliato mostrato accanto al costo.
  const [markup, setMarkup] = useState(DEFAULT_SETTINGS.price_markup)
  // IVA di ACQUISTO (fatture fornitore, 22%): è il default dei prodotti qui.
  const [purchaseVat, setPurchaseVat] = useState(DEFAULT_SETTINGS.purchase_vat)
  useEffect(
    () =>
      subscribeSettings((s) => {
        setMarkup(s.price_markup)
        setPurchaseVat(s.purchase_vat ?? DEFAULT_SETTINGS.purchase_vat)
      }, () => {}),
    []
  )

  const catName = (id) => categories.find((c) => c.id === id)?.name
  const supName = (id) => suppliers.find((s) => s.id === id)?.name

  async function load() {
    setLoading(true)
    try {
      const [its, cats, macs, sups, movs] = await Promise.all([
        fetchInventoryItems(),
        fetchInventoryCategories().catch(() => []),
        fetchMacroCategories().catch(() => []),
        fetchSuppliers().catch(() => []),
        fetchStockMovements({ limit: 30 }).catch(() => []),
      ])
      setItems(its)
      setCategories(cats)
      setMacros(macs)
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
  // Blocco azioni espanse di un item, condiviso dalla vista a CARD e dalla
  // vista a LISTA: carico, rettifica, costi e modifica/elimina.
  const itemActions = (it, bd) => (
    <div className="grid-card-actions">
      <dl className="inv-info">
        {bd ? (
          <div className="inv-info-row">
            <dt>🍾 Bottiglie</dt>
            <dd>
              {bd.full} piene
              {bd.hasOpen && ` · 1 aperta (${fmtItem(bd.openRemaining, it)})`}
              {bd.finished > 0 && ` · ${bd.finished} finite`}
              <span className="muted"> · 1 conf. = {fmtItem(it.package_size, it)}</span>
            </dd>
          </div>
        ) : (
          it.unit !== 'pz' && Number(it.package_size) > 0 && (
            <div className="inv-info-row">
              <dt>Confezione</dt>
              <dd>1 conf. = {fmtItem(it.package_size, it)}</dd>
            </div>
          )
        )}
        {Number(it.low_threshold) > 0 && (
          <div className="inv-info-row">
            <dt>Soglia avviso</dt>
            <dd>{fmtItem(it.low_threshold, it)}</dd>
          </div>
        )}
        {it.cost != null && (
          <>
            <div className="inv-info-row">
              <dt>💶 Costo</dt>
              <dd>
                {formatPrice(it.cost)}/conf. <span className="muted">(+IVA {formatPrice(costWithVat(it.cost, it.vat))})</span>
                {' · valore '}<strong>{formatPrice(stockValue(it))}</strong>
              </dd>
            </div>
            <UnitPrice item={it} markup={markup} />
          </>
        )}
      </dl>

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
  )

  const visible = useMemo(
    () => filterItems(items, { query, categoryId: categoryFilter, supplierId: supplierFilter, status: statusFilter }),
    [items, query, categoryFilter, supplierFilter, statusFilter]
  )

  // Righe ordinate per la TABELLA: testo in ordine alfabetico, numeri per
  // valore. I valori mancanti finiscono sempre in fondo, in entrambi i versi.
  const sortedVisible = useMemo(() => {
    const val = (it) => {
      switch (sort.col) {
        case 'cat': return catName(it.category_id) || ''
        case 'net': return it.cost != null ? Number(it.cost) : null
        case 'gross': return it.cost != null ? costWithVat(it.cost, it.vat) : null
        case 'percl': return costPerUnit(it, 'cl')
        case 'stock': return Number(it.stock) || 0
        default: return it.name || ''
      }
    }
    const mul = sort.dir === 'asc' ? 1 : -1
    return [...visible].sort((a, b) => {
      const x = val(a)
      const y = val(b)
      const xMissing = x == null || x === ''
      const yMissing = y == null || y === ''
      if (xMissing && yMissing) return 0
      if (xMissing) return 1 // i vuoti restano in fondo
      if (yMissing) return -1
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * mul
      return String(x).localeCompare(String(y), 'it') * mul
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sort, categories])

  // Conteggi per categoria (su tutto l'inventario) per la barra a sinistra.
  const catItems = useMemo(() => {
    let none = 0
    const per = {}
    for (const it of items) {
      if (it.category_id) per[it.category_id] = (per[it.category_id] || 0) + 1
      else none += 1
    }
    return [
      { key: 'all', label: 'Tutte', count: items.length },
      ...categories.map((c) => ({ key: c.id, label: c.name, count: per[c.id] || 0 })),
      ...(none ? [{ key: 'none', label: 'Senza categoria', count: none }] : []),
    ]
  }, [items, categories])

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

  async function doCarico(item, { count, open, newCost }) {
    setError(null)
    try {
      if (count > 0 || open > 0) {
        if (item.unit === 'pz') await loadStock(item.id, count)
        else await receiveBottles(item.id, count, open)
      }
      // Prezzo aggiornato al carico (il fornitore ha cambiato tariffa).
      if (newCost != null) await updateInventoryItem(item.id, { cost: newCost })
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
        defaultVat={purchaseVat}
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

      {/* Categorie a SINISTRA (come il POS), il resto a destra. */}
      <CategoryRail items={catItems} selected={categoryFilter} onSelect={setCategoryFilter} storageKey="inventory">

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
        <button className="btn ghost small" onClick={() => setShowMacros((v) => !v)}>🗂 Macro-categorie</button>
        <button className="btn ghost small" onClick={() => setShowSup((v) => !v)}>🏭 Fornitori</button>
      </div>

      {showCats && (
        <InvCategoryManager
          categories={categories}
          onChange={async () => setCategories(await fetchInventoryCategories())}
        />
      )}
      {showMacros && (
        <MacroCategoryManager
          macros={macros}
          categories={categories}
          onChange={async () => {
            const [macs, cats] = await Promise.all([fetchMacroCategories(), fetchInventoryCategories()])
            setMacros(macs)
            setCategories(cats)
          }}
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

      {/* Come visualizzare: card in griglia o lista condensata. */}
      {!loading && items.length > 0 && (
        <div className="chips-row" style={{ margin: '8px 0' }}>
          {[
            ['card', '▦ Card'],
            ['lista', '☰ Lista'],
          ].map(([k, label]) => (
            <button key={k} className={`chip ${invView === k ? 'active' : ''}`} onClick={() => setInvView(k)}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* TABELLA: colonne allineate (stato · prodotto · categoria · netto ·
          +IVA · scorte), riga cliccabile per aprire le azioni. */}
      {invView === 'lista' && (
        <div className="inv-list inv-table">
          <div className="inv-thead">
            <span aria-hidden />
            <SortTh label="Prodotto" col="name" sort={sort} onSort={toggleSort} />
            <SortTh label="Categoria" col="cat" sort={sort} onSort={toggleSort} />
            <SortTh label="IVA esclusa" col="net" sort={sort} onSort={toggleSort} num />
            <SortTh label="IVA inclusa" col="gross" sort={sort} onSort={toggleSort} num />
            <SortTh label="€/cl" col="percl" sort={sort} onSort={toggleSort} num />
            <SortTh label="Scorte" col="stock" sort={sort} onSort={toggleSort} num />
          </div>
          {sortedVisible.map((it) => {
            const st = stockStatus(it)
            const expanded = expandedId === it.id
            const bs = bottleSummary(it)
            const perCl = costPerUnit(it, 'cl') // già IVA inclusa
            return (
              <div className={`inv-row inv-${st}${expanded ? ' open' : ''}`} key={it.id}>
                <button
                  type="button"
                  className="inv-row-main"
                  onClick={() => {
                    setExpandedId(expanded ? null : it.id)
                    setCaricoFor(null)
                  }}
                >
                  <span className={`dot dot-${st}`} />
                  <span className="inv-row-name">
                    {it.name}
                    {it.status === 'out' && <span className="badge-empty">OUT</span>}
                  </span>
                  <span className="muted small inv-row-cat">{catName(it.category_id) || '—'}</span>
                  <span className="inv-cell-num">{it.cost != null ? formatPrice(it.cost) : '—'}</span>
                  <span className="inv-cell-num muted">{it.cost != null ? formatPrice(costWithVat(it.cost, it.vat)) : '—'}</span>
                  <span className="inv-cell-num muted">{perCl != null ? formatPrice(perCl) : '—'}</span>
                  <span className="inv-cell-num inv-row-stock">
                    {bs ? (
                      <>
                        {bs.bottles} 🍾{' '}
                        <span className="muted small">
                          · {bs.open ? `aperta ${bs.open}` : bs.bottles > 1 ? 'piene' : 'piena'}
                        </span>
                      </>
                    ) : (
                      fmtItem(it.stock, it)
                    )}
                  </span>
                </button>
                {expanded && itemActions(it, bottleBreakdown(it))}
              </div>
            )
          })}
        </div>
      )}

      {/* Card compatte in griglia (stessa UX delle card ordini): striscia
          colorata per lo stato scorte, dettagli e azioni a scomparsa. */}
      {invView === 'card' && (
      <div className="admin-grid">
        {visible.map((it) => {
          const st = stockStatus(it)
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
                  {(() => {
                    // Item da drink: bottiglie (pezzi) come numero grande, il
                    // CONTENUTO in cl/ml sotto — totale e residuo dell'aperta.
                    const bs = bottleSummary(it)
                    return (
                      <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span className="grid-card-tot" style={{ fontSize: '1.05rem' }}>
                          {bs ? `${bs.bottles} 🍾` : fmtItem(it.stock, it)}
                        </span>
                        {bs && (
                          <span className="muted small" style={{ display: 'block' }}>
                            {bs.total} ·{' '}
                            {bs.open
                              ? `aperta ${bs.open}`
                              : bs.bottles > 1
                                ? 'piene'
                                : 'piena'}
                          </span>
                        )}
                      </span>
                    )
                  })()}
                </div>
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
              {expanded && itemActions(it, bottleBreakdown(it))}
            </div>
          )
        })}
      </div>
      )}

      {!loading && items.length === 0 && (
        <div className="empty">Nessun prodotto in inventario. Aggiungine uno!</div>
      )}
      {!loading && items.length > 0 && visible.length === 0 && (
        <div className="empty">Nessun prodotto corrisponde ai filtri.</div>
      )}

      </CategoryRail>

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

// --- Macro-categorie -----------------------------------------------------
// Raggruppano le categorie d'inventario (Distillati, Birre+Bibite, Vino,
// Food+Moka…) per i conti aggregati di acquisti/fatturato. Si creano/
// modificano/eliminano, e a ciascuna si collegano categorie esistenti (o se
// ne creano di nuove dentro la macro). Una categoria sta in al più una macro.

function MacroCategoryManager({ macros, categories, onChange }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const { groups, unassigned } = groupCategoriesByMacro(macros, categories)

  async function addMacro() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await createMacroCategory({ name: name.trim(), sort_order: macros.length })
      setName('')
      await onChange()
    } finally {
      setBusy(false)
    }
  }
  async function renameMacro(m) {
    const n = prompt('Nuovo nome macro-categoria:', m.name)
    if (n == null || !n.trim()) return
    await updateMacroCategory(m.id, { name: n.trim() })
    await onChange()
  }
  async function removeMacro(m) {
    if (!confirm(`Eliminare la macro “${m.name}”? Le sue categorie restano, senza macro.`)) return
    await deleteMacroCategory(m.id)
    await onChange()
  }
  async function moveMacro(idx, dir) {
    const j = idx + dir
    if (j < 0 || j >= groups.length) return
    const a = groups[idx]
    const b = groups[j]
    await Promise.all([
      updateMacroCategory(a.id, { sort_order: b.sort_order }),
      updateMacroCategory(b.id, { sort_order: a.sort_order }),
    ])
    await onChange()
  }
  // Aggancia/sgancia una categoria a una macro (scrive macro_id sulla categoria).
  const setCatMacro = async (catId, macroId) => {
    await updateInventoryCategory(catId, { macro_id: macroId })
    await onChange()
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <p className="muted small" style={{ margin: '0 0 8px' }}>
        Le macro-categorie raggruppano le categorie del magazzino per i conti di
        acquisti e fatturato. Una categoria può stare in una sola macro.
      </p>
      <div className="row" style={{ gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuova macro (es. Distillati)" />
        <button className="btn small" onClick={addMacro} disabled={busy}>Aggiungi</button>
      </div>

      {groups.length === 0 && (
        <div className="muted small" style={{ marginTop: 8 }}>Nessuna macro-categoria.</div>
      )}

      {groups.map((g, idx) => (
        <div key={g.id} className="macro-group">
          <div className="row between" style={{ alignItems: 'center' }}>
            <strong>🗂 {g.name}</strong>
            <span className="row" style={{ gap: 4 }}>
              <button className="btn ghost small" onClick={() => moveMacro(idx, -1)} disabled={idx === 0}>↑</button>
              <button className="btn ghost small" onClick={() => moveMacro(idx, 1)} disabled={idx === groups.length - 1}>↓</button>
              <button className="btn ghost small" onClick={() => renameMacro(g)}>✏️</button>
              <button className="btn ghost small" onClick={() => removeMacro(g)}>🗑</button>
            </span>
          </div>
          {g.categories.length === 0 ? (
            <div className="muted small" style={{ margin: '4px 0' }}>Nessuna categoria collegata.</div>
          ) : (
            <div className="chips-row" style={{ margin: '6px 0' }}>
              {g.categories.map((c) => (
                <span key={c.id} className="chip" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  {c.name}
                  <button
                    type="button"
                    aria-label={`Togli ${c.name} da ${g.name}`}
                    className="chip-x"
                    onClick={() => setCatMacro(c.id, null)}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <AddCategoryToMacro macro={g} unassigned={unassigned} onChange={onChange} />
        </div>
      ))}

      {unassigned.length > 0 && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
          <span className="muted small">Categorie senza macro: </span>
          <span className="small">{unassigned.map((c) => c.name).join(', ')}</span>
        </div>
      )}
    </div>
  )
}

// Aggancio di una categoria a una macro: sceglie una categoria "libera" già
// esistente, oppure ne crea una nuova direttamente dentro la macro.
function AddCategoryToMacro({ macro, unassigned, onChange }) {
  const [pick, setPick] = useState('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  async function attach() {
    if (!pick) return
    setBusy(true)
    try {
      await updateInventoryCategory(pick, { macro_id: macro.id })
      setPick('')
      await onChange()
    } finally {
      setBusy(false)
    }
  }
  async function createInto() {
    if (!newName.trim()) return
    setBusy(true)
    try {
      await createInventoryCategory({ name: newName.trim(), macro_id: macro.id })
      setNewName('')
      await onChange()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {unassigned.length > 0 && (
        <>
          <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ maxWidth: 180 }}>
            <option value="">+ collega categoria…</option>
            {unassigned.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="btn ghost small" onClick={attach} disabled={!pick || busy}>Collega</button>
          <span className="muted small">oppure</span>
        </>
      )}
      <input
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="nuova categoria…"
        style={{ maxWidth: 160 }}
      />
      <button className="btn ghost small" onClick={createInto} disabled={!newName.trim() || busy}>+ Crea</button>
    </div>
  )
}

// --- Gestione fornitori --------------------------------------------------

function SupplierManager({ suppliers, onChange }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')

  // Import in blocco (es. dall'Excel): un fornitore per riga, ";email"
  // opzionale. I nomi già presenti vengono saltati.
  async function importList() {
    const rows = parseSupplierList(importText)
    if (rows.length === 0) return
    setBusy(true)
    try {
      const existing = new Set(suppliers.map((s) => s.name.toLowerCase()))
      let added = 0
      for (const r of rows) {
        if (existing.has(r.name.toLowerCase())) continue
        await createSupplier({
          name: r.name,
          sort_order: suppliers.length + added,
          ...(r.email ? { email: r.email } : {}),
        })
        added += 1
      }
      toastSuccess(`Importati ${added} fornitori${rows.length - added > 0 ? ` (${rows.length - added} già presenti)` : ''}`)
      setImportText('')
      setShowImport(false)
      await onChange()
    } catch (e) {
      toastError(`Import fornitori: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

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
      <button
        className="btn ghost small block"
        style={{ marginTop: 8 }}
        onClick={() => setShowImport((v) => !v)}
      >
        📥 Importa elenco (incolla, uno per riga)
      </button>
      {showImport && (
        <div style={{ marginTop: 6 }}>
          <textarea
            rows={5}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={'NOVA' + String.fromCharCode(10) + 'ENOFEL;ordini@enofel.it' + String.fromCharCode(10) + 'FONT'}
            style={{ width: '100%' }}
          />
          <button className="btn small block" style={{ marginTop: 6 }} disabled={busy} onClick={importList}>
            Importa
          </button>
        </div>
      )}
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

  // Costo al carico (bidirezionale): il fornitore spesso scarica il prezzo del
  // COLLO/CARTONE. Si inserisce l'unitario OPPURE il totale del collo (sapendo
  // quanti pezzi ci sono) e l'altro si ricalcola. Il "pezzi per collo" è solo
  // per il calcolo, non viene salvato.
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
  const num = (v) => Number(String(v).replace(',', '.')) || 0
  const [unitCost, setUnitCost] = useState(item.cost != null ? String(item.cost) : '')
  const [perCollo, setPerCollo] = useState('')
  const [colloTot, setColloTot] = useState('')

  const onUnit = (v) => {
    setUnitCost(v)
    const p = num(perCollo)
    if (p > 0) setColloTot(num(v) > 0 ? String(r2(num(v) * p)) : '')
  }
  const onCollo = (v) => {
    setPerCollo(v)
    const p = num(v)
    if (p <= 0) return
    if (num(unitCost) > 0) setColloTot(String(r2(num(unitCost) * p)))
    else if (num(colloTot) > 0) setUnitCost(String(r2(num(colloTot) / p)))
  }
  const onTot = (v) => {
    setColloTot(v)
    const p = num(perCollo)
    if (p > 0) setUnitCost(num(v) > 0 ? String(r2(num(v) / p)) : '')
  }

  const unitN = num(unitCost)
  const perN = num(perCollo)

  function confirm() {
    const n = num(count)
    const openQty = num(open)
    const hasQty = isPz ? n > 0 : n > 0 || openQty > 0
    const newCost = unitCost !== '' && unitN >= 0 && r2(unitN) !== Number(item.cost) ? r2(unitN) : null
    if (!hasQty && newCost == null) return
    onConfirm({ count: n, open: isPz ? 0 : openQty, newCost })
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

      {/* Prezzo: unitario ↔ totale collo (per confrontare col fornitore) */}
      <div className="card" style={{ marginTop: 10, padding: 10 }}>
        <div className="muted small">💶 Prezzo — aggiorna se il fornitore l'ha cambiato</div>
        <div className="grid-2" style={{ marginTop: 6 }}>
          <div>
            <label htmlFor="cf-unit">Costo unitario (€, netto)</label>
            <input id="cf-unit" type="number" step="any" min="0" value={unitCost} onChange={(e) => onUnit(e.target.value)} />
          </div>
          <div>
            <label htmlFor="cf-collo">Pezzi per collo/cartone</label>
            <input id="cf-collo" type="number" step="any" min="0" value={perCollo} onChange={(e) => onCollo(e.target.value)} placeholder="Es. 24" />
          </div>
        </div>
        <label htmlFor="cf-tot" style={{ marginTop: 6 }}>Totale collo (€, netto)</label>
        <input id="cf-tot" type="number" step="any" min="0" value={colloTot} onChange={(e) => onTot(e.target.value)} placeholder="Prezzo del cartone dal fornitore" />
        {unitN > 0 && (
          <div className="muted small" style={{ marginTop: 4 }}>
            Unitario +IVA {formatPrice(costWithVat(unitN, item.vat))}
            {perN > 0 && ` · Totale collo +IVA ${formatPrice(costWithVat(unitN * perN, item.vat))}`}
          </div>
        )}
      </div>

      <div className="grid-2" style={{ marginTop: 10 }}>
        <button className="btn ghost small" onClick={onCancel}>Annulla</button>
        <button className="btn small" onClick={confirm}>Conferma carico</button>
      </div>
    </div>
  )
}

// --- Form prodotto (creazione + modifica) -------------------------------

function ItemForm({ initial, categories, suppliers, defaultVat = 22, onCancel, onSave }) {
  const isEdit = !!initial
  // Unità scelta dall'utente (L/cl/ml, g/mg, pz). Lo stock è salvato in
  // base (ml/g/pz); i campi si inseriscono e si mostrano nell'unità scelta.
  // Default dei LIQUIDI in cl (non ml): al banco le bottiglie si dosano in cl,
  // quindi contenuto e soglia si inseriscono in cl. Vale anche per gli item
  // vecchi salvati in ml senza unità di visualizzazione.
  const defaultUnit = (base) => (base === 'g' ? 'g' : base === 'pz' ? 'pz' : 'cl')
  const initUnit = initial?.display_unit ?? defaultUnit(initial?.unit)
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    unit: initUnit,
    category_id: initial?.category_id ?? '',
    supplier_id: initial?.supplier_id ?? '',
    cost: initial?.cost ?? '',
    vat: initial?.vat ?? defaultVat,
    status: initial?.status ?? 'linea',
    package_size:
      initial?.package_size != null && initial?.package_size !== ''
        ? String(fromBaseQty(initial.package_size, initUnit))
        : '',
    low_threshold: initial?.low_threshold ? String(fromBaseQty(initial.low_threshold, initUnit)) : '',
    bottles: '',
    open_content: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const num = (v) => Number(String(v).replace(',', '.')) || 0
  const isPz = baseUnit(form.unit) === 'pz'
  const costNum = num(form.cost)
  // Contenuto per confezione nell'unità scelta (per il costo unitario).
  const packInUnit = !isPz ? num(form.package_size) : 0
  const initialBase = baseUnit(initUnit)

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const packBase = isPz ? null : toBaseQty(num(form.package_size), form.unit) || null
      const base = {
        name: form.name.trim(),
        unit: baseUnit(form.unit), // base in cui è salvato lo stock
        display_unit: form.unit, // unità scelta per inserimento/visualizzazione
        category_id: form.category_id || null,
        supplier_id: form.supplier_id || null,
        cost: form.cost === '' ? null : costNum,
        vat: Number(form.vat) || 0,
        status: form.status || 'linea',
        package_size: packBase,
        low_threshold: toBaseQty(num(form.low_threshold), form.unit),
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
          const size = packBase || 0
          const open = toBaseQty(num(form.open_content), form.unit)
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
          <label htmlFor="ivat">IVA acquisto %</label>
          <input id="ivat" type="number" step="any" min="0" value={form.vat} onChange={set('vat')} />
        </div>
      </div>
      {costNum > 0 && (
        <div className="muted small">
          +IVA {formatPrice(costWithVat(costNum, form.vat))}
          {packInUnit > 0 && ` · ${formatPrice(costWithVat(costNum, form.vat) / packInUnit)}/${form.unit}`}
        </div>
      )}

      <label htmlFor="istatus">Stato</label>
      <select id="istatus" value={form.status} onChange={set('status')}>
        {STATUS_ITEM.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <label htmlFor="iunit">Unità di misura</label>
      <select id="iunit" value={form.unit} onChange={set('unit')}>
        {[
          ['Liquidi', [['l', 'Litri (L)'], ['cl', 'Centilitri (cl)'], ['ml', 'Millilitri (ml)']]],
          ['Solidi', [['g', 'Grammi (g)'], ['mg', 'Milligrammi (mg)']]],
          ['Pezzi', [['pz', 'Pezzi (es. birre)']]],
        ].map(([grp, units]) => (
          <optgroup key={grp} label={grp}>
            {units.map(([u, label]) => (
              // In modifica si cambia solo dentro la stessa base (cl↔ml↔L):
              // passare a un'altra base reinterpreterebbe la giacenza salvata.
              <option key={u} value={u} disabled={isEdit && baseUnit(u) !== initialBase}>
                {label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {!isPz && (
        <>
          <label htmlFor="ipkg">Contenuto per confezione ({form.unit})</label>
          <input id="ipkg" type="number" step="any" min="0" value={form.package_size} onChange={set('package_size')} placeholder={`Es. ${form.unit === 'l' ? '1' : form.unit === 'cl' ? '100' : '1000'} per una bottiglia da 1 L`} />
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
            <input id="iopen" type="number" step="any" min="0" value={form.open_content} onChange={set('open_content')} placeholder={`Es. ${form.unit === 'l' ? '0,35' : form.unit === 'ml' ? '350' : '35'} se ne hai una già aperta`} />
          </>
        )
      )}

      <label htmlFor="ithr">Soglia di avviso ({form.unit})</label>
      <input id="ithr" type="number" step="any" min="0" value={form.low_threshold} onChange={set('low_threshold')} placeholder={`Es. ${form.unit === 'l' ? '0,2' : form.unit === 'cl' ? '20' : form.unit === 'mg' ? '2000' : form.unit === 'g' ? '100' : form.unit === 'pz' ? '2' : '200'}`} />

      <div className="grid-2" style={{ marginTop: 16 }}>
        <button type="button" className="btn ghost" onClick={onCancel} disabled={saving}>Annulla</button>
        <button type="submit" className="btn" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva'}</button>
      </div>
    </form>
  )
}

// Intestazione di colonna ORDINABILE della tabella inventario: un click ordina,
// il ri-click inverte; la freccia indica il verso attivo.
function SortTh({ label, col, sort, onSort, num = false }) {
  const active = sort.col === col
  return (
    <button
      type="button"
      className={`inv-th${num ? ' inv-cell-num' : ''}${active ? ' active' : ''}`}
      onClick={() => onSort(col)}
      title={`Ordina per ${label}`}
    >
      {label}
      <span aria-hidden className="inv-th-arrow">{active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
    </button>
  )
}
