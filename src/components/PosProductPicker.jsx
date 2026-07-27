import { useEffect, useMemo, useRef, useState } from 'react'
import { DrinkTile } from './PosBits.jsx'
import { catBtnStyle } from '../lib/posStyles.js'
import { catColor, drinkCategoryColor, CATEGORY_PALETTE } from '../lib/categoryColors.js'
import {
  applyOrder,
  moveInOrder,
  toggleFavorite,
  loadOrder,
  saveOrder,
  loadFavorites,
  saveFavorites,
  loadColors,
  saveColors,
} from '../lib/posCatalog.js'
import { subscribePosPrefs, savePosOrder, savePosFavorites, savePosColors } from '../lib/api.js'

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
  const [tileColors, setTileColors] = useState(() => loadColors())
  const [reordering, setReordering] = useState(false)
  const [menuDrink, setMenuDrink] = useState(null) // MENU del singolo prodotto
  const gridRef = useRef(null)

  // Le card (e il loro testo) seguono la larghezza della colonna centrale, che
  // cambia quando si ridimensionano le colonne laterali. Vale in creazione e in
  // modifica (stesso picker).
  const [gridW, setGridW] = useState(0)
  useEffect(() => {
    const el = gridRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => setGridW(Math.round(entries[0].contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const GRID_GAP = 8
  // Base più grande (leggibile su iPad): il minimo parte alto e cresce con la
  // larghezza del centro.
  const tileScale = gridW ? Math.max(1.05, Math.min(1.5, gridW / 440)) : 1.05
  // Card più grandi ma SEMPRE almeno 3 per riga: la min-width non supera mai un
  // terzo della larghezza disponibile.
  const tileMin = gridW
    ? Math.max(112, Math.min(Math.round(172 * tileScale), Math.floor((gridW - 2 * GRID_GAP) / 3)))
    : 172

  useEffect(() => {
    if (cats.length > 0 && selectedCat === null) setSelectedCat('__all__')
  }, [cats, selectedCat])
  // localStorage = cache locale immediata (funziona offline al primo avvio).
  useEffect(() => saveOrder(order), [order])
  useEffect(() => saveFavorites(favorites), [favorites])
  useEffect(() => saveColors(tileColors), [tileColors])

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
        if (p.colors && typeof p.colors === 'object' && !Array.isArray(p.colors)) setTileColors(p.colors)
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
  // Colore del tab di un prodotto: null/assente = colore della categoria.
  const setTileColor = (id, color) => {
    const next = { ...tileColors }
    if (color) next[id] = color
    else delete next[id]
    setTileColors(next)
    savePosColors(next).catch(() => {})
  }
  const tileColor = (d) => tileColors[d.id] || drinkCategoryColor(d, cats)
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

  // Etichetta categoria: una riga sola, si accorcia con l'ellissi (mai a capo).
  const catLabel = { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

  return (
    <>
      <aside className="posd-cats">
        <button onClick={() => setSelectedCat('__all__')} style={catBtnStyle(selectedCat === '__all__')} title="Tutti">
          {categoryDisplay === 'icon' ? (
            <span aria-hidden style={{ fontSize: '1.25em' }}>▦</span>
          ) : (
            <>
              <span aria-hidden style={catDotStyle(null)} />
              <span style={catLabel}>Tutti</span>
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
              <span aria-hidden style={{ fontSize: '1.2em' }}>{sc.label.slice(0, 2)}</span>
            ) : (
              <span style={catLabel}>{sc.label}</span>
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

      {/* Colonna centrale: ricerca (+ riordino in "Tutti") + griglia. minHeight:0
          è essenziale: senza, su mobile (posd-body in colonna) questo contenitore
          cresce col contenuto e la griglia non scrolla (bug flexbox classico). */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
              title="Trascina dalla maniglia per spostare · tocca una card per il menu prodotto (colore)"
              style={{ flexShrink: 0 }}
            >
              {reordering ? '✓ Fine' : '↕ Organizza'}
            </button>
          )}
        </div>
        <div
          ref={gridRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '10px 8px',
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${tileMin}px, 1fr))`,
            alignContent: 'start',
            gap: GRID_GAP,
            // il font-size della griglia guida i testi em delle card
            fontSize: `${tileScale}rem`,
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
              // Modalità ORGANIZZA: si trascina dalla MANIGLIA in alto per
              // spostare; toccando la card si apre il MENU del prodotto (colore).
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
                  color={tileColor(d)}
                  onAdd={() => setMenuDrink(d)}
                  onSetQty={() => {}}
                />
              </div>
            ) : (
              <DrinkTile
                key={d.id}
                drink={d}
                qty={qtyByDrink[d.id] ?? 0}
                color={tileColor(d)}
                favorite={favSet.has(d.id)}
                onToggleFav={() => toggleFav(d.id)}
                onAdd={() => onAdd(d)}
                onSetQty={(nq) => onSetQty(d, nq)}
              />
            )
          )}
        </div>
      </div>

      {/* ── MENU del singolo prodotto (in Organizza): cambio colore del tab ── */}
      {menuDrink && (
        <div className="overlay confirm-overlay" onClick={() => setMenuDrink(null)}>
          <div
            className="confirm-box"
            role="dialog"
            aria-label={`Menu ${menuDrink.name}`}
            style={{ width: 'min(360px, 94vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row between" style={{ alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{menuDrink.name}</h3>
              <button className="btn ghost small" onClick={() => setMenuDrink(null)}>✕</button>
            </div>
            <p className="muted small" style={{ margin: '8px 0' }}>Colore del tab</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
              {CATEGORY_PALETTE.map((c) => {
                const active = (tileColors[menuDrink.id] || '').toLowerCase() === c.toLowerCase()
                return (
                  <button
                    key={c}
                    aria-label={`Colore ${c}`}
                    onClick={() => setTileColor(menuDrink.id, c)}
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      borderRadius: 8,
                      background: c,
                      border: active ? '3px solid var(--text)' : '1px solid var(--line)',
                      cursor: 'pointer',
                    }}
                  />
                )
              })}
            </div>
            <button
              className="btn ghost small block"
              style={{ marginTop: 12 }}
              onClick={() => setTileColor(menuDrink.id, null)}
            >
              ↩︎ Colore della categoria (default)
            </button>
          </div>
        </div>
      )}
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
