import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ingredientiInCarta } from '../lib/ingredientiCarta.js'
import { nessunMovimento } from '../lib/movimento.js'
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
// Testata e corpo ricevono il pacchetto del contratto degli stili
// strutturati (lib/contrattoStile.js, REQ-MENU-028).

const dataEdizione = (quando = new Date()) =>
  quando.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

const ancora = (cat) => `sez-${encodeURIComponent(cat)}`

// Nel menù Special la testata fa anche da testata degli Special: il titolo
// della sera al posto del motto, il tema, e la strada per il menù completo,
// che senza questa riga sparivano con la testata classica.
export function TestataGiornale({ venue, soloSpeciali = false, special = {}, linkMenu }) {
  const motto = soloSpeciali ? special.titolo || 'Special' : venue.venue_tagline
  return (
    <header className="g-testata">
      <p className="g-edizione">
        <span>Edizione della sera</span>
        <span>{dataEdizione()}</span>
      </p>
      <h1 className="g-nome">{venue.venue_name}</h1>
      {motto && <p className="g-motto">{motto}</p>}
      {soloSpeciali && (
        <>
          {special.sottotitolo && <p className="speciali-tema">{special.sottotitolo}</p>}
          {linkMenu && (
            <Link className="btn ghost small" to={linkMenu}>
              ← Tutto il menù
            </Link>
          )}
        </>
      )}
    </header>
  )
}

// Una voce di una sezione: «NOME ···· prezzo», la descrizione, gli
// ingredienti, il tasto. La usa anche la vetrina del Marketplace, perché
// mostri il giornale che c'è davvero: senza `apri` il nome è testo.
export function VoceGiornale({ d, apri, tastiOrdine, quantita = false }) {
  const ingredienti = ingredientiInCarta(d, { quantita })
  return (
    <article className="g-voce">
      <h4>
        {apri ? (
          <button type="button" onClick={() => apri(d)}>
            {d.name}
          </button>
        ) : (
          <span>{d.name}</span>
        )}
        <span className="g-puntini" aria-hidden="true" />
        <span className="g-prezzo">{formatPrice(d.price)}</span>
      </h4>
      {d.description && <p className="g-testo">{d.description}</p>}
      {ingredienti && <p className="g-ingredienti">{ingredienti.join(' · ')}</p>}
      {tastiOrdine && <div className="g-voce-tasti">{tastiOrdine(d)}</div>}
    </article>
  )
}

// LA VETRINA DEL MARKETPLACE (stiliStrutturati.js): la testata e una
// sezione con le voci d'esempio.
export function VetrinaGiornale({ voci }) {
  return (
    <>
      <TestataGiornale venue={{ venue_name: 'Il Locale' }} />
      <h3 className="g-sezione-titolo">
        <span>Cocktail</span>
        <span className="g-sezione-conto">{voci.length} voci</span>
      </h3>
      {voci.map((d) => (
        <VoceGiornale key={d.id} d={d} />
      ))}
    </>
  )
}

// IL SOMMARIO SEGUE LA LETTURA: la sezione evidenziata è quella che si ha
// sotto gli occhi, non l'ultima toccata. Lo stato sta qui e non nel giornale:
// stava sopra, e ogni sezione che passava sotto gli occhi ridisegnava tutto
// il menù, voci e tasti, proprio mentre si scorre.
// Mentre si scorre verso una sezione toccata, le sezioni attraversate non
// spostano il segno: arriverebbe a quella giusta passando per tutte.
function Sommario({ nomi, sezioni }) {
  const [attiva, setAttiva] = useState(nomi[0] || null)
  const guidato = useRef(null)
  // Si riosserva solo se cambiano le sezioni, non a ogni giro della pagina.
  const chiave = nomi.join('|')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined
    const osserva = new IntersectionObserver(
      (voci) => {
        const vista = voci.filter((v) => v.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (!vista) return
        const cat = vista.target.dataset.cat
        if (guidato.current) {
          if (cat === guidato.current) guidato.current = null
          return
        }
        setAttiva(cat)
      },
      { rootMargin: '-35% 0px -55% 0px' }
    )
    for (const el of Object.values(sezioni.current)) if (el) osserva.observe(el)
    return () => osserva.disconnect()
  }, [chiave, sezioni])

  const vaiA = (cat) => (e) => {
    e.preventDefault()
    setAttiva(cat)
    const ridotto = nessunMovimento()
    guidato.current = ridotto ? null : cat
    sezioni.current[cat]?.scrollIntoView?.({ behavior: ridotto ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <nav className="g-sommario" aria-label="Sommario">
      <span className="g-sommario-titolo">Sommario</span>
      {nomi.map((cat) => (
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

export default function MenuGiornale({ sezioni, speciali, immagine, apri, tastiOrdine, quantita = false, soloSpeciali = false }) {
  const elementi = useRef({})
  const [primo, ...altri] = speciali
  return (
    <div className="g-giornale">
      {!soloSpeciali && sezioni.length > 1 && <Sommario nomi={sezioni.map((s) => s.nome)} sezioni={elementi} />}

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
        sezioni.map(({ id, nome, voci }) => (
          <section
            key={id}
            id={ancora(nome)}
            data-cat={nome}
            className="g-sezione"
            ref={(el) => {
              elementi.current[nome] = el
            }}
          >
            <h3 className="g-sezione-titolo">
              <span>{nome}</span>
              <span className="g-sezione-conto">{voci.length === 1 ? '1 voce' : `${voci.length} voci`}</span>
            </h3>
            <div className="g-colonne">
              {voci.map((d) => (
                <VoceGiornale key={d.id} d={d} apri={apri} tastiOrdine={tastiOrdine} quantita={quantita} />
              ))}
            </div>
          </section>
        ))}
    </div>
  )
}
