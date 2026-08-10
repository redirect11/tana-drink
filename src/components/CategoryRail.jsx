import { useState } from 'react'

// CATEGORIE A SINISTRA, contenuto a destra — lo stesso schema del POS
// (PosProductPicker), riusato nel backoffice per Inventario e Menù così la
// navigazione per categoria è omogenea ovunque. Su schermo stretto la
// barra passa in orizzontale scorrevole sopra il contenuto.
//
// La barra è A SCOMPARSA: si può nascondere per allargare il contenuto (utile
// per la vista tabellare dell'inventario). La scelta è ricordata per contesto.
//
//   items: [{ key, label, count, color, icon }] — `count`, `color` e `icon`
//          opzionali: col colore la voce porta il pallino della categoria,
//          esattamente come nel POS, così la stessa categoria si riconosce
//          allo stesso modo ovunque la si incontri.
//   storageKey: distingue la memoria del collasso (es. 'inventory' | 'menu')
export default function CategoryRail({ items, selected, onSelect, children, storageKey = 'cat' }) {
  const key = `tana:catrail:${storageKey}`
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) !== '0'
    } catch {
      return true
    }
  })
  const toggle = () =>
    setOpen((v) => {
      const nv = !v
      try {
        localStorage.setItem(key, nv ? '1' : '0')
      } catch {
        /* ok */
      }
      return nv
    })

  return (
    <div className={`cat-layout${open ? '' : ' cat-collapsed'}`}>
      {open ? (
        <aside className="cat-rail">
          <button
            type="button"
            className="chip cat-rail-hide"
            onClick={toggle}
            title="Nascondi le categorie (allarga la tabella)"
          >
            ⟨ Categorie
          </button>
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
      ) : (
        <button
          type="button"
          className="cat-rail-show"
          onClick={toggle}
          title="Mostra le categorie"
          aria-label="Mostra le categorie"
        >
          ☰
        </button>
      )}
      <div className="cat-content">{children}</div>
    </div>
  )
}
