import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ingredientiInCarta } from '../lib/ingredientiCarta.js'
import { carteDelMazzo, segnoDi } from '../lib/mazzoCarte.js'
import { comeScorrere } from '../lib/movimento.js'
import { formatPrice } from '../lib/orderStatus.js'

// ── LO STILE «CARTE»: IL MENÙ COME UN MAZZO (REQ-MENU-029) ────────────────
// L'idea di Flavio, 05/11/2026, e il suo schizzo del 06/11/2026: «na cosa
// del genere, con le carte che si alzano quando le selezioni»; l'utente:
// «una cosa ovviamente più figa e moderna con animazioni».
//   · il MAZZO: ogni sezione è una carta francese, col seme del suo gruppo
//     e il suo valore (lib/mazzoCarte.js), in fila e accavallate; la parte
//     bassa sta nel mazzo coperto, come nello schizzo. All'apertura le carte
//     escono dal mazzo una dopo l'altra;
//   · la CARTA SCELTA si alza, e sotto si apre in grande, con le voci
//     scritte sopra: nome, prezzo, descrizione, ingredienti, «Aggiungi»;
//   · gli SPECIAL sono il Jolly, la prima carta;
//   · la testa della carta aperta resta agganciata mentre si legge, col
//     tasto per tornare al mazzo: le sezioni lunghe (i gin, i whisky) non
//     costringono a risalire a mano.
// Si apre la prima sezione, non il Jolly: aprendo il menù si deve vedere il
// menù. Le carte non aperte restano nella pagina, nascoste: ogni voce è a
// un tocco, e il contratto (contrattoStile.js) le vuole tutte.
// Si animano solo transform e opacity, e con «riduci movimento» niente.

// Il Jolly ha un seme suo, così ogni carta si colora dal suo seme senza
// eccezioni; `segnoDi` non lo legge mai, perché l'angolo del Jolly è la
// stella (Indice).
const JOLLY = 'jolly'
const SEME_JOLLY = Object.freeze({ id: JOLLY })

export function TestataCarte({ venue, soloSpeciali = false, special = {}, linkMenu }) {
  return (
    <header className="k-testata">
      <h1 className="k-nome">{venue.venue_name}</h1>
      {soloSpeciali ? (
        <>
          <p className="k-motto">{special.titolo || 'Special'}</p>
          {special.sottotitolo && <p className="speciali-tema">{special.sottotitolo}</p>}
          {linkMenu && (
            <Link className="btn ghost small" to={linkMenu}>
              ← Tutto il menù
            </Link>
          )}
        </>
      ) : (
        venue.venue_tagline && <p className="k-motto">{venue.venue_tagline}</p>
      )}
    </header>
  )
}

// L'angolo della carta: il valore sopra il seme. Nell'angolo in basso è
// capovolto, come su una carta vera. Il Jolly ha la stella e la scritta.
function Indice({ carta, basso = false }) {
  return (
    <span className={basso ? 'k-indice k-indice-basso' : 'k-indice'} aria-hidden="true">
      {carta.jolly ? (
        <>
          <span className="k-valore">★</span>
          <span className="k-jolly-scritta">JOLLY</span>
        </>
      ) : (
        <>
          <span className="k-valore">{carta.valore}</span>
          <span className="k-seme">{segnoDi(carta.seme)}</span>
        </>
      )}
    </span>
  )
}

// Una voce scritta sulla carta: «NOME ···· prezzo», la descrizione, gli
// ingredienti, il tasto. La usa anche la vetrina del Marketplace: senza
// `apri` il nome è testo, senza `tastiOrdine` non ci sono tasti.
// Gli ingredienti si calcolano una volta per voce: il menù si ridisegna a
// ogni «Aggiungi», e con lui tutte le voci, anche quelle delle carte chiuse.
export function VoceCarta({ d, img = null, apri, tastiOrdine, quantita = false }) {
  const ingredienti = useMemo(() => ingredientiInCarta(d, { quantita }), [d, quantita])
  return (
    <article className="k-voce">
      {img && <img className="k-voce-img" src={img} alt="" loading="lazy" />}
      <div className="k-voce-testo">
        <h3>
          {apri ? (
            <button type="button" onClick={() => apri(d)}>
              {d.name}
            </button>
          ) : (
            <span>{d.name}</span>
          )}
          <span className="k-puntini" aria-hidden="true" />
          <span className="k-prezzo">{formatPrice(d.price)}</span>
        </h3>
        {d.description && <p className="k-descrizione">{d.description}</p>}
        {ingredienti && <p className="k-ingredienti">{ingredienti.join(' · ')}</p>}
      </div>
      {tastiOrdine && <div className="k-voce-tasti">{tastiOrdine(d)}</div>}
    </article>
  )
}

// Una carta del mazzo, chiusa: l'angolo e il nome. La parte bassa sta nel
// mazzo coperto, e l'angolo capovolto non si vedrebbe.
export function CartaChiusa({ carta, indice, scelta = false, onClick, tabIndex }) {
  return (
    <button
      type="button"
      tabIndex={tabIndex}
      className="k-carta"
      data-seme={carta.seme.id}
      aria-pressed={scelta}
      style={{ '--i': indice }}
      onClick={onClick}
    >
      <Indice carta={carta} />
      <span className="k-carta-nome">{carta.nome}</span>
    </button>
  )
}

// La fila delle carte con il mazzo coperto davanti. La usano il menù e la
// vetrina del Marketplace, che così mostra il mazzo che c'è davvero.
export function FilaCarte({ carte, apertaId, scegli, tabIndex }) {
  return (
    <div className="k-fila">
      {carte.map((c, i) => (
        <CartaChiusa
          key={c.id}
          carta={c}
          indice={i}
          scelta={c.id === apertaId}
          onClick={scegli && scegli(c.id)}
          tabIndex={tabIndex}
        />
      ))}
      <span className="k-coperto" aria-hidden="true" />
    </div>
  )
}

// LA VETRINA DEL MARKETPLACE (stiliStrutturati.js): il mazzo d'esempio con
// le voci che le passa il Marketplace, e la prima carta aperta. Le carte
// sono tasti fuori dal giro della tastiera: la vetrina è un'immagine.
const GRUPPI_ESEMPIO = ['Cocktail', 'Distillati', 'Vini', 'Bevande']

export function VetrinaCarte({ voci }) {
  const mazzo = carteDelMazzo(GRUPPI_ESEMPIO.map((nome) => ({ id: nome, nome, gruppo: nome, voci })))
  const [aperta] = mazzo
  return (
    <>
      <FilaCarte carte={mazzo} apertaId={aperta.id} tabIndex={-1} />
      <section className="k-aperta" data-seme={aperta.seme.id}>
        {aperta.voci.map((d) => (
          <VoceCarta key={d.id} d={d} />
        ))}
      </section>
    </>
  )
}

export default function MenuCarte({ sezioni, speciali, immagine, apri, tastiOrdine, quantita = false, soloSpeciali = false, special = {} }) {
  const carte = useMemo(() => carteDelMazzo(sezioni), [sezioni])
  const jolly = speciali.length > 0 ? [{ id: JOLLY, jolly: true, seme: SEME_JOLLY, nome: special.titolo || 'Special', voci: speciali }] : []
  const [scelta, setScelta] = useState(null)
  const mazzo = useRef(null)

  // Sulla pagina Special c'è solo il Jolly, già aperto. Altrimenti la carta
  // scelta, se c'è ancora (un menù che si aggiorna può toglierla), o la
  // prima sezione, o il Jolly se sezioni non ce ne sono.
  const tutte = soloSpeciali ? jolly : [...jolly, ...carte]
  const aperta = tutte.find((c) => c.id === scelta) || tutte.find((c) => !c.jolly) || tutte[0]
  if (!aperta) return null

  const scegli = (id) => (e) => {
    setScelta(id)
    e.currentTarget.scrollIntoView?.({ behavior: comeScorrere(), block: 'nearest', inline: 'center' })
  }
  const tornaAlMazzo = () => mazzo.current?.scrollIntoView?.({ behavior: comeScorrere(), block: 'start' })

  return (
    <div className="k-tavolo">
      {!soloSpeciali && (
        <nav className="k-mazzo" aria-label="Le carte del menù" ref={mazzo}>
          <div className="k-ventaglio">
            <FilaCarte carte={tutte} apertaId={aperta.id} scegli={scegli} />
          </div>
        </nav>
      )}

      {tutte.map((c) => (
        <section
          key={c.id}
          className="k-aperta"
          data-seme={c.seme.id}
          hidden={c.id !== aperta.id}
          aria-label={c.nome}
        >
          {/* Sulla pagina Special il titolo l'ha già detto la testata, e
              un mazzo a cui tornare non c'è. */}
          {!soloSpeciali && (
            <header className="k-aperta-testa">
              <Indice carta={c} />
              <div className="k-aperta-titolo">
                {c.gruppo && <p className="k-gruppo">{c.gruppo}</p>}
                <h2>{c.nome}</h2>
              </div>
              <button type="button" className="k-torna" onClick={tornaAlMazzo}>
                Le carte ↑
              </button>
            </header>
          )}
          <div className="k-voci">
            {c.voci.map((d) => (
              <VoceCarta
                key={d.id}
                d={d}
                img={c.jolly ? immagine(d) : null}
                apri={apri}
                tastiOrdine={tastiOrdine}
                quantita={quantita}
              />
            ))}
          </div>
          <Indice carta={c} basso />
        </section>
      ))}
    </div>
  )
}
