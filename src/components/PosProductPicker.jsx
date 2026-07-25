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
import { subscribePosPrefs, savePosOrder, savePosFavorites } from '../lib/api.js'

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
  // localStorage = cache locale immediata (funziona offline al primo avvio).
  useEffect(() => saveOrder(order), [order])
  useEffect(() => saveFavorites(favorites), [favorites])

  // SINCRONIZZAZIONE COL SERVER: l'arrangiamento vale per tutto il locale.
  // La sottoscrizione adotta il valore dal server (arriva anche dalla cache
  // Firestore offline); le scritture partono dagli edit dell'utente, in
  // background, quindi il server NON viene riscritto qui (niente loop).
  useEffect(
    () =>
      subscribePosPrefs((p) => {
        if (!p) return
        if (Array.isArray(p.order)) setOrder(p.order)
        if (Array.isArray(p.favorites)) setFavorites(p.favorites)
      }, () => {}),
    []
  )
  // Applica SUBITO in locale, poi sincronizza col server (offline si accoda).
  const commitOrder = (next) => {
    setOrder(next)
    savePosOrder(next).catch(() => {})
  }
  const commitFavorites = (next) => {
    setFavorites(next)
    savePosFavorites(next).catch(() => {})
  }
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

  // ── Riordino card dalla MANIGLIA (modalità riordino) ──
  // Sul touch "scorri col dito + long-press per spostare" sullo stesso
  // punto non è affidabile: il browser decide scroll o drag all'inizio del
  // tocco (touch-action) e non si torna indietro. Quindi si trascina da una
  // MANIGLIA dedicata (touch-action:none): il resto della card scorre
  // normalmente. Il riordino agisce sull'ordine GLOBALE, valido anche
  // filtrando per categoria.
  const [dragId, setDragId] = useState(null)
  const dragRef = useRef({ id: null, lastX: 0, lastY: 0, raf: 0, vy: 0 })
  // Dati sempre freschi per il ciclo di auto-scroll (che gira su una
  // closure vecchia): li legge da qui, non dalle variabili di render.
  const latest = useRef({})
  latest.current = { orderedAllIds, commitOrder }

  // Sposta l'item trascinato sopra la card che sta sotto al punto (x,y).
  const reorderAt = (x, y) => {
    const st = dragRef.current
    if (!st.id) return
    const el = document.elementFromPoint(x, y)
    const overId = el?.closest('[data-drink-id]')?.dataset.drinkId
    if (!overId || overId === st.id) return
    latest.current.commitOrder(moveInOrder(latest.current.orderedAllIds, st.id, overId))
  }

  // Ciclo di AUTO-SCROLL: mentre si trascina vicino a un bordo, la griglia
  // scorre da sola (così si può portare un item dal fondo alla cima). Legge
  // tutto da ref, quindi la closure "vecchia" resta valida.
  const autoScrollTick = () => {
    const st = dragRef.current
    if (!st.id) return
    const grid = gridRef.current
    if (grid && st.vy) {
      grid.scrollTop += st.vy
      reorderAt(st.lastX, st.lastY)
    }
    st.raf = requestAnimationFrame(autoScrollTick)
  }

  const startDrag = (e, id) => {
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ok */ }
    const st = dragRef.current
    st.id = id
    st.lastX = e.clientX
    st.lastY = e.clientY
    st.vy = 0
    setDragId(id)
    cancelAnimationFrame(st.raf)
    st.raf = requestAnimationFrame(autoScrollTick)
  }
  const moveDrag = (e) => {
    const st = dragRef.current
    if (!st.id) return
    e.preventDefault()
    st.lastX = e.clientX
    st.lastY = e.clientY
    // Velocità di scroll in base a quanto si entra nella fascia di bordo.
    const grid = gridRef.current
    if (grid) {
      const r = grid.getBoundingClientRect()
      const EDGE = 72
      if (e.clientY < r.top + EDGE) st.vy = -Math.ceil((r.top + EDGE - e.clientY) / 5)
      else if (e.clientY > r.bottom - EDGE) st.vy = Math.ceil((e.clientY - (r.bottom - EDGE)) / 5)
      else st.vy = 0
    }
    reorderAt(e.clientX, e.clientY)
  }
  const endDrag = () => {
    const st = dragRef.current
    cancelAnimationFrame(st.raf)
    st.id = null
    st.vy = 0
    st.raf = 0
    setDragId(null)
  }
  useEffect(() => () => cancelAnimationFrame(dragRef.current.raf), [])

  const toggleFav = (id) => commitFavorites(toggleFavorite(favorites, id))
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
                <span aria-hidden style={{ fontSize: '1.25em', lineHeight: 1 }}>{c.icon}</span>
              ) : (
                <span aria-hidden style={{ ...catDotStyle(catColor(c)), width: 16, height: 16 }} />
              )
            ) : (
              <>
                {/* icona (se scelta 'icona+testo' e la categoria ne ha una),
                    altrimenti il pallino colore; poi SEMPRE il nome. */}
                <span aria-hidden style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
                  {categoryDisplay === 'icon_text' && c.icon ? (
                    <span style={{ fontSize: '1.05em', lineHeight: 1 }}>{c.icon}</span>
                  ) : (
                    <span style={catDotStyle(catColor(c))} />
                  )}
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.name}
                </span>
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
              // Modalità riordino: si trascina dalla MANIGLIA in alto; il
              // resto della card scorre. Il tap non aggiunge.
              <div
                key={d.id}
                data-drink-id={d.id}
                className={`reorder-cell${dragId === d.id ? ' dragging' : ''}`}
              >
                <div
                  className="reorder-grip"
                  onPointerDown={(e) => startDrag(e, d.id)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  title="Trascina per spostare"
                  aria-label={`Trascina ${d.name}`}
                >
                  ⠿
                </div>
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
