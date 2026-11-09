import { Fragment, useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ingredientiInCarta } from '../lib/ingredientiCarta.js'
import { carteDelMazzo, misuraNome, segnoDi } from '../lib/mazzoCarte.js'
import { comeScorrere } from '../lib/movimento.js'
import { useIncollata } from '../lib/useIncollata.js'
import { formatPrice } from '../lib/orderStatus.js'

// ── LO STILE «CARTE»: IL MENÙ COME UN MAZZO (REQ-MENU-029) ────────────────
// L'idea di Flavio, 05/11/2026, e il suo schizzo del 06/11/2026: «na cosa
// del genere, con le carte che si alzano quando le selezioni»; l'utente:
// «una cosa ovviamente più figa e moderna con animazioni».
//   · il MAZZO: ogni sezione è una carta francese, intera, col seme del
//     suo gruppo e il suo valore (lib/mazzoCarte.js), in fila e
//     accavallate, IN MEZZO A UN VENTAGLIO DI CARTE GIRATE: sotto ogni
//     carta una girata, sfalsata e un poco più in basso, e ai due capi una
//     girata inclinata (FilaCarte). All'apertura le carte escono da quella
//     di sinistra. (La prima versione le teneva per metà dietro una fascia
//     di dorsi: «le carte devono essere intere, adesso sono tagliate, non
//     sembra un mazzo»; la seconda le girate le metteva in un mazzo a
//     parte: «le carte che aprono il menù sono in mezzo a un ventaglio di
//     carte girate», come nello schizzo.)
//   · la CARTA SCELTA si alza, e sotto si apre in grande: esce dal
//     ventaglio girata sul dorso, si gira, e le voci si scrivono una dopo
//     l'altra (l'utente, 06/11/2026: «quando clicchi la carta esce fuori
//     dal mazzo, si gira e si popola il menù»). Le voci: nome, prezzo,
//     descrizione, ingredienti, «Aggiungi»;
//   · gli SPECIAL nel menù sono del carosello di sempre, in cima
//     (stiliStrutturati.js, `carosello`); sulla pagina Special sono il
//     Jolly, una carta sola, già aperta;
//   · il MAZZO RESTA AGGANCIATO IN ALTO mentre si legge (Flavio,
//     08/11/2026: «mantenere le carte bloccate in alto e rimuovere il tasto
//     che riporta alle carte»): le sezioni lunghe (i gin, i whisky) non
//     costringono a risalire a mano. Prima restava agganciata la testa
//     della carta aperta, col tasto «Le carte ↑»; con il mazzo sempre lì il
//     tasto non serve, e due fasce agganciate una sopra l'altra si
//     mangiavano lo schermo del telefono. Quale sezione è aperta lo dice la
//     carta alzata nel mazzo.
// Si apre la prima sezione. Le carte non aperte restano nella pagina,
// nascoste: ogni voce è a un tocco, e il contratto (contrattoStile.js) le
// vuole tutte.
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
// `ordine` mette in fila l'entrata delle voci, quando la carta si gira.
export function VoceCarta({ d, img = null, apri, tastiOrdine, quantita = false, ordine = 0 }) {
  const ingredienti = useMemo(() => ingredientiInCarta(d, { quantita }), [d, quantita])
  return (
    <article className="k-voce" style={{ '--n': Math.min(ordine, 12) }}>
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

// Una carta del mazzo, chiusa: l'angolo, il nome e il seme grande. L'angolo
// capovolto no: la carta successiva lo copre.
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
      <span className="k-carta-nome" style={{ '--k-parola': misuraNome(carta.nome) || 1 }}>
        {carta.nome}
      </span>
      <span className="k-pip" aria-hidden="true">
        {segnoDi(carta.seme)}
      </span>
    </button>
  )
}

// LA FILA, come nello schizzo di Flavio: le carte scoperte in mezzo a un
// ventaglio di carte girate. Una girata sotto ogni carta, sfalsata di mezza
// carta, che spunta sotto il bordo; una girata inclinata a ogni capo, col
// logo del locale, come sulle carte da gioco fatte per un locale (l'utente,
// 06/11/2026: «dietro il mazzo di carte può andare il logo della Tana del
// Coniglio?»). Il logo è quello della build (public/logo.png): ogni
// installazione ha il suo, o quello neutro (pluginCliente.js). Le girate
// sono disegno: chi legge lo schermo le salta.
// La usano il menù e la vetrina del Marketplace, che così mostra il mazzo
// che c'è davvero.
const LOGO = `${import.meta.env.BASE_URL}logo.png`
// Le girate sotto non stanno dritte: un poco storte, a giro.
const STORTE = ['-3deg', '2deg', '-1.5deg', '3deg', '-2.5deg', '1deg']

function GirataInCapo({ lato }) {
  return (
    <span className={`k-dorso k-dorso-capo k-dorso-${lato}`} aria-hidden="true">
      <img className="k-dorso-logo" src={LOGO} alt="" />
    </span>
  )
}

export function FilaCarte({ carte, apertaId, scegli, tabIndex }) {
  return (
    <div className="k-fila">
      <GirataInCapo lato="primo" />
      {carte.map((c, i) => (
        <Fragment key={c.id}>
          <span className="k-dorso k-dorso-sotto" aria-hidden="true" style={{ '--i': i, '--storta': STORTE[i % STORTE.length] }} />
          <CartaChiusa carta={c} indice={i} scelta={c.id === apertaId} onClick={scegli && scegli(c.id)} tabIndex={tabIndex} />
        </Fragment>
      ))}
      <GirataInCapo lato="ultimo" />
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

// DA DOVE PARTE IL VOLO: dalla carta toccata, alla sua misura, e da dove
// sarà quando la fila l'avrà centrata (lo scorrimento parte insieme al
// volo). L'utente, 06/11/2026: «non si vede che esce dal mazzo» — il volo
// partiva da un punto fisso sopra la carta aperta. Torna le variabili CSS
// del punto di partenza rispetto al volo, o null se non c'è niente da
// misurare (la prima carta, aperta senza tocco, parte dall'alto).
export function partenzaDelVolo(carta, ventaglio, volo) {
  if (!carta?.getBoundingClientRect || !ventaglio || !volo) return null
  const c = carta.getBoundingClientRect()
  const v = ventaglio.getBoundingClientRect()
  const d = volo.getBoundingClientRect()
  const larga = Math.min(d.width, 720)
  if (!c.width || !larga) return null
  const centro = c.left - v.left + ventaglio.scrollLeft + c.width / 2
  const corsa = Math.max(0, ventaglio.scrollWidth - ventaglio.clientWidth)
  const scorso = Math.min(Math.max(centro - ventaglio.clientWidth / 2, 0), corsa)
  return {
    '--da-x': `${Math.round(v.left + centro - scorso - (d.left + d.width / 2))}px`,
    '--da-y': `${Math.round(c.top - d.top)}px`,
    '--da-scala': (c.width / larga).toFixed(3),
  }
}

export default function MenuCarte({ sezioni, speciali, immagine, apri, tastiOrdine, quantita = false, soloSpeciali = false, special = {} }) {
  const carte = useMemo(() => carteDelMazzo(sezioni), [sezioni])
  const [scelta, setScelta] = useState(null)
  const [partenza, setPartenza] = useState(null)
  const ventaglio = useRef(null)
  const inVolo = useRef(null)
  // Il segnaposto sta dove il mazzo starebbe fermo nella pagina: dice se il
  // mazzo si è agganciato (useIncollata), ed è il punto a cui si torna.
  const [osserva, incollato] = useIncollata()
  const segnaposto = useRef(null)
  const alSegnaposto = useCallback(
    (el) => {
      segnaposto.current = el
      osserva(el)
    },
    [osserva]
  )

  // Sulla pagina Special c'è solo il Jolly, già aperto. Altrimenti la carta
  // scelta, se c'è ancora (un menù che si aggiorna può toglierla), o la
  // prima.
  const tutte = soloSpeciali
    ? speciali.length
      ? [{ id: JOLLY, jolly: true, seme: SEME_JOLLY, nome: special.titolo || 'Special', voci: speciali }]
      : []
    : carte
  const aperta = tutte.find((c) => c.id === scelta) || tutte[0]
  if (!aperta) return null

  // CON IL MAZZO AGGANCIATO si sceglie una carta da metà di un'altra: la
  // pagina resterebbe a quell'altezza, e la carta nuova si leggerebbe a
  // metà (o, più corta, si vedrebbe il fondo vuoto). Si torna all'inizio,
  // con il mazzo in alto e la carta subito sotto. Di colpo e PRIMA di
  // misurare il volo: il volo parte da dove la carta aperta sarà.
  const scegli = (id) => (e) => {
    if (incollato) segnaposto.current?.scrollIntoView?.({ block: 'start' })
    setPartenza(partenzaDelVolo(e.currentTarget, ventaglio.current, inVolo.current))
    setScelta(id)
    e.currentTarget.scrollIntoView?.({ behavior: comeScorrere(), block: 'nearest', inline: 'center' })
  }

  return (
    <div className="k-tavolo">
      {!soloSpeciali && <div className="k-mazzo-segnaposto" ref={alSegnaposto} aria-hidden="true" />}
      {!soloSpeciali && (
        <nav className={incollato ? 'k-mazzo incollata' : 'k-mazzo'} aria-label="Le carte del menù">
          <div className="k-ventaglio" ref={ventaglio}>
            <FilaCarte carte={tutte} apertaId={aperta.id} scegli={scegli} />
          </div>
        </nav>
      )}

      {/* La carta in volo: esce dal ventaglio, dalla carta toccata, girata,
          scende crescendo e gira fino a metà; poi subentra la faccia (la
          carta aperta). Con la chiave della carta scelta, a ogni scelta
          ricomincia. Solo disegno. */}
      {!soloSpeciali && (
        <span key={aperta.id} ref={inVolo} className="k-in-volo" style={partenza || undefined} aria-hidden="true" />
      )}

      {tutte.map((c) => (
        <section
          key={c.id}
          className="k-aperta"
          data-seme={c.seme.id}
          hidden={c.id !== aperta.id}
          aria-label={c.nome}
        >
          {/* Sulla pagina Special il titolo l'ha già detto la testata. */}
          {!soloSpeciali && (
            <header className="k-aperta-testa">
              <Indice carta={c} />
              <div className="k-aperta-titolo">
                {c.gruppo && <p className="k-gruppo">{c.gruppo}</p>}
                <h2>{c.nome}</h2>
              </div>
            </header>
          )}
          <div className="k-voci">
            {c.voci.map((d, n) => (
              <VoceCarta
                key={d.id}
                d={d}
                ordine={n}
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
