import { useEffect, useMemo, useState } from 'react'
import {
  fetchDrinks,
  updateDrink,
  deleteDrink,
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  fetchInventoryItems,
} from '../lib/api.js'
import { formatPrice } from '../lib/orderStatus.js'
import { deleteDrinkImageByUrl } from '../lib/storage.js'
import { formatQty } from '../lib/inventory.js'
import MarginList from './MarginList.jsx'
import DrinkForm from './DrinkForm.jsx'
import { saveDrinkFromForm } from '../lib/saveDrink.js'
import CategoryRail from './CategoryRail.jsx'
import { CATEGORY_ICONS, catColor } from '../lib/categoryColors.js'

const EMPTY = {
  name: '',
  description: '',
  category_id: '',
  price: '',
  recipe: '',
  available: true,
  image_url: null,
  recipe_items: [],
}

export default function MenuManager() {
  const [drinks, setDrinks] = useState([])
  const [categories, setCategories] = useState([])
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // null | 'new' | drink object
  const [showCats, setShowCats] = useState(false)
  // Filtri della lista (catalogo grande: ricerca + categoria + disponibilità).
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all') // 'all' | 'none' | categoryId
  const [availFilter, setAvailFilter] = useState('all') // 'all' | 'yes' | 'no'
  const [showMargini, setShowMargini] = useState(false)
  const [collapsed, setCollapsed] = useState(() => new Set()) // categorie chiuse
  const [openId, setOpenId] = useState(null) // card con azioni aperte

  const catName = (id) => categories.find((c) => c.id === id)?.name

  async function load() {
    setLoading(true)
    try {
      const [d, c, inv] = await Promise.all([
        fetchDrinks(),
        fetchCategories(),
        fetchInventoryItems().catch(() => []), // l'inventario richiede auth: in caso fallisca, lista vuota
      ])
      setDrinks(d)
      setCategories(c)
      setInventory(inv)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Crea una categoria al volo dal form drink e la restituisce.
  async function handleCreateCategory(name) {
    const cat = await createCategory({ name, sort_order: categories.length })
    setCategories((prev) => [...prev, cat].sort((a, b) => a.sort_order - b.sort_order))
    return cat
  }

  async function handleSave(form) {
    setError(null)
    try {
      await saveDrinkFromForm({
        form,
        existing: editing && editing !== 'new' ? editing : null,
        inventory,
        categories,
      })
      setEditing(null)
      await load()
    } catch (e) {
      setError(e.message)
      throw e
    }
  }

  async function toggleAvailable(d) {
    try {
      await updateDrink(d.id, { available: !d.available })
      setDrinks((prev) =>
        prev.map((x) => (x.id === d.id ? { ...x, available: !x.available } : x))
      )
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDelete(d) {
    if (!confirm(`Eliminare “${d.name}” dal menù?`)) return
    try {
      await deleteDrink(d.id)
      if (d.image_url) deleteDrinkImageByUrl(d.image_url)
      setDrinks((prev) => prev.filter((x) => x.id !== d.id))
    } catch (e) {
      setError(e.message)
    }
  }

  // Drink che passano ricerca + disponibilità (la categoria filtra a parte,
  // così i chip possono mostrare i conteggi reali per ogni categoria).
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase()
    return drinks.filter((d) => {
      if (availFilter === 'yes' && !d.available) return false
      if (availFilter === 'no' && d.available) return false
      if (!q) return true
      return (
        d.name?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        (catName(d.category_id) || d.category || '').toLowerCase().includes(q) ||
        d.recipe_items?.some((r) => r.name?.toLowerCase().includes(q))
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drinks, categories, search, availFilter])

  // Conteggi per i chip (su `searched`, prima del filtro categoria).
  const counts = useMemo(() => {
    const m = { all: searched.length, none: 0 }
    for (const d of searched) {
      const key = d.category_id || 'none'
      m[key] = (m[key] || 0) + 1
    }
    return m
  }, [searched])

  // Voci per la barra categorie a sinistra (come nel POS).
  const catItems = useMemo(
    () => [
      { key: 'all', label: 'Tutte', count: counts.all },
      ...categories
        .filter((c) => counts[c.id])
        .map((c) => ({ key: c.id, label: c.name, count: counts[c.id] })),
      ...(counts.none ? [{ key: 'none', label: 'Senza categoria', count: counts.none }] : []),
    ],
    [categories, counts]
  )

  // Applica il filtro categoria e raggruppa per categoria (ordine categorie).
  const groups = useMemo(() => {
    const inCat = searched.filter((d) => {
      if (catFilter === 'all') return true
      if (catFilter === 'none') return !d.category_id
      return d.category_id === catFilter
    })
    const byCat = new Map()
    for (const d of inCat) {
      const cat = categories.find((c) => c.id === d.category_id)
      const name = cat?.name || d.category || 'Senza categoria'
      const sort = cat ? cat.sort_order : 9998
      const id = d.category_id || 'none'
      if (!byCat.has(id)) byCat.set(id, { id, name, sort, list: [] })
      byCat.get(id).list.push(d)
    }
    return [...byCat.values()].sort(
      (a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name)
    )
  }, [searched, categories, catFilter])

  function toggleCollapse(id) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (editing) {
    return (
      <DrinkForm
        initial={editing === 'new' ? EMPTY : editing}
        categories={categories}
        inventory={inventory}
        onCreateCategory={handleCreateCategory}
        onCancel={() => setEditing(null)}
        onSave={handleSave}
      />
    )
  }

  const searching = search.trim().length > 0
  const availCount = drinks.filter((d) => d.available).length

  return (
    <div>
      <button className="btn block" onClick={() => setEditing('new')}>
        + Aggiungi prodotto
      </button>

      <button
        className="btn ghost small block"
        style={{ marginTop: 8 }}
        onClick={() => setShowCats((v) => !v)}
      >
        {showCats ? 'Nascondi categorie' : `🏷 Gestisci categorie (${categories.length})`}
      </button>
      {showCats && (
        <CategoryManager
          categories={categories}
          onChange={async () => setCategories(await fetchCategories())}
        />
      )}

      {/* Marginalità: quali drink rendono meno di quanto dovrebbero. */}
      <button
        className="btn ghost small block"
        style={{ marginTop: 8 }}
        onClick={() => setShowMargini((v) => !v)}
      >
        {showMargini ? 'Nascondi marginalità' : '📊 Marginalità del listino'}
      </button>
      {showMargini && (
        <MarginList
          drinks={drinks}
          inventory={inventory}
          onEdit={(id) => setEditing(drinks.find((d) => d.id === id) || null)}
        />
      )}

      {error && <div className="banner">Errore: {error}</div>}
      {loading && <div className="empty">Carico il menù…</div>}

      {!loading && drinks.length > 0 && (
        <>
          <input
            type="search"
            className="menu-search"
            placeholder="🔍 Cerca drink, ingrediente, categoria…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginTop: 10 }}
          />

          {/* Filtro disponibilità */}
          <div className="mode-choice" style={{ marginBottom: 8 }}>
            {[
              ['all', `Tutti (${drinks.length})`],
              ['yes', `Disponibili (${availCount})`],
              ['no', `Non disp. (${drinks.length - availCount})`],
            ].map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={`mode-option${availFilter === v ? ' active' : ''}`}
                onClick={() => setAvailFilter(v)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Categorie a SINISTRA (come il POS), i drink a destra. */}
      {!loading && drinks.length > 0 && (
      <CategoryRail items={catItems} selected={catFilter} onSelect={setCatFilter} storageKey="menu">

      {groups.length === 0 && (
        <div className="empty">Nessun drink per «{search}».</div>
      )}

      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.id) && !searching
        return (
          <section key={g.id} style={{ marginTop: 12 }}>
            <h3
              className="cat-header menu-admin-cat"
              onClick={() => toggleCollapse(g.id)}
            >
              <span>{isCollapsed ? '▸' : '▾'} {g.name}</span>
              <span className="muted small">{g.list.length}</span>
            </h3>
            {/* Card compatte in griglia (stessa UX delle card ordini):
                nome+prezzo a vista, azioni a scomparsa con «⋯». */}
            {!isCollapsed && (
              <div className="admin-grid">
                {g.list.map((d) => {
                  const open = openId === d.id
                  return (
                    <div
                      className={`card grid-card admin-card${d.available ? '' : ' off'}`}
                      key={d.id}
                    >
                      <div
                        className="grid-card-main"
                        role="button"
                        tabIndex={0}
                        onClick={() => setOpenId(open ? null : d.id)}
                      >
                        <div className="row between" style={{ alignItems: 'flex-start', gap: 6 }}>
                          <strong style={{ fontSize: '0.92rem', lineHeight: 1.25 }}>{d.name}</strong>
                          {!d.available && <span className="pill ritirato">off</span>}
                        </div>
                        <div className="row between" style={{ alignItems: 'baseline' }}>
                          <span className="muted small">
                            {d.recipe_items?.length > 0 ? `${d.recipe_items.length} ingr.` : ''}
                          </span>
                          <span className="grid-card-tot">{formatPrice(d.price)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="grid-card-toggle"
                        onClick={() => setOpenId(open ? null : d.id)}
                        aria-expanded={open}
                      >
                        {open ? '▴ Chiudi' : '⋯ Azioni'}
                      </button>
                      {open && (
                        <div className="grid-card-actions">
                          {d.recipe_items && d.recipe_items.length > 0 && (
                            <p className="muted small" style={{ margin: '0 0 6px' }}>
                              {d.recipe_items.map((r) => `${r.name} ${formatQty(r.qty, r.unit)}`).join(' · ')}
                            </p>
                          )}
                          <button className="btn secondary small block" onClick={() => setEditing(d)}>
                            ✏️ Modifica
                          </button>
                          <button
                            className="btn ghost small block"
                            style={{ marginTop: 6 }}
                            onClick={() => toggleAvailable(d)}
                          >
                            {d.available ? 'Rendi non disp.' : 'Rendi disponibile'}
                          </button>
                          <button
                            className="btn ghost small block"
                            style={{ marginTop: 6 }}
                            onClick={() => handleDelete(d)}
                          >
                            🗑 Elimina
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}

      </CategoryRail>
      )}

      {!loading && drinks.length === 0 && (
        <div className="empty">Nessun drink nel menù. Aggiungine uno!</div>
      )}
    </div>
  )
}

// --- Gestione categorie -------------------------------------------------

function CategoryManager({ categories, onChange }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await createCategory({ name: name.trim(), sort_order: categories.length })
      setName('')
      await onChange()
    } finally {
      setBusy(false)
    }
  }

  async function rename(cat) {
    const n = prompt('Nuovo nome categoria:', cat.name)
    if (n == null || !n.trim()) return
    await updateCategory(cat.id, { name: n.trim() })
    await onChange()
  }

  async function remove(cat) {
    if (!confirm(`Eliminare la categoria “${cat.name}”? I drink resteranno, ma senza categoria.`)) return
    await deleteCategory(cat.id)
    await onChange()
  }

  // Scambia l'ordine con il vicino (su/giù).
  async function move(idx, dir) {
    const j = idx + dir
    if (j < 0 || j >= categories.length) return
    const a = categories[idx]
    const b = categories[j]
    await Promise.all([
      updateCategory(a.id, { sort_order: b.sort_order }),
      updateCategory(b.id, { sort_order: a.sort_order }),
    ])
    await onChange()
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row" style={{ gap: 8 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nuova categoria"
        />
        <button className="btn small" onClick={add} disabled={busy}>
          Aggiungi
        </button>
      </div>
      {categories.length === 0 && (
        <div className="muted" style={{ marginTop: 8, fontSize: '0.85rem' }}>
          Nessuna categoria.
        </div>
      )}
      {categories.map((c, idx) => (
        <div key={c.id} style={{ marginTop: 8, borderTop: idx ? '1px solid var(--line)' : 'none', paddingTop: idx ? 8 : 0 }}>
          <div className="row between">
            <span className="row" style={{ gap: 6, alignItems: 'center' }}>
              <span aria-hidden style={{ fontSize: '1.1rem', width: 20, textAlign: 'center' }}>
                {c.icon || '•'}
              </span>
              {c.name}
            </span>
            <span className="row" style={{ gap: 4 }}>
              <button className="btn ghost small" onClick={() => move(idx, -1)} disabled={idx === 0}>↑</button>
              <button className="btn ghost small" onClick={() => move(idx, 1)} disabled={idx === categories.length - 1}>↓</button>
              <button className="btn ghost small" onClick={() => rename(c)}>✏️</button>
              <button className="btn ghost small" onClick={() => remove(c)}>🗑</button>
            </span>
          </div>
          {/* Icona (set di emoji) + colore per la categoria */}
          <div className="chips-row" style={{ marginTop: 6 }}>
            <button
              className={`chip ${!c.icon ? 'active' : ''}`}
              title="Nessuna icona"
              onClick={() => updateCategory(c.id, { icon: null }).then(onChange)}
            >
              ∅
            </button>
            {CATEGORY_ICONS.map((ic) => (
              <button
                key={ic}
                className={`chip ${c.icon === ic ? 'active' : ''}`}
                onClick={() => updateCategory(c.id, { icon: ic }).then(onChange)}
              >
                {ic}
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 6, alignItems: 'center' }}>
            <span className="muted small">Colore</span>
            <input
              type="color"
              value={c.color || catColor(c)}
              onChange={(e) => updateCategory(c.id, { color: e.target.value }).then(onChange)}
              style={{ width: 40, height: 28, padding: 0, border: 'none', background: 'none' }}
            />
            {c.color && (
              <button className="btn ghost small" onClick={() => updateCategory(c.id, { color: null }).then(onChange)}>
                Auto
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
