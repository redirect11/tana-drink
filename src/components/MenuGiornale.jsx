import { useEffect, useRef, useState } from 'react'
import { ingredientiInCarta } from '../lib/ingredientiCarta.js'
import { formatPrice } from '../lib/orderStatus.js'

// ── LO STILE «GIORNALE»: IL MENÙ COME UNA PRIMA PAGINA (REQ-MENU-024) ──
// L'utente, 02/11/2026: «gli stili però devono avere anche UX diverse e
// immagini diverse da quelle proposte per la tana», e «basta che sia figa e
// fluida la UX». Non una veste sopra le card del menù classico: un giornale.
//   · la TESTATA: il nome del locale come una testata, coi filetti e la
//     riga dell'edizione con la data;
//   · il SOMMARIO: le categorie in una barra che resta agganciata mentre si
//     scorre, segna la sezione in cui si è, e ci porta scorrendo;
//   · la PRIMA PAGINA: il primo Special come articolo d'apertura (titolo
//     grande, incisione, capolettera), gli altri «In breve»;
//   · le SEZIONI: ogni categoria è una sezione del giornale, con le voci in
//     colonna, senza immagini — un quotidiano non mette la foto a ogni riga.
// Le immagini sono incisioni (lib/illustrazioneDrink.js, segno
// «incisione»), non i disegni della Tana. I gesti sono quelli di sempre:
// «Aggiungi» e il carrello (tastiOrdine), il dettaglio toccando il nome.

const dataEdizione = (quando = new Date()) =>
  quando.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

const ancora = (cat) => `sez-${encodeURIComponent(cat)}`
const nessunMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function TestataGiornale({ venue, sottotitolo }) {
  return (
    <header className="g-testata">
      <p className="g-edizione">
        <span>Edizione della sera</span>
        <span>{dataEdizione()}</span>
      </p>
      <h1 className="g-nome">{venue.venue_name}</h1>
      {sottotitolo && <p className="g-motto">{sottotitolo}</p>}
    </header>
  )
}

function Articolo({ d, immagine, apri, tastiOrdine, quantita, apertura = false }) {
  const img = immagine(d)
  const ingredienti = ingredientiInCarta(d, { quantita })
  return (
    <article className={apertura ? 'g-apertura' : 'g-breve'}>
      {apertura && <p className="g-occhiello">In prima pagina</p>}
      <h2 className="g-titolo">
        <button type="button" onClick={() => apri(d)}>
          {d.name}
        </button>
      </h2>
      {img && (
        <figure className="g-figura">
          <img src={img} alt="" loading="lazy" />
          {apertura && <figcaption>Fig. 1 — {d.name}, come esce dal banco.</figcaption>}
        </figure>
      )}
      {/* Il capolettera solo su un testo che lo regge: su una riga sola la
          lettera grande si staccava dal resto e sembrava un errore. */}
      {d.description && (
        <p className={apertura && d.description.length > 110 ? 'g-testo g-capolettera' : 'g-testo'}>{d.description}</p>
      )}
      {ingredienti && <p className="g-ingredienti">Si compone di: {ingredienti.join(', ')}.</p>}
      <div className="g-chiusa">
        <span className="g-prezzo">{formatPrice(d.price)}</span>
        {tastiOrdine(d)}
      </div>
    </article>
  )
}

export default function MenuGiornale({ categorie, speciali, immagine, apri, tastiOrdine, quantita = false, soloSpeciali = false }) {
  const [attiva, setAttiva] = useState(categorie[0]?.[0] || null)
  const sezioni = useRef({})

  // IL SOMMARIO SEGUE LA LETTURA: la sezione evidenziata è quella che si
  // ha sotto gli occhi, non l'ultima toccata.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined
    const osserva = new IntersectionObserver(
      (voci) => {
        const vista = voci.filter((v) => v.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (vista) setAttiva(vista.target.dataset.cat)
      },
      { rootMargin: '-35% 0px -55% 0px' }
    )
    for (const el of Object.values(sezioni.current)) if (el) osserva.observe(el)
    return () => osserva.disconnect()
  }, [categorie])

  const vaiA = (cat) => (e) => {
    e.preventDefault()
    setAttiva(cat)
    sezioni.current[cat]?.scrollIntoView?.({ behavior: nessunMovimento() ? 'auto' : 'smooth', block: 'start' })
  }

  const [primo, ...altri] = speciali
  return (
    <div className="g-giornale">
      {!soloSpeciali && categorie.length > 1 && (
        <nav className="g-sommario" aria-label="Sommario">
          <span className="g-sommario-titolo">Sommario</span>
          {categorie.map(([cat]) => (
            <a
              key={cat}
              href={`#${ancora(cat)}`}
              className={attiva === cat ? 'attiva' : undefined}
              aria-current={attiva === cat ? 'true' : undefined}
              onClick={vaiA(cat)}
            >
              {cat}
            </a>
          ))}
        </nav>
      )}

      {primo && (
        <section className="g-prima-pagina" aria-label="Prima pagina">
          <Articolo d={primo} apertura immagine={immagine} apri={apri} tastiOrdine={tastiOrdine} quantita={quantita} />
          {altri.length > 0 && (
            <aside className="g-in-breve" aria-label="In breve">
              <h3 className="g-rubrica">In breve</h3>
              {altri.map((d) => (
                <Articolo key={d.id} d={d} immagine={immagine} apri={apri} tastiOrdine={tastiOrdine} quantita={quantita} />
              ))}
            </aside>
          )}
        </section>
      )}

      {!soloSpeciali &&
        categorie.map(([cat, list]) => (
          <section
            key={cat}
            id={ancora(cat)}
            data-cat={cat}
            className="g-sezione"
            ref={(el) => {
              sezioni.current[cat] = el
            }}
          >
            <h3 className="g-sezione-titolo">
              <span>{cat}</span>
              <span className="g-sezione-conto">{list.length === 1 ? '1 voce' : `${list.length} voci`}</span>
            </h3>
            <div className="g-colonne">
              {list.map((d) => {
                const ingredienti = ingredientiInCarta(d, { quantita })
                return (
                  <article className="g-voce" key={d.id}>
                    <h4>
                      <button type="button" onClick={() => apri(d)}>
                        {d.name}
                      </button>
                      <span className="g-puntini" aria-hidden="true" />
                      <span className="g-prezzo">{formatPrice(d.price)}</span>
                    </h4>
                    {d.description && <p className="g-testo">{d.description}</p>}
                    {ingredienti && <p className="g-ingredienti">{ingredienti.join(' · ')}</p>}
                    <div className="g-voce-tasti">{tastiOrdine(d)}</div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
    </div>
  )
}
