import { useEffect, useRef } from 'react'

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
//   pieno: la coppia barra+contenuto sta TUTTA nello schermo e non fa
//          scorrere la pagina — scorrono i due pannelli, ognuno per conto
//          suo. Serve dove le voci sono tante (le impostazioni): per
//          arrivare all'ultima si scorreva la pagina intera, testata
//          compresa, e la barra spariva proprio mentre la si usava.
export default function CategoryRail({ items, selected, onSelect, children, pieno = false }) {
  const rif = useRef(null)

  // L'ALTEZZA SI MISURA, NON SI INDOVINA. Prima era un conto in CSS
  // (100dvh meno la testata, meno un margine): ma la testata cambia altezza
  // con lo zoom e col telefono, sotto c'è il piè di pagina, e il conto era
  // sempre un po' sbagliato — la pagina sforava e si scorreva lo stesso,
  // che è esattamente quello che si voleva togliere. Qui si guarda dove
  // comincia davvero il riquadro e cosa gli sta sotto.
  useEffect(() => {
    const el = rif.current
    if (!pieno || !el) return undefined
    const stretto = () => window.matchMedia('(max-width: 700px)').matches
    const calcola = () => {
      // Sul telefono la barra passa in orizzontale sopra al contenuto:
      // un'altezza fissa lo strozzerebbe in una finestrella.
      if (stretto()) {
        el.style.removeProperty('height')
        return
      }
      // `zoom` su #root: rect e innerHeight sono in pixel dello schermo,
      // l'altezza che scriviamo è in pixel della pagina zoomata.
      const z =
        Number(getComputedStyle(document.documentElement).getPropertyValue('--zoom')) || 1
      const mio = el.getBoundingClientRect()
      // QUANTO C'È SOTTO, misurato e non elencato: il piè di pagina, i 96px
      // di respiro in fondo alla pagina, e qualunque cosa ci si aggiunga
      // domani. Contando solo il piè di pagina la pagina sforava lo stesso —
      // di quei 96px, che nessuno si ricordava. La distanza fra il fondo del
      // riquadro e il fondo della pagina non cambia con l'altezza che gli
      // diamo, quindi la si può misurare prima.
      const sotto = Math.max(0, document.body.getBoundingClientRect().bottom - mio.bottom)
      const alto = (window.innerHeight - mio.top - sotto - 6) / z
      const nuova = `${Math.max(220, Math.floor(alto))}px`
      if (el.style.height !== nuova) el.style.height = nuova
    }
    calcola()
    window.addEventListener('resize', calcola)
    // Quello che sta SOPRA può cambiare (un avviso, la barra che si apre):
    // l'altezza va rifatta, se no torna a sforare.
    const osserva = new ResizeObserver(calcola)
    osserva.observe(document.body)
    return () => {
      window.removeEventListener('resize', calcola)
      osserva.disconnect()
    }
  }, [pieno])

  return (
    <div ref={rif} className={`cat-layout${pieno ? ' cat-pieno' : ''}`}>
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
