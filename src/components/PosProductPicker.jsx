import { useEffect, useRef, useState } from 'react'
import { DrinkTile } from './PosBits.jsx'
import { catBtnStyle } from '../lib/posStyles.js'
import { categoryColor, drinkCategoryColor } from '../lib/categoryColors.js'

// Colonna categorie + griglia prodotti (il "centro" dell'interfaccia POS,
// identico su cassa e dettaglio ordine, come nell'app SumUp). Toccando un
// prodotto lo si aggiunge alla comanda nel pannello di destra.
export default function PosProductPicker({ drinks, cats, loading, qtyByDrink, onAdd, onSetQty, disabled = false }) {
  const [selectedCat, setSelectedCat] = useState(null)
  const gridRef = useRef(null)

  useEffect(() => {
    if (cats.length > 0 && selectedCat === null) setSelectedCat('__all__')
  }, [cats, selectedCat])

  const catKey = (c) => c.id ?? c.name
  const visibleDrinks =
    !selectedCat || selectedCat === '__all__'
      ? drinks.filter((d) => d.available)
      : drinks.filter(
          (d) => d.available && (d.category_id === selectedCat || d.category === selectedCat)
        )

  return (
    <>
      {/* Sidebar categorie */}
      <aside
        style={{
          width: 104,
          flexShrink: 0,
          overflowY: 'auto',
          borderRight: '1px solid var(--line)',
          padding: '8px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <button onClick={() => setSelectedCat('__all__')} style={catBtnStyle(selectedCat === '__all__')}>
          Tutti
        </button>
        {cats.map((c) => (
          <button
            key={catKey(c)}
            onClick={() => {
              setSelectedCat(catKey(c))
              gridRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            style={catBtnStyle(selectedCat === catKey(c))}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: categoryColor(c.id ?? c.name),
                marginRight: 5,
                verticalAlign: 'baseline',
              }}
            />
            {c.name}
          </button>
        ))}
      </aside>

      {/* Griglia prodotti */}
      <div
        ref={gridRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 8px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          alignContent: 'start',
          gap: 10,
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
            onSetQty={(q) => onSetQty(d, q)}
          />
        ))}
      </div>
    </>
  )
}
