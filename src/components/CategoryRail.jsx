import { useState } from 'react'
import { usePaginaPiena } from '../lib/paginaPiena.js'

// CATEGORIE A SINISTRA, contenuto a destra — lo stesso schema del POS
// (PosProductPicker), riusato nel backoffice per Inventario, Menù e
// Impostazioni, così la navigazione per sezione è omogenea ovunque. Su
// schermo stretto la barra passa in orizzontale scorrevole sopra il
// contenuto.
//
// LA BARRA NON SPARISCE, SI STRINGE. C'è stato un tasto per farla sparire del
// tutto: si perdeva l'unico modo di girare fra le sezioni, e sul telefono —
// dove sono già una riga che scorre — non serviva a niente. Il modo giusto
// era l'altro: restare, ma occupare poco. Stretta resta solo l'icona, il
// nome torna sfiorandola col mouse (e nel titolo, per chi usa le dita).
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
//   chiave: dove ricordare "stretta o larga". Ogni pagina la sua: in
//          Inventario serve stretta (dentro c'è già una barra di categorie),
//          nelle Impostazioni di solito larga.
//   scorre: false quando il contenuto si arrangia da sé con lo scorrimento
//          (una lista lunga con la sua testata fissa): due barre di
//          scorrimento una dentro l'altra sono un modo per non trovare più
//          niente.
export default function CategoryRail({
  items,
  selected,
  onSelect,
  children,
  pieno = false,
  chiave = 'cat',
  scorre = true,
}) {
  const memoria = `tana:barra-stretta:${chiave}`
  const [stretta, setStretta] = useState(() => {
    try {
      return localStorage.getItem(memoria) === '1'
    } catch {
      return false
    }
  })
  const cambia = () =>
    setStretta((v) => {
      const nv = !v
      try {
        localStorage.setItem(memoria, nv ? '1' : '0')
      } catch {
        /* niente memoria: vale per questa volta */
      }
      return nv
    })

  // La schermata sta tutta nella finestra: vedi lib/paginaPiena.js.
  usePaginaPiena(pieno)

  // STRETTA VUOL DIRE A ICONE — ma solo se le icone ci sono. Dove le voci
  // non hanno né icona né colore (le categorie del magazzino, per dirne
  // una) stringendo restava una colonna di pastiglie grigie tutte uguali:
  // brutte e per giunta mute, perché non c'è modo di sapere quale sia
  // quale. Lì la barra si toglie di mezzo del tutto e resta solo il tasto
  // per riaprirla: le sezioni sono a un clic, invece che a un indovinello.
  const aIcone = items.length > 0 && items.every((it) => it.icon || it.color)
  const vociVisibili = stretta && !aIcone ? [] : items

  return (
    <div
      className={`cat-layout${pieno ? ' cat-pieno' : ''}${stretta ? ' cat-stretta' : ''}`}
    >
      <aside className="cat-rail">
        <button
          type="button"
          className="chip cat-rail-stringi"
          onClick={cambia}
          title={
            stretta
              ? aIcone
                ? 'Allarga il menu'
                : 'Mostra le sezioni'
              : aIcone
                ? 'Stringi il menu a icone'
                : 'Nascondi le sezioni'
          }
          aria-label={stretta ? 'Mostra le sezioni' : 'Nascondi le sezioni'}
        >
          {stretta ? '»' : '«'}
        </button>
        {vociVisibili.map((it) => (
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
      <div className={`cat-content${scorre ? '' : ' cat-content-fisso'}`}>{children}</div>
    </div>
  )
}
