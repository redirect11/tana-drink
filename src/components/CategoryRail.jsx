// CATEGORIE A SINISTRA, contenuto a destra — lo stesso schema del POS
// (PosProductPicker), riusato nel backoffice per Inventario e Menù così la
// navigazione per categoria è omogenea ovunque. Su schermo stretto la
// barra passa in orizzontale scorrevole sopra il contenuto.
//
// La barra sta SEMPRE lì. C'è stato un tasto per farla sparire e allargare il
// contenuto: sul telefono, dove le categorie sono già una riga che scorre, non
// serviva a niente, e in cambio si perdeva l'unico modo di girare tra le
// categorie. Se un giorno servisse davvero, la strada è un menu a scomparsa,
// non una barra che si nasconde.
//
//   items: [{ key, label, count, color, icon }] — `count`, `color` e `icon`
//          opzionali: col colore la voce porta il pallino della categoria,
//          esattamente come nel POS, così la stessa categoria si riconosce
//          allo stesso modo ovunque la si incontri.
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
            {(it.icon || it.color) && (
              <span aria-hidden className="cat-rail-segno">
                {it.icon || <span className="cat-rail-dot" style={{ background: it.color }} />}
              </span>
            )}
            <span className="cat-rail-label">{it.label}</span>
            {it.count != null && <span className="cat-rail-count">{it.count}</span>}
          </button>
        ))}
      </aside>
      <div className="cat-content">{children}</div>
    </div>
  )
}
