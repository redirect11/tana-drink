import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { immagineVoce } from '../lib/speciali.js'
import { formatPrice } from '../lib/orderStatus.js'
import { ingredientiInCarta } from '../lib/ingredientiCarta.js'

// IL CAROSELLO DEGLI SPECIAL (REQ-MENU-018), in cima al menù del cliente.
// L'utente, 29/10/2026: «serve un carosello vero che fa lo slide delle
// immagini dei drink con nome e descrizione». Prima era una fila di
// tessere da scorrere: si vedevano due drink e mezzo, e nessuna
// descrizione.
//
// Una slide alla volta, larga quanto lo schermo: il disegno, il nome, la
// descrizione e il prezzo. Va avanti da sola ogni pochi secondi; si sfoglia
// col dito (lo scorrimento si aggancia alla slide) e coi pallini sotto. Chi
// la tocca prende il comando: da lì in poi lo scorrimento automatico si
// ferma, perché una slide che scappa mentre la si sta leggendo è peggio di
// una che sta ferma. Con «riduci movimento» del telefono non parte affatto.
// Toccando una slide si apre il menù Special su quel drink.
export default function CaroselloSpeciali({ voci, link, chiaro = false, intervallo = 5000 }) {
  const fila = useRef(null)
  const [attiva, setAttiva] = useState(0)
  const attivaRef = useRef(0)
  attivaRef.current = attiva
  const toccato = useRef(false)

  const vai = (n) => {
    const k = ((n % voci.length) + voci.length) % voci.length
    const el = fila.current
    el?.scrollTo?.({ left: k * el.clientWidth, behavior: 'smooth' })
    // Subito, non al prossimo disegno: due passi ravvicinati ripartivano
    // dalla slide di prima.
    attivaRef.current = k
    setAttiva(k)
  }

  useEffect(() => {
    if (voci.length < 2) return undefined
    const ridotto = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (ridotto) return undefined
    const t = setInterval(() => {
      if (!toccato.current) vai(attivaRef.current + 1)
    }, intervallo)
    return () => clearInterval(t)
    // `vai` legge solo riferimenti: non serve ricrearlo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voci.length, intervallo])

  // Sfogliando col dito, il pallino segue la slide che si è fermata.
  const alloScorrere = () => {
    const el = fila.current
    if (!el || !el.clientWidth) return
    const k = Math.round(el.scrollLeft / el.clientWidth)
    if (k !== attivaRef.current && k >= 0 && k < voci.length) setAttiva(k)
  }
  const prendi = () => {
    toccato.current = true
  }

  if (voci.length === 0) return null
  return (
    <div className="carosello" onPointerDown={prendi} onWheel={prendi}>
      <div className="carosello-fila" ref={fila} onScroll={alloScorrere}>
        {voci.map((d, k) => {
          const img = immagineVoce(d, import.meta.env.BASE_URL, { chiaro })
          const ingredienti = ingredientiInCarta(d)
          return (
            <Link
              key={d.id}
              className="carosello-slide"
              to={link(d)}
              aria-label={d.name}
              aria-hidden={k === attiva ? undefined : 'true'}
              tabIndex={k === attiva ? 0 : -1}
            >
              {img ? <img src={img} alt="" loading={k === 0 ? 'eager' : 'lazy'} /> : <span className="carosello-vuota" aria-hidden="true">✨</span>}
              <span className="carosello-testo">
                <strong>{d.name}</strong>
                {d.description && <span className="carosello-descrizione">{d.description}</span>}
                {ingredienti && <span className="carosello-ingredienti">{ingredienti.join(' · ')}</span>}
                <span className="price">{formatPrice(d.price)}</span>
              </span>
            </Link>
          )
        })}
      </div>
      {voci.length > 1 && (
        <div className="carosello-punti" role="group" aria-label="Scegli lo special">
          {voci.map((d, k) => (
            <button
              key={d.id}
              type="button"
              className={k === attiva ? 'attivo' : ''}
              aria-label={d.name}
              aria-current={k === attiva ? 'true' : undefined}
              onClick={() => {
                prendi()
                vai(k)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
