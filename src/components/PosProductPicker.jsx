import { useEffect, useMemo, useRef, useState } from 'react'
import { DrinkTile } from './PosBits.jsx'
import { catBtnStyle } from '../lib/posStyles.js'
import { catColor, drinkCategoryColor } from '../lib/categoryColors.js'
import {
  applyOrder,
  moveInOrder,
  toggleFavorite,
  loadOrder,
  saveOrder,
  loadFavorites,
  saveFavorites,
} from '../lib/posCatalog.js'

// Colonna categorie + griglia prodotti (il "centro" del POS). Oltre alle
// categorie ci sono due raccolte speciali: ⭐ Preferiti (i drink che il
// bartender fissa in alto) e 🕘 Recenti (gli ultimi item ordinati, passati
// via `recentIds`). In "Tutti" le card si RIORDINANO col drag (attivando la
// modalità riordino) e l'ordine è ricordato per dispositivo.
export default function PosProductPicker({
  drinks,
  cats,
  loading,
  qtyByDrink,
  onAdd,
  onSetQty,
  disabled = false,
  categoryDisplay = 'dot',
  catsHandleProps = null,
  recentIds = [],
}) {
  const [selectedCat, setSelectedCat] = useState(null)
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState(() => loadOrder())
  const [favorites, setFavorites] = useState(() => loadFavorites())
  const [reordering, setReordering] = useState(false)
  const gridRef = useRef(null)

  useEffect(() => {
    if (cats.length > 0 && selectedCat === null) setSelectedCat('__all__')
  }, [cats, selectedCat])
  useEffect(() => saveOrder(order), [order])
  useEffect(() => saveFavorites(favorites), [favorites])
  const catKey = (c) => c.id ?? c.name
  const favSet = useMemo(() => new Set(favorites), [favorites])
  const byId = useMemo(() => new Map((drinks || []).map((d) => [d.id, d])), [drinks])
  const q = query.trim().toLowerCase()

  // ORDINE GLOBALE: una sola sequenza per tutti i drink. Le categorie non
  // riordinano da sole — filtrano soltanto questa sequenza, così lo stesso
  // ordinamento vale ovunque (una birra spostata in "Tutti" resta prima
  // delle altre anche filtrando per Birre).
  const availableAll = useMemo(() => (drinks || []).filter((d) => d.available), [drinks])
  const orderedAll = useMemo(() => applyOrder(availableAll, order), [availableAll, order])
  const orderedAllIds = useMemo(() => orderedAll.map((d) => d.id), [orderedAll])

  const inCat = (d) => d.category_id === selectedCat || d.category === selectedCat
  const visibleDrinks = useMemo(() => {
    if (q) return orderedAll.filter((d) => d.name?.toLowerCase().includes(q))
    if (selectedCat === '__recent__') {
      return recentIds.map((id) => byId.get(id)).filter((d) => d && d.available)
    }
    if (selectedCat === '__fav__') return orderedAll.filter((d) => favSet.has(d.id))
    if (!selectedCat || selectedCat === '__all__') return orderedAll
    return orderedAll.filter(inCat)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, orderedAll, selectedCat, favSet, recentIds, byId])

  // ── Riordino card per LONG-PRESS + DRAG (modalità riordino) ──
  // Tenendo premuto (~300ms) su una card parte il trascinamento; muovendo
  // prima dello scatto è uno scroll e non si sposta nulla. Il riordino
  // agisce sull'ordine GLOBALE, così vale anche filtrando per categoria.
  const [dragId, setDragId] = useState(null)
  const dragRef = useRef({ id: null, timer: null, active: false, startX: 0, startY: 0, el: null, pointerId: null })
  const startDrag = (e, id) => {
    const st = dragRef.current
    st.id = id
    st.active = false
    st.startX = e.clientX
    st.startY = e.clientY
    st.el = e.currentTarget
    st.pointerId = e.pointerId
    clearTimeout(st.timer)
    st.timer = setTimeout(() => {
      st.active = true
      setDragId(id)
      try { st.el.setPointerCapture(st.pointerId) } catch { /* ok */ }
    }, 300)
  }
  const moveDrag = (e) => {
    const st = dragRef.current
    if (!st.id) return
    if (!st.active) {
      // Mosso troppo prima dello scatto → scroll: annulla il long-press.
      if (Math.abs(e.clientX - st.startX) > 8 || Math.abs(e.clientY - st.startY) > 8) {
        clearTimeout(st.timer)
        st.id = null
      }
      return
    }
    e.preventDefault()
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const overId = el?.closest('[data-drink-id]')?.dataset.drinkId
    if (!overId || overId === st.id) return
    setOrder(moveInOrder(orderedAllIds, st.id, overId))
  }
  const endDrag = () => {
    const st = dragRef.current
    clearTimeout(st.timer)
    st.id = null
    st.active = false
    setDragId(null)
  }

  const toggleFav = (id) => setFavorites((f) => toggleFavorite(f, id))
  // Riordino disponibile ovunque tranne Recenti (ordine per recenza) e in
  // ricerca; con l'ordine globale, filtrare per categoria lo preserva.
  const canReorder = reordering && selectedCat !== '__recent__' && !q

  // Voci della barra: Preferiti e Recenti in cima, poi le categorie.
  const specialCats = [
    ...(favorites.length ? [{ key: '__fav__', label: '⭐ Preferiti', count: favorites.length }] : []),
    ...(recentIds.length ? [{ key: '__recent__', label: '🕘 Recenti', count: recentIds.length }] : []),
  ]

  return (
    <>
      <aside className="posd-cats">
        <button onClick={() => setSelectedCat('__all__')} style={catBtnStyle(selectedCat === '__all__')} title="Tutti">
          {categoryDisplay === 'icon' ? (
            <span aria-hidden style={{ fontSize: '1.25rem' }}>▦</span>
          ) : (
            <>
              <span aria-hidden style={catDotStyle(null)} />
              <span>Tutti</span>
            </>
          )}
        </button>
        {specialCats.map((sc) => (
          <button
            key={sc.key}
            onClick={() => setSelectedCat(sc.key)}
            style={catBtnStyle(selectedCat === sc.key)}
            title={sc.label}
          >
            {categoryDisplay === 'icon' ? (
              <span aria-hidden style={{ fontSize: '1.2rem' }}>{sc.label.slice(0, 2)}</span>
            ) : (
              <span>{sc.label}</span>
            )}
          </button>
        ))}
        {cats.map((c) => (
          <button
            key={catKey(c)}
            title={c.name}
            onClick={() => {
              setSelectedCat(catKey(c))
              gridRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            style={catBtnStyle(selectedCat === catKey(c))}
          >
            {categoryDisplay === 'icon' ? (
              c.icon ? (
                <span aria-hidden style={{ fontSize: '1.25rem' }}>{c.icon}</span>
              ) : (
                <span aria-hidden style={{ ...catDotStyle(catColor(c)), width: 16, height: 16 }} />
              )
            ) : categoryDisplay === 'icon_text' ? (
              <>
                <span aria-hidden>{c.icon || <span style={catDotStyle(catColor(c))} />}</span>
                <span style={{ minWidth: 0 }}>{c.name}</span>
              </>
            ) : (
              <>
                <span aria-hidden style={catDotStyle(catColor(c))} />
                <span style={{ minWidth: 0 }}>{c.name}</span>
              </>
            )}
          </button>
        ))}
      </aside>

      {catsHandleProps && <div className="posd-resize-handle" {...catsHandleProps} />}

      {/* Colonna centrale: ricerca (+ riordino in "Tutti") + griglia */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '8px 8px 0', display: 'flex', gap: 8, flexShrink: 0 }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Cerca prodotto…"
            aria-label="Cerca prodotto"
            style={{ flex: 1 }}
          />
          {selectedCat !== '__recent__' && !q && (
            <button
              className={`chip ${reordering ? 'active' : ''}`}
              onClick={() => setReordering((v) => !v)}
              title="Tieni premuto su una card e trascinala per riordinare"
              style={{ flexShrink: 0 }}
            >
              {reordering ? '✓ Fine' : '↕ Riordina'}
            </button>
          )}
        </div>
        <div
          ref={gridRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 8px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            alignContent: 'start',
            gap: 8,
            opacity: disabled ? 0.5 : 1,
            pointerEvents: disabled ? 'none' : 'auto',
          }}
        >
          {loading && <div className="empty" style={{ gridColumn: '1/-1' }}>Carico…</div>}
          {!loading && visibleDrinks.length === 0 && (
            <div className="empty" style={{ gridColumn: '1/-1' }}>
              {selectedCat === '__fav__'
                ? 'Nessun preferito: tocca la ☆ su un prodotto per fissarlo qui.'
                : selectedCat === '__recent__'
                  ? 'Ancora nessun item ordinato di recente.'
                  : 'Nessun prodotto in questa categoria.'}
            </div>
          )}
          {visibleDrinks.map((d) =>
            canReorder ? (
              // Modalità riordino: tieni premuto e trascina; il tap non
              // aggiunge. Lo scroll verticale resta libero (pan-y).
              <div
                key={d.id}
                data-drink-id={d.id}
                onPointerDown={(e) => startDrag(e, d.id)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                style={{
                  touchAction: 'pan-y',
                  cursor: 'grab',
                  opacity: dragId === d.id ? 0.5 : 1,
                  boxShadow: dragId === d.id ? '0 6px 18px rgba(0,0,0,0.4)' : 'none',
                  borderRadius: 12,
                }}
              >
                <DrinkTile
                  drink={d}
                  qty={qtyByDrink[d.id] ?? 0}
                  color={drinkCategoryColor(d, cats)}
                  onAdd={() => {}}
                  onSetQty={() => {}}
                />
              </div>
            ) : (
              <DrinkTile
                key={d.id}
                drink={d}
                qty={qtyByDrink[d.id] ?? 0}
                color={drinkCategoryColor(d, cats)}
                favorite={favSet.has(d.id)}
                onToggleFav={() => toggleFav(d.id)}
                onAdd={() => onAdd(d)}
                onSetQty={(nq) => onSetQty(d, nq)}
              />
            )
          )}
        </div>
      </div>
    </>
  )
}

// Pallino colore categoria: dimensione fissa e anello di contrasto.
function catDotStyle(color) {
  return {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
    background: color || 'transparent',
    boxShadow: color ? '0 0 0 1.5px var(--line)' : 'none',
  }
}
