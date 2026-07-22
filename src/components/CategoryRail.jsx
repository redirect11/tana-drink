// CATEGORIE A SINISTRA, contenuto a destra — lo stesso schema del POS
// (PosProductPicker), riusato nel backoffice per Inventario e Menù così la
// navigazione per categoria è omogenea ovunque. Su schermo stretto la
// barra passa in orizzontale scorrevole sopra il contenuto.
//
//   items: [{ key, label, count }] — `count` opzionale
export default function CategoryRail({ items, selected, onSelect, children }) {
  return (
    <div className="cat-layout">
      <aside className="cat-rail">
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            className={`chip ${selected === it.key ? 'active' : ''}`}
            onClick={() => onSelect(it.key)}
            title={it.label}
          >
            <span className="cat-rail-label">{it.label}</span>
            {it.count != null && <span className="cat-rail-count">{it.count}</span>}
          </button>
        ))}
      </aside>
      <div className="cat-content">{children}</div>
    </div>
  )
}
