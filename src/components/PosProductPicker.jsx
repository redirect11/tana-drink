import { useEffect, useRef, useState } from 'react'
import { DrinkTile } from './PosBits.jsx'
import { catBtnStyle } from '../lib/posStyles.js'
import { catColor, drinkCategoryColor } from '../lib/categoryColors.js'

// Colonna categorie + griglia prodotti (il "centro" dell'interfaccia POS,
// identico su cassa e dettaglio ordine, come nell'app SumUp). Toccando un
// prodotto lo si aggiunge alla comanda nel pannello di destra.
// `categoryDisplay`: 'dot' (pallino+testo), 'icon_text' o 'icon'.
export default function PosProductPicker({ drinks, cats, loading, qtyByDrink, onAdd, onSetQty, disabled = false, categoryDisplay = 'dot', catsHandleProps = null }) {
  const [selectedCat, setSelectedCat] = useState(null)
  const [query, setQuery] = useState('')
  const gridRef = useRef(null)

  useEffect(() => {
    if (cats.length > 0 && selectedCat === null) setSelectedCat('__all__')
  }, [cats, selectedCat])

  const catKey = (c) => c.id ?? c.name
  const q = query.trim().toLowerCase()
  // Con una ricerca attiva si cerca su TUTTO il catalogo (le categorie
  // servono a sfogliare; al banco la ricerca deve trovare subito).
  const visibleDrinks = q
    ? drinks.filter((d) => d.available && d.name?.toLowerCase().includes(q))
    : !selectedCat || selectedCat === '__all__'
      ? drinks.filter((d) => d.available)
      : drinks.filter(
          (d) => d.available && (d.category_id === selectedCat || d.category === selectedCat)
        )

  return (
    <>
      {/* Sidebar categorie: larghezza flessibile in base ai nomi (clamp
          min/max in CSS), non più fissa. */}
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
              // Solo icona: emoji della categoria (o pallino colorato se manca).
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

      {/* Maniglia fra categorie e griglia */}
      {catsHandleProps && <div className="posd-resize-handle" {...catsHandleProps} />}

      {/* Colonna centrale: ricerca + griglia prodotti */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '8px 8px 0', flexShrink: 0 }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Cerca prodotto…"
            aria-label="Cerca prodotto"
            style={{ width: '100%' }}
          />
        </div>
      <div
        ref={gridRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 8px',
          display: 'grid',
          // Colonne più larghe delle tile alte 104px: schede RETTANGOLARI
          // (larghe e basse), i nomi vanno meno a capo.
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          alignContent: 'start',
          gap: 8,
          opacity: disabled ? 0.5 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
        }}
      >
        {loading && <div className="empty" style={{ gridColumn: '1/-1' }}>Carico…</div>}
        {!loading && visibleDrinks.length === 0 && (
          <div className="empty" style={{ gridColumn: '1/-1' }}>Nessun prodotto in questa categoria.</div>
        )}
        {visibleDrinks.map((d) => (
          <DrinkTile
            key={d.id}
            drink={d}
            qty={qtyByDrink[d.id] ?? 0}
            color={drinkCategoryColor(d, cats)}
            onAdd={() => onAdd(d)}
            onSetQty={(nq) => onSetQty(d, nq)}
          />
        ))}
      </div>
      </div>
    </>
  )
}

// Pallino colore categoria: dimensione fissa e anello di contrasto, così è
// visibile anche quando il colore somiglia allo sfondo del tema.
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
